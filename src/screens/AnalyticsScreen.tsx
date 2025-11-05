import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { fetchWithAuth, API_BASE_URL } from '../api';
import { useAppContext } from '../contexts/AppContext';
// FIX: Import the global `styles` object as `globalStyles` to access shared styles like loaders and error text. `analyticsStyles` is aliased to `styles` for local component styles.
import { analyticsStyles as styles, baseCardStyles, styles as globalStyles } from '../styles';

// --- TYPE DEFINITIONS ---
interface KeyMetric {
    value: number;
    change: string;
}
interface SubscriberPoint {
    day: string;
    value: number;
}
interface TopPost {
    id: number;
    topic: string;
    metric: number;
    platform: string;
}
interface TrafficSource {
    source: string;
    value: number;
}
interface AnalyticsData {
    keyMetrics: {
        subscribers: KeyMetric;
        reach: KeyMetric;
        engagement: KeyMetric;
        clicks: KeyMetric;
    };
    subscriberDynamics: SubscriberPoint[];
    topPosts: TopPost[];
    trafficSources: TrafficSource[];
}

// --- MOCK CHART COMPONENTS ---
const LineChart = ({ data }: { data: SubscriberPoint[] }) => {
    const maxValue = Math.max(...data.map(p => p.value));
    const points = data.map((p, i) => `${(i / (data.length - 1)) * 100},${100 - (p.value / maxValue) * 100}`).join(' ');

    return (
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
            <defs>
                <linearGradient id="lineChartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#007bff" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#007bff" stopOpacity="0" />
                </linearGradient>
            </defs>
            <polyline fill="url(#lineChartGradient)" points={`0,100 ${points} 100,100`} />
            <polyline fill="none" stroke="#007bff" strokeWidth="1" points={points} />
        </svg>
    );
};

