import React, { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { useDataContext } from '../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import { AppFile } from '../types';

const ASPECT_RATIOS = [
    { value: '1:1', label: 'Квадрат (1:1)' },
    { value: '16:9', label: 'Пейзаж (16:9)' },
    { value: '9:16', label: 'Портрет (9:16)' },
    { value: '4:3', label: 'Альбом (4:3)' },
    { value: '3:4', label: 'Книга (3:4)' },
];

export const ImageGeneratorScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { dispatch: dataDispatch } = useDataContext();

    const [prompt, setPrompt] = useState('Кот-астронавт в стиле стимпанк, сидит на луне, детализированный, 4k');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Пожалуйста, введите описание для изображения.');
            return;
        }
        setIsLoading(true);
        setError('');
        setGeneratedImage(null);

        try {
            const result = await fetchWithAuth(`${API_BASE_URL}/api/generate-image`, {
                method: 'POST',
                body: JSON.stringify({ prompt, aspectRatio }),
            });
            setGeneratedImage(result.image);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setError(errorMessage);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!generatedImage) return;

        setIsSaving(true);
        try {
            const newFile = await fetchWithAuth(`${API_BASE_URL}/api/files/upload-generated`, {
                method: 'POST',
                body: JSON.stringify({ base64Image: generatedImage, originalPrompt: prompt }),
            });
            dataDispatch({ type: 'ADD_FILES', payload: [newFile] });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Изображение сохранено в Базу знаний!', type: 'success' } });
            // Optional: navigate to knowledge base or clear image
            setGeneratedImage(null);
            appDispatch({ type: 'SET_ACTIVE_SCREEN', payload: 'knowledge-base' });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Не удалось сохранить: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={styles.imageGeneratorLayout} className="generatorLayout">
            <div style={styles.imageGeneratorControls}>
                <h2 style={{fontWeight: 600}}>Создайте изображение</h2>
                <p style={{ color: '#6c757d', marginTop: '-10px' }}>Опишите, что вы хотите увидеть. Чем детальнее описание, тем лучше результат.</p>
                <div>
                    <label htmlFor="prompt" style={styles.generatorLabel}>Описание (промпт)</label>
                    <textarea
                        id="prompt"
                        style={styles.generatorTextarea}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Например: 'Фотореалистичный портрет рыжего кота в очках, читающего книгу'"
                    />
                </div>
                <div>
                    <label htmlFor="aspectRatio" style={styles.generatorLabel}>Соотношение сторон</label>
                    <select
                        id="aspectRatio"
                        style={styles.generatorSelect}
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                    >
                        {ASPECT_RATIOS.map(ratio => (
                            <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                        ))}
                    </select>
                </div>
                <button
                    style={{ ...styles.button, ...styles.buttonPrimary, marginTop: 'auto', padding: '14px' }}
                    className="newCampaignButton"
                    onClick={handleGenerate}
                    disabled={isLoading || isSaving}
                >
                    {isLoading ? 'Генерация...' : '✨ Сгенерировать'}
                </button>
            </div>
            <div style={styles.imageGeneratorResult}>
                {isLoading && (
                     <div style={styles.shimmerPlaceholder}>
                        <div style={styles.shimmerEffect}></div>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#495057' }}>
                            <p>🎨 Создаем шедевр...</p>
                            <p style={{fontSize: '12px'}}>Это может занять до минуты.</p>
                        </div>
                    </div>
                )}
                {error && !isLoading && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
                        <h4>Ошибка генерации</h4>
                        <p>{error}</p>
                    </div>
                )}
                {!isLoading && !generatedImage && !error && (
                    <EmptyState
                        icon="🎨"
                        title="Генератор изображений"
                        description="Введите описание слева, чтобы создать уникальное изображение с помощью AI."
                    />
                )}
                {generatedImage && !isLoading && (
                    <>
                        <img
                            src={`data:image/jpeg;base64,${generatedImage}`}
                            alt="Сгенерированное изображение"
                            style={styles.imageGeneratorResultImage}
                        />
                         <div style={styles.imageResultActions}>
                            <button 
                                style={{ ...styles.button, ...styles.buttonPrimary }}
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Сохранение...' : '💾 Сохранить в Базу знаний'}
                            </button>
                             <button
                                style={{ ...styles.button, ...styles.buttonSecondary }}
                                onClick={() => setGeneratedImage(null)}
                            >
                                🗑️ Очистить
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
