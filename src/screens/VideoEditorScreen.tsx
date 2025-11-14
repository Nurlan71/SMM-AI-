import React, { useState, useRef, useEffect, DragEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import { GeneratorScreenLayout } from '../components/GeneratorScreenLayout';
import { MediaLibraryPickerModal } from '../components/modals/MediaLibraryPickerModal';
import type { AppFile } from '../types';

// --- Types ---
type AspectRatio = '16:9' | '9:16';
type Resolution = '720p' | '1080p';

// --- Constants ---
const LOADING_MESSAGES = [
    "Подключаемся к видео-модели...",
    "Извлекаем первый кадр...",
    "Анализируем ваш запрос...",
    "Генерация начальных кадров...",
    "Рендеринг основной сцены...",
    "Это может занять несколько минут...",
    "Почти готово!",
];

// --- Helper Functions ---
const fileToBase64 = (file: File): Promise<{data: string, mimeType: string}> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const data = result.split(',')[1];
            resolve({ data, mimeType: file.type });
        };
        reader.onerror = error => reject(error);
    });
};

export const VideoEditorScreen = () => {
    const { dispatch: appDispatch } = useAppContext();

    // Form and input state
    const [prompt, setPrompt] = useState('Сделай видео в стиле киберпанк, добавь неоновые огни.');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
    const [resolution, setResolution] = useState<Resolution>('720p');
    const [sourceVideoUrl, setSourceVideoUrl] = useState<string | null>(null);
    const [firstFrame, setFirstFrame] = useState<{ data: string, mimeType: string } | null>(null);

    // Generation process state
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
    const [error, setError] = useState('');
    const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
    const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
    
    const pollIntervalRef = useRef<number | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Update loading message
    useEffect(() => {
        let messageInterval: number;
        if (isLoading) {
            let i = 0;
            messageInterval = window.setInterval(() => {
                i = (i + 1) % LOADING_MESSAGES.length;
                setLoadingMessage(LOADING_MESSAGES[i]);
            }, 4000);
        }
        return () => clearInterval(messageInterval);
    }, [isLoading]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (sourceVideoUrl) URL.revokeObjectURL(sourceVideoUrl);
        };
    }, [sourceVideoUrl]);

    const resetState = () => {
        setIsLoading(false);
        setError('');
        setResultVideoUrl(null);
        setSourceVideoUrl(null);
        setFirstFrame(null);
        setLoadingMessage(LOADING_MESSAGES[0]);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
    
    const handleVideoSelect = (file: File | null) => {
        if (file && file.type.startsWith('video/')) {
            resetState();
            const url = URL.createObjectURL(file);
            setSourceVideoUrl(url);
        }
    };
    
    const handleVideoFromPicker = (selectedFiles: AppFile[]) => {
        setIsMediaPickerOpen(false);
        const file = selectedFiles[0];
        if (file && file.mimeType.startsWith('video/')) {
            resetState();
            setSourceVideoUrl(`${API_BASE_URL}${file.url}`);
        }
    };

    const captureFirstFrame = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const dataUrl = canvas.toDataURL('image/jpeg');
                const data = dataUrl.split(',')[1];
                setFirstFrame({ data, mimeType: 'image/jpeg' });
            }
        }
    };

    const pollOperation = (operationId: string) => {
        pollIntervalRef.current = window.setInterval(async () => {
            try {
                const result = await fetchWithAuth(`${API_BASE_URL}/api/video-operation/${operationId}`);
                if (result.done) {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    if (result.response?.generatedVideos) {
                        const uri = result.response.generatedVideos[0].video.uri;
                        setResultVideoUrl(`${API_BASE_URL}/api/get-video?uri=${encodeURIComponent(uri)}`);
                        setIsLoading(false);
                    } else {
                        throw new Error(result.error?.message || 'Задача завершилась, но видео не было получено.');
                    }
                }
            } catch (err) {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                setError(err instanceof Error ? err.message : "Неизвестная ошибка");
                setIsLoading(false);
            }
        }, 10000);
    };

    const handleGenerate = async () => {
        if (!prompt.trim() || !firstFrame) {
            setError('Пожалуйста, введите описание и убедитесь, что кадр из видео захвачен.');
            return;
        }
        setIsLoading(true);
        setError('');
        setResultVideoUrl(null);

        try {
            const payload = { prompt, aspectRatio, resolution, image: firstFrame };
            const initialResponse = await fetchWithAuth(`${API_BASE_URL}/api/generate-video`, {
                method: 'POST', body: JSON.stringify(payload),
            });
            const operationId = initialResponse.name.split('/')[1];
            pollOperation(operationId);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setError(errorMessage);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
            setIsLoading(false);
        }
    };

    const handleDrop = (e: DragEvent) => { e.preventDefault(); handleVideoSelect(e.dataTransfer.files?.[0] || null); };

    const controls = (
        <>
            {!sourceVideoUrl ? (
                <div style={styles.imageEditorImageUpload}>
                    <h2 style={{fontWeight: 600}}>1. Выберите видео</h2>
                    <div
                        style={styles.imageEditorDropzone}
                        onClick={() => document.getElementById('video-editor-upload')?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <p style={{fontSize: '2rem'}}>📤</p>
                        <h3 style={{fontWeight: 600, color: '#0056b3'}}>Перетащите видео сюда</h3>
                        <p style={{color: '#495057'}}>или нажмите, чтобы выбрать</p>
                    </div>
                     <button
                        style={{...styles.button, ...styles.buttonSecondary}}
                        onClick={() => setIsMediaPickerOpen(true)}
                    >
                        📚 Выбрать из Базы знаний
                    </button>
                    <input type="file" id="video-editor-upload" onChange={(e) => handleVideoSelect(e.target.files?.[0] || null)} style={{display: 'none'}} accept="video/*"/>
                </div>
            ) : (
                <>
                    <h2 style={{fontWeight: 600}}>Редактирование видео</h2>
                    <video ref={videoRef} src={sourceVideoUrl} style={{width: '100%', borderRadius: '8px'}} onLoadedData={captureFirstFrame} controls muted />
                    <div>
                        <label htmlFor="prompt" style={styles.generatorLabel}>2. Опишите, как трансформировать видео</label>
                        <textarea
                            id="prompt" style={styles.generatorTextarea} value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Например: 'преврати это в мультфильм' или 'добавь эффект старой пленки'"
                            rows={4} disabled={isLoading}
                        />
                    </div>
                     <div style={{marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                         <button
                            style={{ ...styles.button, ...styles.buttonPrimary, padding: '14px' }}
                            className="newCampaignButton" onClick={handleGenerate}
                            disabled={isLoading || !firstFrame}
                        >
                            {isLoading ? 'Трансформация...' : '✨ Трансформировать'}
                        </button>
                        <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={resetState} disabled={isLoading}>
                            Выбрать другое видео
                        </button>
                    </div>
                </>
            )}
        </>
    );

    const results = (
         <>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {isLoading && (
                 <div style={{ textAlign: 'center', color: '#495057' }}>
                    <div style={styles.spinner}></div>
                    <p style={{marginTop: '16px', fontWeight: 500}}>{loadingMessage}</p>
                </div>
            )}
            {error && !isLoading && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
                    <h4>Ошибка генерации</h4>
                    <p>{error}</p>
                </div>
            )}
            {!isLoading && !resultVideoUrl && !error && (
                <EmptyState
                    icon="✂️"
                    title="Редактор видео"
                    description="Загрузите видео и опишите, как вы хотите его трансформировать. AI использует первый кадр как основу для нового ролика."
                />
            )}
            {resultVideoUrl && !isLoading && (
                <>
                    <video src={resultVideoUrl} controls style={styles.videoGeneratorResultVideo} />
                    <div style={styles.imageResultActions}>
                        <a href={resultVideoUrl} download="smm-ai-edited-video.mp4" style={{textDecoration: 'none'}}>
                           <button style={{ ...styles.button, ...styles.buttonPrimary }}>💾 Скачать</button>
                        </a>
                         <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={resetState}>Очистить</button>
                    </div>
                </>
            )}
         </>
    );

    return (
        <>
            <GeneratorScreenLayout controls={controls} results={results} />
            {isMediaPickerOpen && (
                <MediaLibraryPickerModal
                    onClose={() => setIsMediaPickerOpen(false)}
                    onAttach={handleVideoFromPicker}
                    initiallySelectedUrls={[]}
                />
            )}
        </>
    );
};