const DoughnutChart = ({ data }: { data: TrafficSource[] }) => {
    const colors = ['#007bff', '#17a2b8', '#6f42c1', '#6c757d'];
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulative = 0;

    return (
        <div style={styles.doughnutLayout}>
            <svg viewBox="0 0 36 36" style={styles.doughnutChart}>
                {data.map((item, index) => {
                    const percentage = (item.value / total) * 100;
                    const strokeDasharray = `${percentage} ${100 - percentage}`;
                    const strokeDashoffset = 25 - cumulative;
                    cumulative += percentage;
                    return (
                        <circle
                            key={item.source}
                            cx="18"
                            cy="18"
                            r="15.915"
                            fill="transparent"
                            stroke={colors[index % colors.length]}
                            strokeWidth="3.8"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                        />
                    );
                })}
            </svg>
            <div style={styles.doughnutLegend}>
                {data.map((item, index) => (
                    <div key={item.source} style={styles.legendItem}>
                        <div style={{...styles.legendMarker, backgroundColor: colors[index % colors.length]}}></div>
                        <span>{item.source}</span>
                        <span style={styles.legendValue}>{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export const AnalyticsScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<7 | 30 | 90>(30);
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAnalysisResult, setAiAnalysisResult] = useState('');
    const [analysisError, setAnalysisError] = useState('');

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/api/analytics?period=${period}`);
                const analyticsData = await response.json();
                setData(analyticsData);
            } catch (error) {
                addToast(error instanceof Error ? error.message : 'Не удалось загрузить данные аналитики.', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [period, addToast]);
    
    const handleAiAnalysis = async () => {
        if (!data) {
            addToast('Данные аналитики еще не загружены.', 'error');
            return;
        }
        setIsAnalyzing(true);
        setAiAnalysisResult('');
        setAnalysisError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const analyticsPrompt = `
                Ты — опытный SMM-аналитик. Проанализируй следующие данные и предоставь краткий, но емкий отчет.

                **Данные для анализа:**
                - Ключевые метрики (подписчики, охват, вовлеченность): ${JSON.stringify(data.keyMetrics, null, 2)}
                - Динамика подписчиков за последний период: ${data.subscriberDynamics.length} точек данных, от ${data.subscriberDynamics[0].value} до ${data.subscriberDynamics[data.subscriberDynamics.length - 1].value}.
                - Самые эффективные посты: ${JSON.stringify(data.topPosts, null, 2)}
                - Источники трафика: ${JSON.stringify(data.trafficSources, null, 2)}

                **Твоя задача:**
                1.  **Основные выводы:** Сделай 2-3 главных вывода из этих данных. Что идет хорошо, а что требует внимания?
                2.  **Анализ постов:** Почему, по-твоему, топ-посты стали успешными?
                3.  **Рекомендации:** Дай 3-4 конкретных, выполнимых совета по улучшению SMM-стратегии на основе этого анализа.

                Ответ должен быть в формате простого текста, без Markdown-разметки.
            `;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: analyticsPrompt });
            setAiAnalysisResult(response.text);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setAnalysisError(`Ошибка анализа: ${message}`);
            addToast(`Ошибка анализа: ${message}`, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };


    const MetricCard = ({ title, metric, icon }: { title: string; metric?: KeyMetric; icon: string }) => {
        const isPositive = metric && parseFloat(metric.change) >= 0;
        return (
            <div style={styles.metricCard}>
                <h3 style={styles.metricTitle}>{icon} {title}</h3>
                {loading || !metric ? (
                     <div style={{...styles.skeleton, height: '48px', width: '70%', marginTop: '4px'}}><div className="shimmer"></div></div>
                ) : (
                    <>
                        <p style={styles.metricValue}>{metric.value.toLocaleString('ru-RU')}</p>
                        <p style={{...styles.metricChange, color: isPositive ? '#28a745' : '#dc3545' }}>
                            {isPositive ? '▲' : '▼'} {metric.change}%
                        </p>
                    </>
                )}
            </div>
        );
    };
    
    const PlatformIcon = ({ platform }: { platform: string }) => {
        let icon = '🌐';
        if (platform === 'instagram') icon = '📸';
        if (platform === 'vk') icon = '👥';
        if (platform === 'telegram') icon = '✈️';
        return <span title={platform} style={styles.postPlatformIcon}>{icon}</span>;
    };


    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div style={styles.dateRangePicker}>
                    {[7, 30, 90].map(p => (
                        <button
                            key={p}
                            style={period === p ? styles.dateRangeButtonActive : styles.dateRangeButton}
                            onClick={() => setPeriod(p as 7 | 30 | 90)}
                        >
                            {p} дней
                        </button>
                    ))}
                </div>
                <button onClick={handleAiAnalysis} disabled={loading || isAnalyzing} style={isAnalyzing ? { ...styles.aiAnalysisButton, backgroundColor: '#a991f8' } : styles.aiAnalysisButton}>
                    {/* FIX: Corrected style access from `baseCardStyles.miniLoader` to `globalStyles.miniLoader` after importing global styles. */}
                    {isAnalyzing ? <div style={{...globalStyles.miniLoader, borderTopColor: '#fff', border: '3px solid rgba(255,255,255,0.3)'}}></div> : '🚀'}
                    {isAnalyzing ? 'Анализирую...' : 'AI Анализ'}
                </button>
            </div>

            <div style={styles.keyMetricsGrid}>
                <MetricCard title="Подписчики" metric={data?.keyMetrics.subscribers} icon="👥" />
                <MetricCard title="Охват" metric={data?.keyMetrics.reach} icon="👁️" />
                <MetricCard title="Вовлеченность" metric={data?.keyMetrics.engagement} icon="❤️" />
                <MetricCard title="Клики" metric={data?.keyMetrics.clicks} icon="🖱️" />
            </div>
            
            {(isAnalyzing || aiAnalysisResult || analysisError) && (
                <div style={styles.aiAnalysisCard}>
                    <h3 style={styles.cardTitle}>Анализ от AI</h3>
                    {/* FIX: Corrected style access from `baseCardStyles.loader` to `globalStyles.loader`. */}
                    {isAnalyzing && <div style={{...globalStyles.loader, alignSelf: 'center'}}></div>}
                    {/* FIX: Corrected style access from `baseCardStyles.errorText` to `globalStyles.errorText`. */}
                    {analysisError && <p style={{...globalStyles.errorText}}>{analysisError}</p>}
                    {aiAnalysisResult && <pre style={styles.aiAnalysisContent}>{aiAnalysisResult}</pre>}
                </div>
            )}
            
            <div style={styles.mainGrid}>
                 <div style={{...baseCardStyles, gridArea: 'chart'}}>
                    <h3 style={styles.cardTitle}>Динамика подписчиков</h3>
                    <div style={styles.chartContainer}>
                        {loading || !data ? (
                             <div style={{...styles.skeleton, height: '100%', width: '100%'}}><div className="shimmer"></div></div>
                        ) : (
                            <LineChart data={data.subscriberDynamics} />
                        )}
                    </div>
                 </div>
                 <div style={{...baseCardStyles, gridArea: 'posts'}}>
                     <h3 style={styles.cardTitle}>Самые эффективные посты</h3>
                     <div style={styles.postList}>
                         {loading || !data ? (
                            Array.from({length: 4}).map((_, i) => <div key={i} style={{...styles.skeleton, height: '48px', width: '100%'}}><div className="shimmer"></div></div>)
                         ) : (
                            data.topPosts.map(post => (
                                 <div key={post.id} style={styles.postItem} className="postItemHover">
                                     <PlatformIcon platform={post.platform} />
                                     <span style={styles.postTopic}>{post.topic}</span>
                                     <span style={styles.postMetric}>❤️ {post.metric}</span>
                                 </div>
                             ))
                         )}
                     </div>
                 </div>
                  <div style={{...baseCardStyles, gridArea: 'traffic'}}>
                     <h3 style={styles.cardTitle}>Источники трафика</h3>
                      {loading || !data ? (
                           <div style={{...styles.skeleton, height: '150px', width: '100%'}}><div className="shimmer"></div></div>
                      ) : (
                        <DoughnutChart data={data.trafficSources} />
                      )}
                 </div>
            </div>
        </div>
    );
};