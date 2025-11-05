import React, { useState, useCallback, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { styles } from '../styles';
import type { AppFile } from '../types';

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

const urlToGenerativePart = async (url: string, mimeType: string) => {
     const response = await fetch(url);
     const blob = await response.blob();
     const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
    });
     return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: mimeType },
    };
}


export const ImageEditorScreen = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [sourceImage, setSourceImage] = useState<{ id?: number; url: string; mimeType: string } | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editedImage, setEditedImage] = useState<{ base64: string; url: string } | null>(null);

    const imageFiles = useMemo(() => dataState.files.filter(f => f.mimeType.startsWith('image/')), [dataState.files]);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const handleFileSelect = (file: AppFile) => {
        setSourceImage({ id: file.id, url: file.url, mimeType: file.mimeType });
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSourceImage({ url: reader.result as string, mimeType: file.type });
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleGenerate = async () => {
        if (!prompt || !sourceImage) return;
        setIsLoading(true);
        setError('');
        setEditedImage(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const imagePart = await urlToGenerativePart(sourceImage.url, sourceImage.mimeType);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [imagePart, { text: prompt }],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            const firstPart = response.candidates?.[0]?.content?.parts?.[0];
            if (firstPart && firstPart.inlineData) {
                const base64Data = firstPart.inlineData.data;
                const mimeType = firstPart.inlineData.mimeType;
                setEditedImage({ base64: base64Data, url: `data:${mimeType};base64,${base64Data}` });
            } else {
                 throw new Error("Не удалось получить изображение от AI.");
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Ошибка редактирования: ${message}`);
            addToast(`Ошибка редактирования: ${message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSaveToKnowledgeBase = async () => {
        if (!editedImage) return;

        try {
            const byteString = atob(editedImage.base64);
            const mimeString = 'image/jpeg'; // Assuming JPEG output
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });
            const file = new File([blob], `edited-${Date.now()}.jpeg`, { type: mimeString });

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
        <div style={styles.editorLayout}>
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            {/* Left Panel: Controls */}
            <div style={styles.editorControls}>
                <h2 style={styles.cardTitle}>1. Выберите источник</h2>
                <button style={styles.button} onClick={() => fileInputRef.current?.click()}>Загрузить с компьютера</button>
                <div style={styles.formGroup}>
                     <label style={styles.label}>Или выберите из Базы знаний</label>
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
                </div>
                 <div style={{...styles.formGroup, marginTop: 'auto'}}>
                     <label htmlFor="prompt" style={styles.label}>2. Опишите правки</label>
                     <textarea
                        id="prompt"
                        style={{...styles.textarea, minHeight: '80px'}}
                        placeholder="Например: 'добавь смешную шляпу' или 'сделай фон более ярким'"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                    />
                 </div>
                 <button style={prompt && sourceImage ? styles.button : styles.buttonDisabled} onClick={handleGenerate} disabled={!prompt || !sourceImage || isLoading}>
                    {isLoading ? <div style={styles.miniLoader}></div> : '🪄 Применить магию'}
                </button>
            </div>

            {/* Center Panel: Canvas */}
            <div style={styles.editorCanvas}>
                {!sourceImage ? (
                    <p style={styles.placeholderText}>Выберите изображение для начала работы</p>
                ) : (
                    <img src={sourceImage.url} alt="Source" style={styles.generatedImage} />
                )}
            </div>

            {/* Right Panel: Result */}
            <div style={styles.editorResult}>
                 <h2 style={styles.cardTitle}>Результат</h2>
                 <div style={styles.resultBox}>
                    {isLoading && <div style={styles.loader}></div>}
                    {error && <p style={styles.errorText}>{error}</p>}
                    {!isLoading && !editedImage && <p style={styles.placeholderText}>Здесь появится отредактированное изображение...</p>}
                    {editedImage && (
                        <div style={styles.imagePreviewContainer}>
                           <img src={editedImage.url} alt="Edited result" style={styles.generatedImage} />
                            <div style={styles.imageActions}>
                                <button style={styles.imageActionButton} onClick={handleSaveToKnowledgeBase}>💾 Сохранить</button>
                                 <a href={editedImage.url} download={`edited-${Date.now()}.jpeg`} style={styles.imageActionButton}>📥 Скачать</a>
                            </div>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    );
};
