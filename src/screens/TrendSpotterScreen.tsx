import React, { useState, useCallback } from 'react';
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

// --- Constants ---
const EXAMPLE_TOPICS = ['AI в SMM', 'Видео-маркетинг', 'Экологичная мода'];

// --- Helper Component for Rendering Markdown ---
const MarkdownRenderer = ({ text }: { text: string }) => {
    const renderable = React.useMemo(() => {
        const parts: React.ReactNode[] = [];
        const lines = text.split('\n');
        
        lines.forEach((line, index) => {
            if (line.startsWith('## ')) {
                parts.push(<h3 key={`h3-${index}`} style={styles.trendResultTitle}>{line.substring(3)}</h3>);
            } else if (line.startsWith('* ') || line.startsWith('- ')) {
                 const content = line.substring(2);
                 const styledContent = content.split(/\*\*(.*?)\*\*/g).map((part, partIndex) => 
                    partIndex % 2 === 1 ? <strong key={partIndex}>{part}</strong> : part
                 );
                 parts.push(<li key={`li-${index}`} style={styles.trendResultListItem}>{styledContent}</li>);
            } else if (line.trim() !== '') {
                parts.push(<p key={`p-${index}`} style={styles.trendResultParagraph}>{line}</p>);
            }
        });

        // This structure is a bit simplified; for proper lists we should group <li>s in a <ul>
        // Let's refine this to group list items
        const finalElements: React.ReactNode[] = [];
        let currentList: React.ReactNode[] = [];

        const flushList = () => {
            if (currentList.length > 0) {
                finalElements.push(<ul key={`ul-${finalElements.length}`} style={styles.trendResultList}>{currentList}</ul>);
                currentList = [];
            }
        };

        parts.forEach((part: any, index) => {
            if (part.type === 'li') {
                currentList.push(part);
            } else {
                flushList();
                finalElements.push(part);
            }
        });
        flushList(); // Ensure the last list is also rendered

        return finalElements;
    }, [text]);

    return <div style={styles.trendResultContent}>{renderable}</div>;
};


export const TrendSpotterScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const [topic, setTopic] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<TrendResult | null>(null);

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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setError(errorMessage);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsLoading(false);
        }
    }, [appDispatch]);

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
                <MarkdownRenderer text={result.trends} />
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
                                <span style={{marginRight: '8px'}}>🔗</span> {source.title || source.uri}
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
                <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                    <span style={{color: '#6c757d', fontSize: '14px'}}>Например:</span>
                    {EXAMPLE_TOPICS.map(t => (
                        <button 
                            key={t} 
                            style={styles.trendExamplePill}
                            onClick={() => handleFindTrends(t)}
                            disabled={isLoading}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>
            <div style={styles.trendResultsContainer}>
                {renderResult()}
            </div>
        </div>
    );
};