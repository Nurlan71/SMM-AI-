import React, { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import { AiModelSelector } from '../components/AiModelSelector';
import type { AiModel, CompetitorAnalysisResult, TrendSource } from '../types';

// --- Types ---
interface AnalysisResult {
    analysis: CompetitorAnalysisResult;
    sources: TrendSource[];
}

// --- Child Components ---
const SkeletonLoader = () => (
    <div>
        <div style={{...styles.competitorResultCard, height: '150px'}}><div style={styles.skeletonText}></div></div>
        <div style={{...styles.competitorResultCard, height: '150px'}}><div style={styles.skeletonText}></div></div>
        <div style={{...styles.competitorResultCard, height: '100px'}}><div style={styles.skeletonText}></div></div>
    </div>
);

const AnalysisResultDisplay = ({ result }: { result: AnalysisResult }) => (
    <div>
        {result.analysis.analysis.map((item, index) => (
            <div key={index} style={styles.competitorResultCard}>
                <h3 style={{...styles.strategyResultSectionTitle, marginTop: 0}}>Анализ: <a href={item.url} target="_blank" rel="noopener noreferrer">{new URL(item.url).hostname}</a></h3>
                <p><strong>Стратегия:</strong> {item.summary}</p>
                <p><strong>Сильные стороны:</strong></p>
                <ul style={styles.strategyResultList}>
                    {item.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
                 <p><strong>Слабые стороны:</strong></p>
                <ul style={styles.strategyResultList}>
                    {item.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
                <p><strong>Пример успешного контента:</strong> {item.topContentExample}</p>
            </div>
        ))}
        <div style={styles.competitorResultCard}>
            <h3 style={styles.strategyResultSectionTitle}>🏆 Общие рекомендации</h3>
             <ul style={styles.strategyResultList}>
                {result.analysis.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
            </ul>
        </div>
        
        {result.sources && result.sources.length > 0 && (
            <div style={styles.trendSourcesContainer}>
                <h4 style={styles.trendSourcesTitle}>Источники:</h4>
                {result.sources.map((source, index) => (
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


export const CompetitorAnalysisScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const [competitors, setCompetitors] = useState<string[]>([]);
    const [newCompetitorUrl, setNewCompetitorUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<AnalysisResult | null>(null);
    
    const [model, setModel] = useState<AiModel>('gemini-2.5-pro');

    const handleAddCompetitor = (e: React.FormEvent) => {
        e.preventDefault();
        const url = newCompetitorUrl.trim();
        if (url && competitors.length < 5 && !competitors.includes(url)) {
            try {
                // Validate URL format
                new URL(url);
                setCompetitors([...competitors, url]);
                setNewCompetitorUrl('');
            } catch (_) {
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пожалуйста, введите корректный URL.', type: 'error' } });
            }
        }
    };

    const handleRemoveCompetitor = (urlToRemove: string) => {
        setCompetitors(competitors.filter(url => url !== urlToRemove));
    };

    const handleAnalyze = async () => {
        if (competitors.length === 0) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Добавьте хотя бы одного конкурента для анализа.', type: 'error' } });
            return;
        }

        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const data: AnalysisResult = await fetchWithAuth(`${API_BASE_URL}/api/analyze-competitors`, {
                method: 'POST',
                body: JSON.stringify({ competitors, model }),
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
        if (isLoading) return <SkeletonLoader />;
        if (error) return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
                <h4>Ошибка анализа</h4>
                <p>{error}</p>
            </div>
        );
        if (!result) return (
            <EmptyState
                icon="🔬"
                title="Анализ конкурентов"
                description="Добавьте ссылки на страницы конкурентов в социальных сетях, чтобы AI проанализировал их SMM-стратегии."
            />
        );
        return <AnalysisResultDisplay result={result} />;
    };

    return (
        <div style={styles.competitorAnalysisLayout}>
            <div style={styles.competitorInputContainer}>
                 <AiModelSelector 
                    model={model}
                    setModel={setModel}
                    useMemory={false} // Memory is not used in this tool
                    setUseMemory={() => {}} // Dummy function
                    isLoading={isLoading}
                />
                <h2 style={{fontWeight: 600}}>Добавьте конкурентов для анализа</h2>
                <form onSubmit={handleAddCompetitor} style={styles.competitorInputForm}>
                    <input
                        type="url"
                        style={styles.competitorInput}
                        placeholder="https://example.com/competitor"
                        value={newCompetitorUrl}
                        onChange={(e) => setNewCompetitorUrl(e.target.value)}
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        style={{ ...styles.button, ...styles.buttonPrimary }}
                        disabled={isLoading || competitors.length >= 5}
                    >
                        Добавить
                    </button>
                </form>

                {competitors.length > 0 && (
                    <div style={styles.competitorList}>
                        {competitors.map(url => (
                            <div key={url} style={styles.competitorListItem}>
                                <span style={styles.competitorListItemUrl}>{url}</span>
                                <button
                                    style={styles.competitorRemoveButton}
                                    onClick={() => handleRemoveCompetitor(url)}
                                    disabled={isLoading}
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                 <button
                    style={{ ...styles.button, ...styles.buttonPrimary, padding: '12px 24px', marginTop: '16px' }}
                    onClick={handleAnalyze}
                    disabled={isLoading || competitors.length === 0}
                    className="newCampaignButton"
                >
                    {isLoading ? 'Анализ...' : '🔬 Проанализировать'}
                </button>
            </div>
             <div style={styles.competitorResultsContainer}>
                {renderResult()}
            </div>
        </div>
    );
};
