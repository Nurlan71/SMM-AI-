import React, { useState, useEffect } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { useDataContext } from '../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import { GeneratorScreenLayout } from '../components/GeneratorScreenLayout';
import { PromptLibrary, HistoryItem } from '../components/PromptLibrary';

const ASPECT_RATIOS = [
    { value: '1:1', label: 'Квадрат (1:1)' },
    { value: '16:9', label: 'Пейзаж (16:9)' },
    { value: '9:16', label: 'Портрет (9:16)' },
    { value: '4:3', label: 'Альбом (4:3)' },
    { value: '3:4', label: 'Книга (3:4)' },
];

const TEMPLATES = [
    { id: '1', text: 'Кот-астронавт в стиле стимпанк, сидит на луне, детализированный, 4k' },
    { id: '2', text: 'Логотип для кофейни "Утренний луч", минимализм, вектор' },
    { id: '3', text: 'Фотореалистичный пейзаж, горы на рассвете, туман в долине' },
];
const HISTORY_KEY = 'smm_ai_image_history';

export const ImageGeneratorScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { dispatch: dataDispatch } = useDataContext();

    const [prompt, setPrompt] = useState('Кот-астронавт в стиле стимпанк, сидит на луне, детализированный, 4k');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [loadingState, setLoadingState] = useState({ isLoading: false, message: '' });
    const [error, setError] = useState('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    useEffect(() => {
        const savedHistory = localStorage.getItem(HISTORY_KEY);
        if (savedHistory) {
            setHistory(JSON.parse(savedHistory));
        }
    }, []);

    const addToHistory = (item: HistoryItem) => {
        const newHistory = [item, ...history.filter(h => h.id !== item.id)].slice(0, 5);
        setHistory(newHistory);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Пожалуйста, введите описание для изображения.');
            return;
        }
        setLoadingState({ isLoading: true, message: '🎨 Создаем шедевр...' });
        setError('');
        setGeneratedImage(null);

        try {
            const onRetry = (attempt: number) => {
                setLoadingState({ isLoading: true, message: `Модель занята, повторяем попытку (${attempt}/3)...` });
            };
            const result = await fetchWithAuth(`${API_BASE_URL}/api/generate-image`, {
                method: 'POST',
                body: JSON.stringify({ prompt, aspectRatio }),
            }, 3, onRetry);
            
            setGeneratedImage(result.image);
            addToHistory({ id: Date.now().toString(), text: prompt });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setError(errorMessage);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setLoadingState({ isLoading: false, message: '' });
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
            setGeneratedImage(null);
            appDispatch({ type: 'SET_ACTIVE_SCREEN', payload: 'knowledge-base' });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Не удалось сохранить: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsSaving(false);
        }
    };

    const controls = (
        <>
            <h2 style={{fontWeight: 600}}>Создайте изображение</h2>
            <p style={{ color: '#6c757d' }}>Опишите, что вы хотите увидеть. Чем детальнее описание, тем лучше результат.</p>
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

            <PromptLibrary
                templates={TEMPLATES}
                history={history}
                onSelect={(text) => setPrompt(text)}
            />

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
                disabled={loadingState.isLoading || isSaving}
            >
                {loadingState.isLoading ? 'Генерация...' : '✨ Сгенерировать'}
            </button>
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
                    <h4>Ошибка генерации</h4>
                    <p>{error}</p>
                </div>
            )}
            {!loadingState.isLoading && !generatedImage && !error && (
                <EmptyState
                    icon="🎨"
                    title="Генератор изображений"
                    description="Введите описание слева, чтобы создать уникальное изображение с помощью AI."
                />
            )}
            {generatedImage && !loadingState.isLoading && (
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
        </>
    );

    return <GeneratorScreenLayout controls={controls} results={results} />;
};