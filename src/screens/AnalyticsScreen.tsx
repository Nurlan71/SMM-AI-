import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { useAppContext } from '../contexts/AppContext';
import { analyticsStyles as styles, baseCardStyles } from '../styles';

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
            </div>

            <div style={styles.keyMetricsGrid}>
                <MetricCard title="Подписчики" metric={data?.keyMetrics.subscribers} icon="👥" />
                <MetricCard title="Охват" metric={data?.keyMetrics.reach} icon="👁️" />
                <MetricCard title="Вовлеченность" metric={data?.keyMetrics.engagement} icon="❤️" />
                <MetricCard title="Клики" metric={data?.keyMetrics.clicks} icon="🖱️" />
            </div>
            
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
