import React, { useState, useRef, DragEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { useDataContext } from '../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import type { AppFile } from '../types';
import { MediaLibraryPickerModal } from '../components/modals/MediaLibraryPickerModal';
import { GeneratorScreenLayout } from '../components/GeneratorScreenLayout';

// --- Helper Functions ---
const fileToDataPayload = (file: File): Promise<{data: string, mimeType: string, preview: string}> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const preview = reader.result as string;
            const data = preview.split(',')[1];
            resolve({ data, mimeType: file.type, preview });
        };
        reader.onerror = error => reject(error);
    });
};

const urlToDataPayload = async (url: string): Promise<{data: string, mimeType: string, preview: string}> => {
    const response = await fetch(`${API_BASE_URL}${url}`);
    const blob = await response.blob();
    const file = new File([blob], url.split('/').pop() || 'image', { type: blob.type });
    return fileToDataPayload(file);
}

// --- Types ---
interface OriginalImage {
    data: string;
    mimeType: string;
    preview: string;
}

export const ImageEditorScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { dispatch: dataDispatch } = useDataContext();

    const [originalImage, setOriginalImage] = useState<OriginalImage | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('Сделай фон похожим на космос с туманностями');
    const [loadingState, setLoadingState] = useState({ isLoading: false, message: '' });
    const [error, setError] = useState('');
    const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setOriginalImage(null);
        setEditedImage(null);
        setPrompt('Сделай фон похожим на космос с туманностями');
        setLoadingState({ isLoading: false, message: '' });
        setError('');
    };

    const handleFileSelect = async (files: FileList | null) => {
        const file = files?.[0];
        if (file && file.type.startsWith('image/')) {
            try {
                const payload = await fileToDataPayload(file);
                setOriginalImage(payload);
                setEditedImage(null);
                setError('');
            } catch (err) {
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Не удалось прочитать файл.', type: 'error' } });
            }
        }
    };
    
    const handleImageFromPicker = async (selectedFiles: AppFile[]) => {
         setIsMediaPickerOpen(false);
         const file = selectedFiles[0];
         if (file) {
             try {
                const payload = await urlToDataPayload(file.url);
                setOriginalImage(payload);
                setEditedImage(null);
                setError('');
             } catch (err) {
                 appDispatch({ type: 'ADD_TOAST', payload: { message: 'Не удалось загрузить изображение из базы.', type: 'error' } });
             }
         }
    };

    const handleGenerate = async () => {
        if (!originalImage) return;
        
        setLoadingState({ isLoading: true, message: '🪄 Применяем магию...' });
        setError('');
        setEditedImage(null);

        try {
            const onRetry = (attempt: number) => {
                setLoadingState({ isLoading: true, message: `Модель занята, повторяем попытку (${attempt}/3)...` });
            };
            const result = await fetchWithAuth(`${API_BASE_URL}/api/edit-image`, {
                method: 'POST',
                body: JSON.stringify({ image: { data: originalImage.data, mimeType: originalImage.mimeType }, prompt }),
            }, 3, onRetry);
            setEditedImage(result.image);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setError(errorMessage);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setLoadingState({ isLoading: false, message: '' });
        }
    };

    const handleSave = async () => {
        if (!editedImage) return;
        const finalPrompt = prompt || "Отредактированное изображение";
        
        try {
            const newFile = await fetchWithAuth(`${API_BASE_URL}/api/files/upload-generated`, {
                method: 'POST',
                body: JSON.stringify({ base64Image: editedImage, originalPrompt: `(edit) ${finalPrompt}` }),
            });
            dataDispatch({ type: 'ADD_FILES', payload: [newFile] });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Изображение сохранено в Базу знаний!', type: 'success' } });
        } catch (err) {
             const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Не удалось сохранить: ${errorMessage}`, type: 'error' } });
        }
    };
    
    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        handleFileSelect(e.dataTransfer.files);
    };

    const controls = (
        <>
            {!originalImage ? (
                <div style={styles.imageEditorImageUpload}>
                    <h2 style={{fontWeight: 600}}>1. Выберите изображение</h2>
                    <div
                        style={styles.imageEditorDropzone}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <p style={{fontSize: '2rem'}}>📤</p>
                        <h3 style={{fontWeight: 600, color: '#0056b3'}}>Перетащите файл сюда</h3>
                        <p style={{color: '#495057'}}>или нажмите, чтобы выбрать</p>
                    </div>
                     <button
                        style={{...styles.button, ...styles.buttonSecondary}}
                        onClick={() => setIsMediaPickerOpen(true)}
                    >
                        📚 Выбрать из Базы знаний
                    </button>
                    <input type="file" ref={fileInputRef} onChange={(e) => handleFileSelect(e.target.files)} style={{display: 'none'}} accept="image/*"/>
                </div>
            ) : (
                <>
                    <div>
                         <h2 style={{fontWeight: 600, marginBottom: '16px'}}>Редактирование</h2>
                         <div style={styles.imageEditorOriginalPreview}>
                            <img src={originalImage.preview} alt="Original" style={{...styles.imageEditorImage, borderRadius: '4px'}}/>
                         </div>
                    </div>
                    <div>
                        <label htmlFor="prompt" style={styles.generatorLabel}>2. Опишите, что нужно изменить</label>
                        <textarea
                            id="prompt"
                            style={styles.generatorTextarea}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Например: 'добавь коту шляпу' или 'сделай фон в стиле стимпанк'"
                            rows={4}
                        />
                    </div>
                    <div style={{marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                         <button
                            style={{ ...styles.button, ...styles.buttonPrimary, padding: '14px' }}
                            className="newCampaignButton"
                            onClick={handleGenerate}
                            disabled={loadingState.isLoading || !prompt.trim()}
                        >
                            {loadingState.isLoading ? 'Магия в процессе...' : '✨ Применить магию'}
                        </button>
                        <button
                            style={{ ...styles.button, ...styles.buttonSecondary }}
                            onClick={resetState}
                            disabled={loadingState.isLoading}
                        >
                            Начать заново
                        </button>
                    </div>
                </>
            )}
        </>
    );
    
    const results = (
        <>
            {loadingState.isLoading && (
                 <div style={styles.shimmerPlaceholder}>
                    <div style={styles.shimmerEffect}></div>
                     <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#495057' }}>
                        <p>{loadingState.message}</p>
                        <p style={{fontSize: '12px'}}>Это может занять до минуты.</p>
                    </div>
                </div>
            )}
            {error && !loadingState.isLoading && (
                 <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
                    <h4>Ошибка редактирования</h4>
                    <p>{error}</p>
                </div>
            )}
            {editedImage && !loadingState.isLoading && (
                 <>
                    <img src={`data:image/jpeg;base64,${editedImage}`} alt="Edited" style={styles.imageEditorImage}/>
                     <div style={styles.imageResultActions}>
                        <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={handleSave}>
                            💾 Сохранить
                        </button>
                        <a href={`data:image/jpeg;base64,${editedImage}`} download={`edited-${Date.now()}.jpg`} style={{textDecoration: 'none'}}>
                             <button style={{ ...styles.button, ...styles.buttonSecondary }}>
                                📥 Скачать
                            </button>
                        </a>
                    </div>
                </>
            )}
            {originalImage && !editedImage && !loadingState.isLoading && !error && (
                <img src={originalImage.preview} alt="Original to be edited" style={styles.imageEditorImage}/>
            )}
            {!originalImage && !loadingState.isLoading && (
                <EmptyState
                    icon="🪄"
                    title="Редактор изображений"
                    description="Загрузите изображение и опишите, какие изменения вы хотите внести."
                />
            )}
        </>
    );

    return (
        <>
            <GeneratorScreenLayout controls={controls} results={results} />
            {isMediaPickerOpen && (
                <MediaLibraryPickerModal
                    onClose={() => setIsMediaPickerOpen(false)}
                    onAttach={handleImageFromPicker}
                    initiallySelectedUrls={[]}
                />
            )}
        </>
    );
};