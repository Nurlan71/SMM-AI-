import React, { useState, useCallback, useEffect } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';

// --- Types ---
interface TrendSource {
    uri: string;
    title: string;
}

interface TrendData {
    mainTrend: {
        title: string;
        description: string;
    };
    relatedTopics: string[];
    keyHashtags: string[];
    contentIdeas: string[];
}

interface TrendResult {
    trends: TrendData;
    sources: TrendSource[];
}

// --- Constants ---
const EXAMPLE_TOPICS = ['AI в SMM', 'Видео-маркетинг', 'Экологичная мода'];
const HISTORY_KEY = 'smm_ai_trend_history';


// --- Child Components ---
const ResultCard = ({ icon, title, children }: { icon: string, title: string, children: React.ReactNode }) => (
    <div style={styles.trendResultCard}>
        <div style={styles.trendCardHeader}>
            <span style={styles.trendCardIcon}>{icon}</span>
            <h4 style={styles.trendCardTitle}>{title}</h4>
        </div>
        {children}
    </div>
);

const SkeletonLoader = () => (
    <div style={styles.trendResultGrid}>
        <div style={{ ...styles.trendResultCard, gridColumn: '1 / -1' }}>
            <div style={styles.skeletonTextMedium}></div>
            <div style={styles.skeletonText}></div>
            <div style={styles.skeletonText}></div>
        </div>
        <div style={styles.trendResultCard}><div style={styles.skeletonText}></div></div>
        <div style={styles.trendResultCard}><div style={styles.skeletonText}></div></div>
        <div style={{ ...styles.trendResultCard, gridColumn: '1 / -1' }}><div style={styles.skeletonText}></div></div>
    </div>
);


export const TrendSpotterScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const [topic, setTopic] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<TrendResult | null>(null);
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem(HISTORY_KEY);
            if (savedHistory) {
                setHistory(JSON.parse(savedHistory));
            }
        } catch (e) {
            console.error("Failed to parse trend history from localStorage", e);
            setHistory([]);
        }
    }, []);

    const addToHistory = (searchTerm: string) => {
        const newHistory = [searchTerm, ...history.filter(h => h !== searchTerm)].slice(0, 5);
        setHistory(newHistory);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    };

    const handleFindTrends = useCallback(async (searchTopic: string) => {
        if (!searchTopic.trim()) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пожалуйста, введите тему для поиска', type: 'error' } });
            return;
        }

        setIsLoading(true);
        setError('');
        setResult(null);
        setTopic(searchTopic);

        try {
            const data = await fetchWithAuth(`${API_BASE_URL}/api/find-trends`, {
                method: 'POST',
                body: JSON.stringify({ topic: searchTopic }),
            });
            setResult(data);
            addToHistory(searchTopic);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setError(errorMessage);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsLoading(false);
        }
    }, [appDispatch, history]);

    const renderResult = () => {
        if (isLoading) {
            return <SkeletonLoader />;
        }
        if (error) {
            return (
                <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
                    <h4>Ошибка поиска</h4>
                    <p>{error}</p>
                </div>
            );
        }
        if (!result || !result.trends) {
            return (
                <EmptyState
                    icon="📈"
                    title="Поиск трендов"
                    description="Введите тему или ключевое слово, чтобы AI нашел самые свежие и актуальные тренды для вашего контент-плана."
                />
            );
        }
        
        const { trends, sources } = result;

        return (
            <div>
                <div style={styles.trendResultGrid}>
                    <ResultCard icon="⚡️" title="Главный тренд:">
                        <h5 style={{fontWeight: 600, marginBottom: '8px'}}>{trends.mainTrend.title}</h5>
                        <p style={{fontSize: '14px', lineHeight: 1.6}}>{trends.mainTrend.description}</p>
                    </ResultCard>
                    <ResultCard icon="🔗" title="Связанные темы:">
                         <ul style={styles.trendCardList}>
                            {trends.relatedTopics.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </ResultCard>
                    <ResultCard icon="#️⃣" title="Ключевые хэштеги:">
                        <div style={styles.hashtagContainer}>
                           {trends.keyHashtags.map((item, i) => <span key={i} style={styles.hashtagPill}>{item}</span>)}
                        </div>
                    </ResultCard>
                     <ResultCard icon="💡" title="Идеи для контента:">
                        <ul style={styles.trendCardList}>
                            {trends.contentIdeas.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </ResultCard>
                </div>

                {sources && sources.length > 0 && (
                    <div style={styles.trendSourcesContainer}>
                        <h4 style={styles.trendSourcesTitle}>Источники:</h4>
                        {sources.map((source, index) => (
                            <a 
                                key={index} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={styles.trendSourceLinkWithFavicon}
                                className='planCardClickable'
                            >
                                <img src={`https://www.google.com/s2/favicons?domain=${new URL(source.uri).hostname}&sz=32`} alt="favicon" style={styles.trendSourceFavicon}/>
                                <span>{source.title || source.uri}</span>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderPills = (items: string[], type: 'history' | 'example') => {
        return items.map(item => (
            <button
                key={`${type}-${item}`}
                style={type === 'history' ? styles.historyPill : styles.trendExamplePill}
                onClick={() => handleFindTrends(item)}
                disabled={isLoading}
            >
                {type === 'history' && '🕒 '}{item}
            </button>
        ));
    };

    return (
        <div style={styles.trendSpotterLayout}>
            <div style={styles.trendSearchContainer}>
                <h2 style={{fontWeight: 600}}>Найдите актуальные тренды</h2>
                 <div style={{display: 'flex', gap: '16px', alignItems: 'center', width: '100%'}}>
                    <input
                        type="text"
                        style={styles.trendSearchInput}
                        placeholder="Введите тему, например: 'тренды SMM' или 'искусственный интеллект'"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        disabled={isLoading}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleFindTrends(topic); }}
                    />
                    <button
                        style={{ ...styles.button, ...styles.buttonPrimary, padding: '12px 24px' }}
                        onClick={() => handleFindTrends(topic)}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Поиск...' : '📈 Найти'}
                    </button>
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px'}}>
                     {history.length > 0 && (
                        <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                            <span style={{color: '#6c757d', fontSize: '14px', flexShrink: 0}}>История:</span>
                            {renderPills(history, 'history')}
                        </div>
                     )}
                     <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                        <span style={{color: '#6c757d', fontSize: '14px', flexShrink: 0}}>Например:</span>
                        {renderPills(EXAMPLE_TOPICS, 'example')}
                    </div>
                </div>
            </div>
            <div style={styles.trendResultsContainer}>
                {renderResult()}
            </div>
        </div>
    );
};