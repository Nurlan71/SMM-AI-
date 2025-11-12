import React, { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';

// --- Types & Constants ---
type TargetPlatform = 'Telegram Post' | 'Instagram Story Idea' | 'VK Post' | 'Short Tweet';

const PLATFORMS: TargetPlatform[] = [
    'Telegram Post',
    'Instagram Story Idea',
    'VK Post',
    'Short Tweet',
];

const initialSourceText = `Привет, друзья! 🚀 Мы рады анонсировать запуск нашего нового революционного продукта — SMM AI Ассистента! Это мощный инструмент, который поможет вам автоматизировать создание контента, планировать публикации, анализировать эффективность и управлять медиафайлами. Наша миссия — сделать SMM простым и доступным для каждого. Попробуйте уже сегодня и выведите свои социальные сети на новый уровень! Ссылка в профиле.`;

export const ContentAdapterScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const [sourceText, setSourceText] = useState(initialSourceText);
    const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>('Telegram Post');
    const [adaptedText, setAdaptedText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAdapt = async () => {
        if (!sourceText.trim()) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Введите исходный текст для адаптации', type: 'error' } });
            return;
        }

        setIsLoading(true);
        setError('');
        setAdaptedText('');

        try {
            const result = await fetchWithAuth(`${API_BASE_URL}/api/adapt-content`, {
                method: 'POST',
                body: JSON.stringify({ sourceText, targetPlatform }),
            });
            setAdaptedText(result.adaptedText);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setError(errorMessage);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        if (!adaptedText) return;
        navigator.clipboard.writeText(adaptedText);
        appDispatch({ type: 'ADD_TOAST', payload: { message: 'Текст скопирован!', type: 'success' } });
    };

    return (
        <div style={styles.contentAdapterLayout}>
            {/* Left Panel: Controls */}
            <div style={styles.contentAdapterPanel}>
                <h2 style={{fontWeight: 600}}>1. Исходный текст</h2>
                <textarea
                    style={styles.contentAdapterTextarea}
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder="Вставьте сюда ваш текст..."
                    disabled={isLoading}
                />
                 <div>
                    <label htmlFor="targetPlatform" style={styles.generatorLabel}>2. Адаптировать для</label>
                    <select
                        id="targetPlatform"
                        style={styles.generatorSelect}
                        value={targetPlatform}
                        onChange={(e) => setTargetPlatform(e.target.value as TargetPlatform)}
                        disabled={isLoading}
                    >
                        {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                 <button
                    style={{ ...styles.button, ...styles.buttonPrimary, marginTop: 'auto', padding: '14px' }}
                    className="newCampaignButton"
                    onClick={handleAdapt}
                    disabled={isLoading || !sourceText.trim()}
                >
                    {isLoading ? 'Адаптация...' : '🔄 Адаптировать'}
                </button>
            </div>
            
            {/* Right Panel: Result */}
            <div style={styles.contentAdapterPanel}>
                 <h2 style={{fontWeight: 600}}>Результат</h2>
                 <div style={styles.contentAdapterResult}>
                    {isLoading && (
                        <div style={styles.wizardLoadingContainer}>
                            <div style={styles.spinner}></div>
                            <p>Подбираем слова...</p>
                        </div>
                    )}
                    {error && !isLoading && (
                         <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
                            <h4>Ошибка адаптации</h4>
                            <p>{error}</p>
                        </div>
                    )}
                    {!isLoading && !adaptedText && !error && (
                        <EmptyState
                            icon="🔄"
                            title="Адаптер контента"
                            description="Вставьте текст слева, выберите платформу и нажмите 'Адаптировать', чтобы получить новую версию."
                        />
                    )}
                    {adaptedText && !isLoading && (
                        <>
                            <pre style={{fontFamily: 'inherit', fontSize: '15px'}}>{adaptedText}</pre>
                            <button style={styles.contentAdapterCopyButton} className="copyButton" onClick={handleCopy}>
                                Копировать
                            </button>
                        </>
                    )}
                 </div>
            </div>
        </div>
    );
};