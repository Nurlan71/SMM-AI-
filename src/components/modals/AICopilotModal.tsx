import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, FunctionDeclaration, Type, LiveSession, LiveServerMessage } from '@google/genai';
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../../api';
import { styles } from '../../styles';
import { encode, decode, decodeAudioData, createBlob } from '../../lib/audioUtils';
import type { Screen } from '../../types';

type Status = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface TranscriptEntry {
    id: number;
    speaker: 'user' | 'model';
    text: string;
}

const navigateToScreen: FunctionDeclaration = {
    name: 'navigateToScreen',
    description: 'Переключает активный экран в приложении.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            screen: {
                type: Type.STRING,
                description: 'ID экрана, на который нужно перейти (например, "analytics", "content-plan").'
            },
        },
        required: ['screen'],
    },
};

const createIdeaPost: FunctionDeclaration = {
    name: 'createIdeaPost',
    description: 'Создает новый пост со статусом "идея" в контент-плане.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            content: {
                type: Type.STRING,
                description: 'Текст поста для создания.'
            },
        },
        required: ['content'],
    },
};

export const AICopilotModal = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { dispatch: dataDispatch } = useDataContext();
    
    const [status, setStatus] = useState<Status>('idle');
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [error, setError] = useState<string>('');
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const transcriptContainerRef = useRef<HTMLDivElement>(null);
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    useEffect(() => {
        // Scroll to bottom when transcript updates
        if (transcriptContainerRef.current) {
            transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
        }
    }, [transcript]);

    const addTranscript = (speaker: 'user' | 'model', text: string) => {
        if (!text.trim()) return;
        setTranscript(prev => [...prev, { id: Date.now(), speaker, text }]);
    };
    
    const handleClose = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
        }
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();
        
        sessionPromiseRef.current = null;
        appDispatch({ type: 'SET_COPILOT_OPEN', payload: false });
    }, [appDispatch]);
    
    // --- Function Calling Handlers ---
    const handleFunctionCall = useCallback(async (functionName: string, args: any) => {
        console.log(`[Co-pilot] Executing function: ${functionName}`, args);
        let result = "ok";
        try {
            if (functionName === 'navigateToScreen') {
                appDispatch({ type: 'SET_ACTIVE_SCREEN', payload: args.screen as Screen });
                handleClose();
            } else if (functionName === 'createIdeaPost') {
                const newPost = await fetchWithAuth(`${API_BASE_URL}/api/posts`, {
                    method: 'POST',
                    body: JSON.stringify({ content: args.content, status: 'idea' }),
                });
                dataDispatch({ type: 'ADD_POST', payload: newPost });
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Идея для поста создана!', type: 'success' } });
            }
        } catch (e) {
            result = `Error executing function: ${e instanceof Error ? e.message : 'Unknown error'}`;
            console.error(result);
        }
        return result;
    }, [appDispatch, dataDispatch, handleClose]);


    const startSession = useCallback(async () => {
        setError('');
        setStatus('listening');
        setTranscript([]);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext)({ sampleRate: 24000 });
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: 'Ты - дружелюбный и полезный AI-ассистент в приложении для SMM-менеджеров. Отвечай кратко и по делу.',
                    tools: [{ functionDeclarations: [navigateToScreen, createIdeaPost] }],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;
                        
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent) {
                            setStatus('speaking');

                            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                            if (base64Audio) {
                                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current!.currentTime);
                                const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current!, 24000, 1);
                                const source = outputAudioContextRef.current!.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputAudioContextRef.current!.destination);
                                source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                audioSourcesRef.current.add(source);
                            }

                            if (message.serverContent?.interrupted) {
                                for (const source of audioSourcesRef.current.values()) {
                                    source.stop();
                                    audioSourcesRef.current.delete(source);
                                }
                                nextStartTimeRef.current = 0;
                            }
                            
                            // Handle Transcription
                            if (message.serverContent.inputTranscription) {
                                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                            }
                            if (message.serverContent.outputTranscription) {
                                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                            }
                             if (message.serverContent.turnComplete) {
                                addTranscript('user', currentInputTranscriptionRef.current);
                                addTranscript('model', currentOutputTranscriptionRef.current);
                                currentInputTranscriptionRef.current = '';
                                currentOutputTranscriptionRef.current = '';
                                setStatus('listening');
                            }
                        }
                        
                         if (message.toolCall) {
                            setStatus('thinking');
                            for (const fc of message.toolCall.functionCalls) {
                                addTranscript('user', `Выполняю команду: ${fc.name}...`);
                                const result = await handleFunctionCall(fc.name, fc.args);
                                sessionPromiseRef.current?.then((session) => {
                                    session.sendToolResponse({
                                        functionResponses: { id: fc.id, name: fc.name, response: { result } }
                                    });
                                });
                            }
                        }
                    },
                    onerror: (e) => {
                        console.error('Session Error:', e);
                        setError('Произошла ошибка соединения. Попробуйте снова.');
                        setStatus('error');
                    },
                    onclose: () => {
                        console.log('Session closed.');
                    },
                },
            });
        } catch (err) {
            console.error('Failed to start session:', err);
            setError('Не удалось получить доступ к микрофону. Проверьте разрешения.');
            setStatus('error');
        }
    }, [handleFunctionCall]);

    const getStatusInfo = () => {
        switch (status) {
            case 'listening': return { text: 'Слушаю...', color: '#28a745' };
            case 'thinking': return { text: 'Думаю...', color: '#ffc107' };
            case 'speaking': return { text: 'Говорю...', color: '#007bff' };
            case 'error': return { text: 'Ошибка', color: '#dc3545' };
            default: return { text: 'Готов к работе', color: '#6c757d' };
        }
    };
    
    const statusInfo = getStatusInfo();

    return (
        <div style={styles.modalOverlay} onClick={handleClose}>
            <div style={styles.copilotModalContent} onClick={e => e.stopPropagation()}>
                <header style={styles.copilotHeader}>
                    <h3 style={styles.copilotTitle}>AI Co-pilot</h3>
                    <div style={styles.copilotStatusIndicator}>
                         <div style={{...styles.copilotStatusDot, backgroundColor: statusInfo.color}}></div>
                         {statusInfo.text}
                    </div>
                </header>
                <div style={styles.copilotTranscriptContainer} className="copilot-transcript-container" ref={transcriptContainerRef}>
                    <div style={styles.copilotTranscriptContent}>
                        {transcript.map(entry => (
                            <div key={entry.id} style={{ ...styles.copilotMessageBubble, ...(entry.speaker === 'user' ? styles.copilotUserMessage : styles.copilotModelMessage) }}>
                                {entry.text}
                            </div>
                        ))}
                    </div>
                </div>
                <footer style={styles.copilotFooter}>
                     {status === 'idle' && (
                        <button style={{...styles.copilotMicButton, ...styles.copilotMicButtonInactive}} onClick={startSession} aria-label="Начать сессию">
                            🎙️
                        </button>
                    )}
                    {(status === 'listening' || status === 'speaking') && (
                        <button style={{...styles.copilotMicButton, ...styles.copilotMicButtonActive}} onClick={handleClose} aria-label="Завершить сессию">
                           ⏹️
                        </button>
                    )}
                    {status === 'thinking' && (
                        <button style={{...styles.copilotMicButton, ...styles.copilotThinkingIndicator}} disabled aria-label="AI думает">
                           🧠
                        </button>
                    )}
                     {status === 'error' && (
                        <div style={{textAlign: 'center'}}>
                            <p style={{color: '#dc3545', marginBottom: '8px'}}>{error}</p>
                            <button style={{...styles.button, ...styles.buttonSecondary}} onClick={handleClose}>Закрыть</button>
                        </div>
                    )}
                </footer>
            </div>
        </div>
    );
};