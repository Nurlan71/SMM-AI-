import React, { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';

// --- Types ---
interface TrendSource {
    uri: string;
    title: string;
}

interface TrendResult {
    trends: string;
    sources: TrendSource[];
}

export const TrendSpotterScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const [topic, setTopic] = useState('Экологичная мода в 2024 году');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<TrendResult | null>(null);

    const handleFindTrends = async () => {
        if (!topic.trim()) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пожалуйста, введите тему для поиска', type: 'error' } });
            return;
        }

        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const data = await fetchWithAuth(`${API_BASE_URL}/api/find-trends`, {
                method: 'POST',
                body: JSON.stringify({ topic }),
            });
            setResult(data);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setError(errorMessage);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsLoading(false);
        }
    };

    const renderResult = () => {
        if (isLoading) {
            return (
                <div style={styles.wizardLoadingContainer}>
                    <div style={styles.spinner}></div>
                    <p>Анализируем тренды в сети... Это может занять некоторое время.</p>
                </div>
            );
        }
        if (error) {
            return (
                <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
                    <h4>Ошибка поиска</h4>
                    <p>{error}</p>
                </div>
            );
        }
        if (!result) {
            return (
                <EmptyState
                    icon="📈"
                    title="Поиск трендов"
                    description="Введите тему или ключевое слово, чтобы AI нашел самые свежие и актуальные тренды для вашего контент-плана."
                />
            );
        }
        return (
            <div>
                <pre style={styles.trendResultContent}>{result.trends}</pre>
                {result.sources && result.sources.length > 0 && (
                    <div style={styles.trendSourcesContainer}>
                        <h4 style={styles.trendSourcesTitle}>Источники:</h4>
                        {result.sources.map((source, index) => (
                            <a 
                                key={index} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={styles.trendSourceLink}
                            >
                                {index + 1}. {source.title}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={styles.trendSpotterLayout}>
            <div style={styles.trendSearchContainer}>
                <input
                    type="text"
                    style={styles.trendSearchInput}
                    placeholder="Введите тему, например: 'тренды SMM' или 'искусственный интеллект'"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={isLoading}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFindTrends(); }}
                />
                <button
                    style={{ ...styles.button, ...styles.buttonPrimary, padding: '12px 24px' }}
                    onClick={handleFindTrends}
                    disabled={isLoading}
                >
                    {isLoading ? 'Поиск...' : '📈 Найти тренды'}
                </button>
            </div>
            <div style={styles.trendResultsContainer}>
                {renderResult()}
            </div>
        </div>
    );
};