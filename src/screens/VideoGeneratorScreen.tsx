import React, { useState, useCallback, useMemo, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { styles } from '../styles';
import type { AppFile } from '../types';

// Helper to convert URL to Base64 string for the API
const urlToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
    });
};

type AspectRatio = '16:9' | '9:16';
type Resolution = '720p';

export const VideoGeneratorScreen = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();

    const [prompt, setPrompt] = useState('');
    const [sourceImage, setSourceImage] = useState<{ id?: number; url: string; mimeType: string } | null>(null);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
    const [resolution, setResolution] = useState<Resolution>('720p');
    
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState('');
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const imageFiles = useMemo(() => dataState.files.filter(f => f.mimeType.startsWith('image/')), [dataState.files]);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const handleGenerate = async () => {
        if (!prompt && !sourceImage) {
            setError('Нужен хотя бы промпт или исходное изображение.');
            return;
        }
        setIsLoading(true);
        setError('');
        setGeneratedVideoUrl(null);
        
        const loadingMessages = [
            'Создаем раскадровку вашего будущего видео...',
            'Подбираем идеальные кадры...',
            'AI-магия в процессе. Это может занять несколько минут...',
            'Рендеринг видео. Почти готово!',
            'Завершаем обработку...'
        ];
        let messageIndex = 0;
        setLoadingMessage(loadingMessages[messageIndex]);
        const messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            setLoadingMessage(loadingMessages[messageIndex]);
        }, 8000); // Change message every 8 seconds

        try {
            // NOTE: Per instructions, create a new GoogleGenAI instance right before an API call
            // to ensure it uses the most up-to-date API key from a selection dialog.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const payload: any = {
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                config: {
                    numberOfVideos: 1,
                    resolution: resolution,
                    aspectRatio: aspectRatio,
                }
            };

            if (sourceImage) {
                const base64Image = await urlToBase64(sourceImage.url);
                payload.image = {
                    imageBytes: base64Image,
                    mimeType: sourceImage.mimeType,
                };
            }

            let operation = await ai.models.generateVideos(payload);

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }

            if (operation.error) {
                // FIX: Explicitly cast the error message to a string to satisfy TypeScript.
                throw new Error(String(operation.error.message) || 'Произошла ошибка во время генерации.');
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) {
                throw new Error("Не удалось получить ссылку на сгенерированное видео.");
            }
            
            // The download link needs the API key
            const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            if (!videoResponse.ok) {
                throw new Error("Не удалось скачать видеофайл.");
            }

            const videoBlob = await videoResponse.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            setGeneratedVideoUrl(videoUrl);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Ошибка генерации: ${message}`);
            addToast(`Ошибка генерации: ${message}`, 'error');
        } finally {
            setIsLoading(false);
            clearInterval(messageInterval);
            setLoadingMessage('');
        }
    };
    
    const handleSaveToKnowledgeBase = async () => {
        if (!generatedVideoUrl) return;

        try {
            const videoBlob = await fetch(generatedVideoUrl).then(res => res.blob());
            const fileName = `${prompt.substring(0, 30) || 'generated-video'}.mp4`;
            const file = new File([videoBlob], fileName, { type: 'video/mp4' });

            const formData = new FormData();
            formData.append('files', file);

            const response = await fetchWithAuth(`${API_BASE_URL}/api/files`, {
                method: 'POST',
                body: formData,
            });
            const uploadedFiles: AppFile[] = await response.json();
            
            if (uploadedFiles.length > 0) {
                 dataDispatch({ type: 'ADD_FILES', payload: uploadedFiles });
                 addToast('Видео сохранено в Базу знаний!', 'success');
            } else {
                 throw new Error("Сервер не вернул информацию о файле.");
            }
        } catch (error) {
             addToast(error instanceof Error ? error.message : 'Не удалось сохранить видео.', 'error');
        }
    };

    const handleFileSelect = (file: AppFile) => {
        setSourceImage({ id: file.id, url: file.url, mimeType: file.mimeType });
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSourceImage({ url: reader.result as string, mimeType: file.type });
            };
            reader.readAsDataURL(file);
        } else {
            addToast('Пожалуйста, выберите файл изображения.', 'error');
        }
    };

    return (
        <div style={styles.generatorLayout}>
            <div style={styles.generatorControls}>
                <h2 style={styles.cardTitle}>Создать видео</h2>
                <div style={styles.formGroup}>
                    <label htmlFor="prompt" style={styles.label}>Основной запрос</label>
                    <textarea
                        id="prompt"
                        style={{...styles.textarea, minHeight: '120px'}}
                        placeholder="Например: 'Кот в скафандре летит сквозь космос'"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                    />
                </div>
                
                <div style={styles.formGroup}>
                    <label style={styles.label}>Исходное изображение (необязательно)</label>
                    <button style={{...styles.button, backgroundColor: '#f8f9fa', color: '#333', border: '1px solid #ced4da' }} onClick={() => fileInputRef.current?.click()}>Загрузить изображение</button>
                    {imageFiles.length > 0 && (
                        <>
                            <p style={{textAlign: 'center', color: '#6c757d', margin: '8px 0'}}>или выберите из Базы знаний</p>
                            <div style={styles.knowledgeBaseGrid}>
                                {imageFiles.map(file => (
                                    <div 
                                        key={file.id} 
                                        style={{
                                            ...styles.knowledgeBaseThumb,
                                            backgroundImage: `url(${file.url})`,
                                            ...(sourceImage?.id === file.id && styles.knowledgeBaseThumbActive)
                                        }}
                                        onClick={() => handleFileSelect(file)}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                    {sourceImage && (
                        <div style={{...styles.imagePreviewContainer, height: '100px', marginTop: '10px', border: '1px solid #ced4da', borderRadius: '8px'}}>
                            <img src={sourceImage.url} alt="Выбранное изображение" style={{...styles.generatedImage, objectFit: 'cover', width: '100%', height: '100%'}} />
                            <button onClick={() => setSourceImage(null)} style={{position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer'}}>×</button>
                        </div>
                    )}
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Соотношение сторон</label>
                    <div style={styles.aspectRatioSelector}>
                        {(['16:9', '9:16'] as AspectRatio[]).map(ar => (
                             <button
                                key={ar}
                                style={aspectRatio === ar ? styles.aspectRatioButtonActive : styles.aspectRatioButton}
                                onClick={() => setAspectRatio(ar)}
                            >
                                {ar}
                            </button>
                        ))}
                    </div>
                </div>

                <button style={(prompt || sourceImage) ? styles.button : styles.buttonDisabled} onClick={handleGenerate} disabled={(!prompt && !sourceImage) || isLoading}>
                    {isLoading ? <div style={styles.miniLoader}></div> : '🎬 Сгенерировать'}
                </button>
            </div>
            <div style={styles.generatorResult}>
                 <h2 style={styles.cardTitle}>Результат</h2>
                <div style={styles.resultBox}>
                    {isLoading && (
                        <div style={{textAlign: 'center'}}>
                            <div style={styles.loader}></div>
                            <p style={{...styles.placeholderText, marginTop: '20px', fontWeight: 600}}>{loadingMessage}</p>
                        </div>
                    )}
                    {error && <p style={styles.errorText}>{error}</p>}
                    {!isLoading && !generatedVideoUrl && <p style={styles.placeholderText}>Здесь появится ваше сгенерированное видео...</p>}
                    {generatedVideoUrl && (
                        <div style={styles.imagePreviewContainer}>
                           <video src={generatedVideoUrl} controls style={styles.generatedVideo} />
                            <div style={styles.imageActions}>
                                <button style={styles.imageActionButton} onClick={handleSaveToKnowledgeBase}>💾 Сохранить</button>
                                <a href={generatedVideoUrl} download="generated-video.mp4" style={styles.imageActionButton}>📥 Скачать</a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>
    );
};