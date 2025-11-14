import React, { useState, useMemo } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { useDataContext } from '../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import { GeneratorScreenLayout } from '../components/GeneratorScreenLayout';
import { AiModelSelector } from '../components/AiModelSelector';
import type { Platform, AiModel } from '../types';


const initialSourceText = `Привет, друзья! 🚀 Мы рады анонсировать запуск нашего нового революционного продукта — SMM AI Ассистента! Это мощный инструмент, который поможет вам автоматизировать создание контента, планировать публикации, анализировать эффективность и управлять медиафайлами. Наша миссия — сделать SMM простым и доступным для каждого. Попробуйте уже сегодня и выведите свои социальные сети на новый уровень! Ссылка в профиле.`;

// Helper to get user-friendly names for platforms
const getPlatformDisplayName = (platform: Platform): string => {
    const names: Record<Platform, string> = {
        instagram: 'Пост для Instagram',
        telegram: 'Пост для Telegram',
        vk: 'Пост для ВКонтакте',
        facebook: 'Пост для Facebook',
        youtube: 'Описание для YouTube',
        tiktok: 'Идея для TikTok',
        twitter: 'Короткий твит',
        linkedin: 'Пост для LinkedIn',
        dzen: 'Статья для Дзен',
    };
    return names[platform] || platform;
};

export const ContentAdapterScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { state: dataState } = useDataContext();

    const availablePlatforms = useMemo(() => dataState.settings.platforms || [], [dataState.settings.platforms]);
    
    // AI settings
    const [model, setModel] = useState<AiModel>('gemini-2.5-flash');
    const [useMemory, setUseMemory] = useState(true);

    const [sourceText, setSourceText] = useState(initialSourceText);
    const [targetPlatform, setTargetPlatform] = useState<Platform>(availablePlatforms[0] || 'telegram');
    const [adaptedText, setAdaptedText] = useState('');
    const [loadingState, setLoadingState] = useState({ isLoading: false, message: '' });
    const [error, setError] = useState('');

    const handleAdapt = async () => {
        if (!sourceText.trim()) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Введите исходный текст для адаптации', type: 'error' } });
            return;
        }

        setLoadingState({ isLoading: true, message: 'Подбираем слова...' });
        setError('');
        setAdaptedText('');

        try {
             const onRetry = (attempt: number) => {
                setLoadingState({ isLoading: true, message: `Модель занята, повторяем попытку (${attempt}/3)...` });
            };
            const result = await fetchWithAuth(`${API_BASE_URL}/api/adapt-content`, {
                method: 'POST',
                body: JSON.stringify({ 
                    sourceText, 
                    targetPlatform: getPlatformDisplayName(targetPlatform),
                    model,
                    useMemory,
                 }),
            }, 3, onRetry);
            setAdaptedText(result.adaptedText);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setError(errorMessage);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setLoadingState({ isLoading: false, message: '' });
        }
    };

    const handleCopy = () => {
        if (!adaptedText) return;
        navigator.clipboard.writeText(adaptedText);
        appDispatch({ type: 'ADD_TOAST', payload: { message: 'Текст скопирован!', type: 'success' } });
    };

    const controls = (
        <div style={{...styles.contentAdapterPanel, border: 'none', padding: 0}}>
            <AiModelSelector
                model={model}
                setModel={setModel}
                useMemory={useMemory}
                setUseMemory={setUseMemory}
                isLoading={loadingState.isLoading}
            />
            <h2 style={{fontWeight: 600}}>1. Исходный текст</h2>
            <textarea
                style={styles.contentAdapterTextarea}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Вставьте сюда ваш текст..."
                disabled={loadingState.isLoading}
            />
             <div>
                <label htmlFor="targetPlatform" style={styles.generatorLabel}>2. Адаптировать для</label>
                <select
                    id="targetPlatform"
                    style={styles.generatorSelect}
                    value={targetPlatform}
                    onChange={(e) => setTargetPlatform(e.target.value as Platform)}
                    disabled={loadingState.isLoading}
                >
                    {availablePlatforms.map(p => <option key={p} value={p}>{getPlatformDisplayName(p)}</option>)}
                </select>
            </div>
             <button
                style={{ ...styles.button, ...styles.buttonPrimary, marginTop: 'auto', padding: '14px' }}
                className="newCampaignButton"
                onClick={handleAdapt}
                disabled={loadingState.isLoading || !sourceText.trim()}
            >
                {loadingState.isLoading ? 'Адаптация...' : '🔄 Адаптировать'}
            </button>
        </div>
    );
    
    const results = (
        <div style={{...styles.contentAdapterPanel, border: 'none', padding: 0}}>
             <h2 style={{fontWeight: 600}}>Результат</h2>
             <div style={styles.contentAdapterResult}>
                {loadingState.isLoading && (
                    <div style={styles.wizardLoadingContainer}>
                        <div style={styles.spinner}></div>
                        <p>{loadingState.message}</p>
                    </div>
                )}
                {error && !loadingState.isLoading && (
                     <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
                        <h4>Ошибка адаптации</h4>
                        <p>{error}</p>
                    </div>
                )}
                {!loadingState.isLoading && !adaptedText && !error && (
                    <EmptyState
                        icon="🔄"
                        title="Адаптер контента"
                        description="Вставьте текст слева, выберите платформу и нажмите 'Адаптировать', чтобы получить новую версию."
                    />
                )}
                {adaptedText && !loadingState.isLoading && (
                    <>
                        <pre style={{fontFamily: 'inherit', fontSize: '15px', whiteSpace: 'pre-wrap'}}>{adaptedText}</pre>
                        <button style={styles.contentAdapterCopyButton} className="copyButton" onClick={handleCopy}>
                            Копировать
                        </button>
                    </>
                )}
             </div>
        </div>
    );

    return <GeneratorScreenLayout controls={controls} results={results} />;
};