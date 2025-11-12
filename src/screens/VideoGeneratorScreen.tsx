import React, { useState, useEffect, useRef, DragEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';

// --- Types ---
// Fix: Correctly type `window.aistudio` by defining an `AIStudio` interface
// and attaching it to the `Window` object. This resolves conflicts with other
// potential global declarations as indicated by the compiler error.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // Fix: Make `aistudio` optional to resolve a potential modifier conflict with another declaration.
    // This also aligns the type with its usage, as the code checks for its existence.
    aistudio?: AIStudio;
  }
}
type AspectRatio = '16:9' | '9:16';
type Resolution = '720p' | '1080p';

// --- Constants ---
const ASPECT_RATIOS: { value: AspectRatio, label: string }[] = [
    { value: '9:16', label: 'Портрет (9:16)' },
    { value: '16:9', label: 'Пейзаж (16:9)' },
];
const RESOLUTIONS: { value: Resolution, label: string }[] = [
    { value: '720p', label: 'HD (720p)' },
    { value: '1080p', label: 'Full HD (1080p)' },
];
const LOADING_MESSAGES = [
    "Подключаемся к видео-модели...",
    "Анализируем ваш запрос...",
    "Генерация начальных кадров...",
    "Рендеринг основной сцены...",
    "Это может занять несколько минут...",
    "Добавляем последние штрихи...",
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

export const VideoGeneratorScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const [isKeySelected, setIsKeySelected] = useState(false);
    
    // Form state
    const [prompt, setPrompt] = useState('Кот-астронавт в стиле стимпанк, сидит на луне и машет лапой, детализированное видео, 4k');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
    const [resolution, setResolution] = useState<Resolution>('720p');
    const [image, setImage] = useState<{ preview: string; file: File } | null>(null);

    // Generation process state
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
    const [error, setError] = useState('');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    
    const pollIntervalRef = useRef<number | null>(null);

    // Check for API key on mount to avoid asking if already selected
    useEffect(() => {
        const checkApiKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setIsKeySelected(true);
            }
        };
        checkApiKey();

        // Cleanup polling on unmount
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);
    
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
    
    const resetState = () => {
        setIsLoading(false);
        setError('');
        setVideoUrl(null);
        setLoadingMessage(LOADING_MESSAGES[0]);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };

    const pollOperation = (operationId: string) => {
        pollIntervalRef.current = window.setInterval(async () => {
            try {
                const result = await fetchWithAuth(`${API_BASE_URL}/api/video-operation/${operationId}`);
                if (result.done) {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    if (result.response && result.response.generatedVideos) {
                        const uri = result.response.generatedVideos[0].video.uri;
                        setVideoUrl(`${API_BASE_URL}/api/get-video?uri=${encodeURIComponent(uri)}`);
                        setIsLoading(false);
                    } else {
                        throw new Error(result.error?.message || 'Задача завершилась с ошибкой, но видео не было получено.');
                    }
                }
            } catch (err) {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка";
                setError(errorMessage);
                setIsLoading(false);
            }
        }, 10000);
    };

    const handleGenerate = async () => {
        // Step 1: Check for API key right before generation
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            const userAgrees = window.confirm("Для генерации видео требуется API ключ. Хотите выбрать его сейчас?");
            if (userAgrees) {
                await window.aistudio.openSelectKey();
                // After attempting to select, re-check if a key is now available.
                if (!(await window.aistudio.hasSelectedApiKey())) {
                    appDispatch({ type: 'ADD_TOAST', payload: { message: 'Ключ не был выбран. Генерация отменена.', type: 'error' } });
                    return;
                }
            } else {
                // User clicked 'Cancel' on the confirm dialog.
                return;
            }
        }
        // Now that we have a key, update our local state to reflect this.
        setIsKeySelected(true);


        // Step 2: Proceed with existing generation logic
        if (!prompt.trim()) {
            setError('Пожалуйста, введите описание для видео.');
            return;
        }
        resetState();
        setIsLoading(true);

        try {
            const payload: any = { prompt, aspectRatio, resolution };
            if (image) {
                payload.image = await fileToBase64(image.file);
            }

            const initialResponse = await fetchWithAuth(`${API_BASE_URL}/api/generate-video`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            
            const operationName = initialResponse.name;
            if (!operationName || !operationName.startsWith('operations/')) {
                throw new Error("Неверный ответ от сервера при запуске задачи.");
            }

            const operationId = operationName.split('/')[1];
            pollOperation(operationId);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
             if (errorMessage.includes("API ключ недействителен")) {
                setIsKeySelected(false); // Force re-selection of the key for the next attempt
                setError("Выбранный API ключ недействителен или не имеет доступа к Veo. Пожалуйста, выберите другой ключ.");
            } else {
                setError(errorMessage);
            }
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
            setIsLoading(false);
        }
    };
    
    // --- Image Dropzone Handlers ---
    const handleFileSelect = (files: FileList | null) => {
        const file = files?.[0];
        if (file && file.type.startsWith('image/')) {
            setImage({
                preview: URL.createObjectURL(file),
                file: file
            });
        }
    };
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        handleFileSelect(e.dataTransfer.files);
    };

    return (
        <div style={styles.imageGeneratorLayout} className="generatorLayout">
            <div style={styles.imageGeneratorControls}>
                 <h2 style={{fontWeight: 600}}>Создайте видео</h2>
                <p style={{ color: '#6c757d', marginTop: '-10px' }}>Опишите сцену, которую хотите оживить. Вы также можете загрузить стартовое изображение.</p>
                <div>
                    <label htmlFor="prompt" style={styles.generatorLabel}>Описание (промпт)</label>
                    <textarea
                        id="prompt"
                        style={styles.generatorTextarea}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Например: 'Котенок играет с клубком ниток на солнечном подоконнике'"
                        disabled={isLoading}
                    />
                </div>
                
                 <div>
                    <label style={styles.generatorLabel}>Стартовое изображение (опционально)</label>
                    {image ? (
                        <div style={styles.videoGeneratorImagePreviewContainer}>
                            <img src={image.preview} alt="preview" style={styles.videoGeneratorImagePreview} />
                            <button style={styles.videoGeneratorRemoveImageBtn} onClick={() => setImage(null)} disabled={isLoading}>×</button>
                        </div>
                    ) : (
                        <div
                            style={styles.videoGeneratorImageUpload}
                            onClick={() => document.getElementById('video-image-upload')?.click()}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            <input type="file" id="video-image-upload" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileSelect(e.target.files)} disabled={isLoading}/>
                            <span>📤 Перетащите или выберите файл</span>
                        </div>
                    )}
                </div>

                <div style={{display: 'flex', gap: '16px'}}>
                    <div style={{flex: 1}}>
                        <label htmlFor="aspectRatio" style={styles.generatorLabel}>Соотношение сторон</label>
                        <select id="aspectRatio" style={styles.generatorSelect} value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} disabled={isLoading}>
                            {ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </div>
                     <div style={{flex: 1}}>
                        <label htmlFor="resolution" style={styles.generatorLabel}>Разрешение</label>
                        <select id="resolution" style={styles.generatorSelect} value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)} disabled={isLoading}>
                            {RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </div>
                </div>

                <button
                    style={{ ...styles.button, ...styles.buttonPrimary, marginTop: 'auto', padding: '14px' }}
                    className="newCampaignButton"
                    onClick={handleGenerate}
                    disabled={isLoading}
                >
                    {isLoading ? 'Генерация...' : '🎬 Сгенерировать видео'}
                </button>
            </div>
            <div style={styles.imageGeneratorResult}>
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
                {!isLoading && !videoUrl && !error && (
                    <EmptyState
                        icon="🎬"
                        title="Генератор видео"
                        description="Введите описание, выберите настройки и AI создаст для вас уникальное видео."
                    />
                )}
                {videoUrl && !isLoading && (
                    <>
                        <video src={videoUrl} controls style={styles.videoGeneratorResultVideo} />
                        <div style={styles.imageResultActions}>
                            <a href={videoUrl} download="smm-ai-video.mp4" style={{textDecoration: 'none'}}>
                               <button style={{ ...styles.button, ...styles.buttonPrimary }}>
                                    💾 Скачать видео
                                </button>
                            </a>
                             <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={resetState}>
                                🗑️ Очистить
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};