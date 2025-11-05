import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { styles } from '../styles';
import type { AppFile } from '../types';

type AspectRatio = '1:1' | '9:16' | '16:9';

export const ImageGeneratorScreen = () => {
    const { dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();

    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [style, setStyle] = useState('Фотореализм');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedImage, setGeneratedImage] = useState<{ base64: string; url: string } | null>(null);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setError('');
        setGeneratedImage(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const fullPrompt = `${prompt}, в стиле "${style}" ${negativePrompt ? `, избегая: ${negativePrompt}` : ''}`;
            
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: fullPrompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: aspectRatio,
                },
            });

            if (!response.generatedImages || response.generatedImages.length === 0) {
                throw new Error('API не вернуло изображение.');
            }
            
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
            setGeneratedImage({ base64: base64ImageBytes, url: imageUrl });

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Ошибка генерации: ${message}`);
            addToast(`Ошибка генерации: ${message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = () => {
        if (!generatedImage) return;
        const link = document.createElement('a');
        link.href = generatedImage.url;
        link.download = `${prompt.substring(0, 30)}.jpeg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSaveToKnowledgeBase = async () => {
        if (!generatedImage) return;

        try {
            const byteString = atob(generatedImage.base64);
            const mimeString = 'image/jpeg';
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });
            const file = new File([blob], `${prompt.substring(0, 30)}.jpeg`, { type: mimeString });

            const formData = new FormData();
            formData.append('files', file);

            const response = await fetchWithAuth(`${API_BASE_URL}/api/files`, {
                method: 'POST',
                body: formData,
            });
            const uploadedFiles: AppFile[] = await response.json();
            
            if (uploadedFiles.length > 0) {
                 dataDispatch({ type: 'ADD_FILES', payload: uploadedFiles });
                 addToast('Изображение сохранено в Базу знаний!', 'success');
            } else {
                 throw new Error("Сервер не вернул информацию о файле.");
            }
        } catch (error) {
             addToast(error instanceof Error ? error.message : 'Не удалось сохранить изображение.', 'error');
        }
    };

    return (
        <div style={styles.generatorLayout}>
            <div style={styles.generatorControls}>
                <h2 style={styles.cardTitle}>Создать изображение</h2>
                <div style={styles.formGroup}>
                    <label htmlFor="prompt" style={styles.label}>Основной запрос</label>
                    <textarea
                        id="prompt"
                        style={{...styles.textarea, minHeight: '120px'}}
                        placeholder="Например: 'Кот в скафандре, летящий в космосе на фоне туманности'"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                    />
                </div>
                 <div style={styles.formGroup}>
                    <label htmlFor="negative-prompt" style={styles.label}>Негативный промпт (необязательно)</label>
                    <input
                        id="negative-prompt"
                        type="text"
                        style={styles.input}
                        placeholder="Например: 'текст, водяные знаки, размыто'"
                        value={negativePrompt}
                        onChange={e => setNegativePrompt(e.target.value)}
                    />
                </div>
                 <div style={styles.formGroup}>
                    <label style={styles.label}>Соотношение сторон</label>
                    <div style={styles.aspectRatioSelector}>
                        {(['1:1', '9:16', '16:9'] as AspectRatio[]).map(ar => (
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
                 <div style={styles.formGroup}>
                    <label htmlFor="style" style={styles.label}>Стиль</label>
                    <select id="style" style={styles.input} value={style} onChange={e => setStyle(e.target.value)}>
                        <option>Фотореализм</option>
                        <option>Аниме</option>
                        <option>Цифровая живопись</option>
                        <option>Пиксель-арт</option>
                        <option>Акварель</option>
                        <option>3D-рендер</option>
                    </select>
                </div>
                <button style={prompt ? styles.button : styles.buttonDisabled} onClick={handleGenerate} disabled={!prompt || isLoading}>
                    {isLoading ? <div style={styles.miniLoader}></div> : '🎨 Сгенерировать'}
                </button>
            </div>
            <div style={styles.generatorResult}>
                 <h2 style={styles.cardTitle}>Результат</h2>
                <div style={styles.resultBox}>
                    {isLoading && <div style={styles.loader}></div>}
                    {error && <p style={styles.errorText}>{error}</p>}
                    {!isLoading && !generatedImage && <p style={styles.placeholderText}>Здесь появится ваше сгенерированное изображение...</p>}
                    {generatedImage && (
                        <div style={styles.imagePreviewContainer}>
                           <img src={generatedImage.url} alt={prompt} style={styles.generatedImage} />
                            <div style={styles.imageActions}>
                                <button style={styles.imageActionButton} onClick={handleSaveToKnowledgeBase}>💾 Сохранить</button>
                                <button style={styles.imageActionButton} onClick={handleDownload}>📥 Скачать</button>
                                <button style={styles.imageActionButton} onClick={handleGenerate}>🔄 Повторить</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};