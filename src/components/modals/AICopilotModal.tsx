import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, Type, Modality, LiveServerMessage, Blob as GenAIBlob, FunctionDeclaration } from "@google/genai";
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { fetchWithAuth, API_BASE_URL } from '../../api';
import { styles, copilotStyles } from '../../styles';
import type { Post, AppFile, PostStatus, TranscriptEntry } from '../../types';

// --- Audio Helper Functions for AI Co-pilot ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const AICopilotScreen = () => {
    const { dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const [sessionStatus, setSessionStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [error, setError] = useState('');

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
    
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    const transcriptEndRef = useRef<HTMLDivElement>(null);

     const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const onAddPostIdea = useCallback(async (idea: Omit<Post, 'id' | 'status'>) => {
        const newPostIdea = { ...idea, status: 'draft' as PostStatus };
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/posts`, {
                method: 'POST',
                body: JSON.stringify(newPostIdea),
            });
            const savedPost: Post = await response.json();
            dataDispatch({ type: 'ADD_POST', payload: savedPost });
            addToast(`Идея "${idea.topic}" добавлена!`, 'success');
        } catch (e) {
            addToast(e instanceof Error ? e.message : 'Не удалось добавить идею', 'error');
            throw e; // Re-throw to inform the tool call
        }
    }, [dataDispatch, addToast]);

    const onSaveGeneratedImage = useCallback(async (base64Data: string, name: string) => {
        try {
            const byteString = atob(base64Data);
            const mimeString = 'image/jpeg';
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });
            const file = new File([blob], name, { type: mimeString });

            const formData = new FormData();
            formData.append('files', file);

            const response = await fetchWithAuth(`${API_BASE_URL}/api/files`, {
                method: 'POST',
                body: formData,
            });
            const uploadedFiles: AppFile[] = await response.json();
            
            if (uploadedFiles.length > 0) {
                 dataDispatch({ type: 'ADD_FILE', payload: uploadedFiles[0] });
                 addToast('Изображение сохранено!', 'success');
            } else {
                 throw new Error("Сервер не вернул информацию о файле.");
            }
        } catch (error) {
             addToast(error instanceof Error ? error.message : 'Не удалось сохранить изображение.', 'error');
             throw error;
        }
    }, [dataDispatch, addToast]);
    
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    const stopSession = useCallback(() => {
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        
        for (const source of sourcesRef.current.values()) {
            source.stop();
        }
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        
        sessionPromiseRef.current?.then(session => {
            session.close();
            sessionPromiseRef.current = null;
        }).catch(e => console.error("Error closing session:", e));
    }, []);

    const handleStart = async () => {
        setSessionStatus('connecting');
        setError('');
        setTranscript([]);
        nextStartTimeRef.current = 0;

        try {
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = inputCtx;
            
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputCtx;
            const outputNode = outputCtx.createGain();
            outputNode.connect(outputCtx.destination);

            const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = userStream;
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const addPostIdeaFunctionDeclaration: FunctionDeclaration = {
                name: 'addPostIdea',
                parameters: {
                    type: Type.OBJECT,
                    description: 'Создает новую идею для поста и добавляет ее в список идей контент-плана.',
                    properties: {
                        topic: { type: Type.STRING, description: 'Основная тема или заголовок поста.' },
                        postType: { type: Type.STRING, description: 'Формат поста, например, "Пост с фото", "Видео Reels", "Статья".' },
                        description: { type: Type.STRING, description: 'Краткое описание содержания поста.' },
                    },
                    required: ['topic', 'postType', 'description'],
                },
            };

            const generateImageFunctionDeclaration: FunctionDeclaration = {
                name: 'generateImage',
                parameters: {
                    type: Type.OBJECT,
                    description: 'Генерирует изображение на основе текстового описания.',
                    properties: {
                        prompt: { type: Type.STRING, description: 'Подробное описание изображения для генерации.' },
                    },
                    required: ['prompt'],
                },
            };
            
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: 'You are a friendly and expert SMM assistant co-pilot. You can brainstorm ideas, suggest strategies, and help draft content. Use the provided tools to help the user. Keep your answers concise and helpful.',
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations: [addPostIdeaFunctionDeclaration, generateImageFunctionDeclaration] }],
                },
                callbacks: {
                    onopen: () => {
                        setSessionStatus('active');
                        const source = inputCtx.createMediaStreamSource(userStream);
                        mediaStreamSourceRef.current = source;
                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob: GenAIBlob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(f => f * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscriptionRef.current.trim();
                            const fullOutput = currentOutputTranscriptionRef.current.trim();
                            
                            setTranscript(prev => {
                                const newTranscript = [...prev];
                                if (fullInput) newTranscript.push({ id: Date.now() + 1, speaker: 'user', text: fullInput });
                                if (fullOutput) newTranscript.push({ id: Date.now() + 2, speaker: 'model', text: fullOutput });
                                return newTranscript;
                            });
                            
                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                         if (message.toolCall) {
                            (async () => {
                                for (const fc of message.toolCall.functionCalls) {
                                    let toolResult: any = { status: 'success' };
                                    let functionOutputText = '';

                                    try {
                                        switch (fc.name) {
                                            case 'addPostIdea':
                                                const topic = String(fc.args.topic);
                                                const postType = String(fc.args.postType);
                                                const description = String(fc.args.description);
                                                await onAddPostIdea({ topic, postType, description, date: undefined, content: description });
                                                functionOutputText = `Идея для поста "${topic}" была успешно добавлена в ваш контент-план.`;
                                                break;
                                            case 'generateImage':
                                                const prompt = String(fc.args.prompt);
                                                const generatingMessageId = Date.now();
                                                setTranscript(prev => [...prev, { id: generatingMessageId, speaker: 'model', text: `🎨 Генерирую изображение по вашему запросу: "${prompt}"...` }]);

                                                const imageGenAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
                                                const response = await imageGenAI.models.generateImages({
                                                    model: 'imagen-4.0-generate-001',
                                                    prompt: prompt,
                                                    config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
                                                });
                                                
                                                if (!response.generatedImages || response.generatedImages.length === 0) {
                                                    throw new Error('API не вернуло изображение.');
                                                }

                                                const base64ImageBytes = response.generatedImages[0].image.imageBytes;
                                                const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                                                
                                                setTranscript(prev => [
                                                    ...prev.filter(e => e.id !== generatingMessageId), 
                                                    { id: Date.now(), speaker: 'model', text: 'Вот что у меня получилось:', imageUrl, promptForSave: prompt }
                                                ]);
                                                
                                                functionOutputText = `Изображение по запросу "${prompt}" успешно создано.`;
                                                break;
                                        }
                                        toolResult.result = functionOutputText;
                                    } catch (e) {
                                        const errorMessage = e instanceof Error ? e.message : 'Unknown error during function call';
                                        toolResult = { error: `Function call failed: ${errorMessage}` };
                                        setError(`Ошибка выполнения команды: ${errorMessage}`);
                                    }

                                    sessionPromiseRef.current?.then((session) => {
                                        session.sendToolResponse({
                                            functionResponses: { id: fc.id, name: fc.name, response: toolResult }
                                        });
                                    });
                                }
                            })();
                        }
                        
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio) {
                            const nextStartTime = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                            
                            const source = outputCtx.createBufferSource();
                            sourcesRef.current.add(source);
                            source.buffer = audioBuffer;
                            source.connect(outputNode);
                            source.addEventListener('ended', () => { sourcesRef.current.delete(source); });
                            source.start(nextStartTime);
                            nextStartTimeRef.current = nextStartTime + audioBuffer.duration;
                        }

                        if (message.serverContent?.interrupted) {
                            for (const source of sourcesRef.current.values()) {
                                source.stop();
                                sourcesRef.current.delete(source);
                            }
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onclose: () => { setSessionStatus('idle'); },
                    onerror: (err: any) => {
                        const message = err?.message || 'Произошла неизвестная ошибка.';
                        setError(`Произошла ошибка сессии: ${message}`);
                        setSessionStatus('error');
                    },
                }
            });
        } catch (err) {
            const message = (err instanceof Error && err.message) || 'Неизвестная ошибка';
            setError(`Не удалось начать сессию: ${message}. Убедитесь, что вы предоставили доступ к микрофону.`);
            setSessionStatus('error');
            stopSession();
        }
    };
    
    const handleStop = () => {
        stopSession();
        setSessionStatus('idle');
    };

    const handleSaveImage = async (entry: TranscriptEntry) => {
        if (!entry.imageUrl || !entry.promptForSave) return;
        
        setTranscript(prev => prev.map(e => e.id === entry.id ? { ...e, isSaving: true } : e));
        
        try {
            const base64Data = entry.imageUrl.split(',')[1];
            await onSaveGeneratedImage(base64Data, `${entry.promptForSave.substring(0, 30)}.jpg`);
            setTranscript(prev => prev.map(e => e.id === entry.id ? { ...e, isSaving: false, isSaved: true } : e));
        } catch (error) {
            console.error("Failed to save image from copilot:", error);
            setError("Не удалось сохранить изображение.");
             setTranscript(prev => prev.map(e => e.id === entry.id ? { ...e, isSaving: false } : e));
        }
    };

    useEffect(() => {
        return () => {
            if (sessionStatus !== 'idle') stopSession();
        };
    }, [sessionStatus, stopSession]);

    const getStatusInfo = () => {
        switch (sessionStatus) {
            case 'idle': return { text: 'Готов к работе. Нажмите "Начать", чтобы поговорить.', icon: '🎙️', buttonText: 'Начать', buttonAction: handleStart, visualizerClass: {} };
            case 'connecting': return { text: 'Подключение...', icon: '⌛', buttonText: 'Подключение...', buttonAction: () => {}, visualizerClass: {} };
            case 'active': return { text: 'Слушаю... Говорите в микрофон.', icon: '🎧', buttonText: 'Завершить', buttonAction: handleStop, visualizerClass: copilotStyles.visualizerActive };
            case 'error': return { text: error, icon: '⚠️', buttonText: 'Попробовать снова', buttonAction: handleStart, visualizerClass: {} };
            default: return { text: '', icon: '🎙️', buttonText: 'Начать', buttonAction: handleStart, visualizerClass: {} };
        }
    };

    const { text, icon, buttonText, buttonAction, visualizerClass } = getStatusInfo();
    
    return (
        <div style={copilotStyles.container}>
            <div style={{ ...copilotStyles.visualizer, ...visualizerClass }}>{icon}</div>
            
            <div style={copilotStyles.transcriptContainer} className="copilot-transcript-container">
                {transcript.length === 0 && <p style={styles.placeholderText}>Здесь появится расшифровка вашего диалога...<br/><br/>Попробуйте сказать: "Создай идею для поста про скидки на пальто" или "Сгенерируй изображение кота-астронавта".</p>}
                {transcript.map((entry) => (
                    <div 
                        key={entry.id} 
                        style={{...copilotStyles.transcriptEntry, ...(entry.speaker === 'user' ? copilotStyles.transcriptUser : copilotStyles.transcriptModel)}}
                    >
                       <strong>{entry.speaker === 'user' ? 'Вы:' : 'AI:'}</strong> {entry.text}
                       {entry.imageUrl && (
                         <div style={{ marginTop: '10px', position: 'relative' }}>
                            <img src={entry.imageUrl} style={{ maxWidth: '100%', borderRadius: '8px' }} alt={entry.promptForSave} />
                            {!entry.isSaved && (
                                <button
                                    onClick={() => handleSaveImage(entry)}
                                    disabled={entry.isSaving}
                                    style={{...styles.button, position: 'absolute', bottom: '10px', right: '10px', padding: '6px 12px', fontSize: '0.9rem'}}
                                >
                                    {entry.isSaving ? <div style={{...styles.miniLoader, width: '16px', height: '16px', borderTopColor: '#fff'}}></div> : '💾 Сохранить в Базу'}
                                </button>
                            )}
                         </div>
                       )}
                    </div>
                ))}
                <div ref={transcriptEndRef} />
            </div>

            <div style={copilotStyles.controls}>
                <p style={copilotStyles.statusText}>{text}</p>
                 <button 
                    style={{...copilotStyles.copilotButton, ...(sessionStatus === 'active' && copilotStyles.copilotButtonStop)}} 
                    onClick={buttonAction}
                    disabled={sessionStatus === 'connecting'}
                >
                    {buttonText}
                </button>
            </div>
        </div>
    );
};


export const AICopilotModal = () => {
    const { dispatch } = useAppContext();
    return (
        <div style={styles.modalOverlay} onClick={() => dispatch({ type: 'SET_COPILOT_OPEN', payload: false })}>
            <div style={{...styles.modalContent, width: '90%', maxWidth: '800px', height: '80vh'}} onClick={(e) => e.stopPropagation()}>
                 <button style={styles.modalCloseButton} onClick={() => dispatch({ type: 'SET_COPILOT_OPEN', payload: false })}>&times;</button>
                 <div style={styles.modalHeader}>
                    <h2 style={styles.cardTitle}>AI Co-pilot</h2>
                 </div>
                 <div style={{...styles.modalBody, flex: 1, padding: '0'}}>
                    <AICopilotScreen />
                 </div>
            </div>
        </div>
    );
};
