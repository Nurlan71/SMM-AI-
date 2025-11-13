import React, { useState, useEffect } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { styles } from '../styles';
import type { Post, Platform } from '../types';

interface PlatformPerformance {
    posts: number;
    likes: number;
    comments: number;
}

interface AnalyticsData {
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    totalViews: number;
    platformPerformance: Record<Platform, PlatformPerformance>;
    topPosts: Post[];
}

const formatNumber = (value: number | undefined | null): string => {
    const num = Number(value);
    if (value === null || value === undefined || isNaN(num)) {
        return '0';
    }
    return num.toLocaleString('ru-RU');
};

const calculateChange = (current: number, previous: number | undefined | null): number | null => {
    if (previous === undefined || previous === null) return null;
    if (previous === 0) {
        return current > 0 ? Infinity : 0;
    }
    if (current === previous) return 0;
    return ((current - previous) / previous) * 100;
};

const StatCard = ({ icon, value, label, previousValue }: { icon: string, value: number, label: string, previousValue?: number }) => {
    const change = calculateChange(value, previousValue);
    const isPositive = change !== null && change > 0;
    const isNegative = change !== null && change < 0;
    
    return (
        <div style={styles.statCard}>
            <div style={styles.statCardIcon}>{icon}</div>
            <div>
                <div style={styles.statCardValueContainer}>
                    <div style={styles.statCardValue}>{formatNumber(value)}</div>
                    {change !== null && change !== 0 && (
                        <div style={{...styles.statCardChange, ...(isPositive ? styles.statCardChangePositive : styles.statCardChangeNegative)}}>
                           {change === Infinity ? '∞' : `${isPositive ? '+' : ''}${change.toFixed(0)}%`}
                        </div>
                    )}
                </div>
                <div style={styles.statCardLabel}>{label}</div>
            </div>
        </div>
    );
};

const PlatformPerformanceItem = ({ platform, data }: { platform: string, data: PlatformPerformance }) => {
    if (!data) return null;
    const likes = data.likes || 0;
    const comments = data.comments || 0;
    const totalEngagement = likes + comments;
    return (
        <div style={styles.platformItem}>
            <span style={{fontWeight: 500, flexBasis: '120px'}}>{platform}</span>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '4px'}}>
                 <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6c757d'}}>
                    <span>❤️ {formatNumber(likes)}</span>
                    <span>💬 {formatNumber(comments)}</span>
                </div>
                <div style={styles.platformProgressBarContainer}>
                   <div style={{ ...styles.platformProgressBar, width: `${totalEngagement > 0 ? (likes / totalEngagement) * 100 : 0}%`, backgroundColor: '#007bff' }} />
                   <div style={{ ...styles.platformProgressBar, width: `${totalEngagement > 0 ? (comments / totalEngagement) * 100 : 0}%`, backgroundColor: '#6c757d' }} />
                </div>
            </div>
        </div>
    );
};

export const AnalyticsScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const [analyticsData, setAnalyticsData] = useState<{ current: AnalyticsData; previous: AnalyticsData | null } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<'7d' | '30d'>('30d');
    const [compare, setCompare] = useState(false);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const url = `${API_BASE_URL}/api/analytics?period=${period}&compare=${compare}`;
                const data = await fetchWithAuth(url);
                setAnalyticsData(data);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Не удалось загрузить данные аналитики.";
                setError(errorMessage);
                appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnalytics();
    }, [appDispatch, period, compare]);
    
    const handleGenerateReport = () => {
        if (analyticsData?.current) {
            appDispatch({ type: 'SET_REPORT_MODAL_OPEN', payload: true });
        } else {
             appDispatch({ type: 'ADD_TOAST', payload: { message: 'Нет данных для создания отчета.', type: 'error' } });
        }
    }
    
    if (isLoading) {
        return <div style={{ padding: '24px' }}> <div style={styles.spinner}></div> Загрузка аналитики...</div>;
    }

    if (error) {
        return <div style={{ padding: '24px', color: 'red' }}>Ошибка загрузки данных: {error}</div>;
    }

    if (!analyticsData || !analyticsData.current || analyticsData.current.totalPosts === 0) {
        return (
            <div style={{ padding: '24px', height: '100%' }}>
                <EmptyState
                    icon="📊"
                    title="Нет данных для анализа"
                    description="Как только вы опубликуете несколько постов, здесь появится подробная аналитика по ним."
                />
            </div>
        );
    }
    
    const { current, previous } = analyticsData;

    return (
        <div style={styles.analyticsLayout}>
             <div style={styles.analyticsHeader}>
                <h2 style={{fontSize: '24px', fontWeight: 600}}>Обзор аналитики</h2>
                <button style={{...styles.button, ...styles.buttonPrimary}} onClick={handleGenerateReport}>
                    🤖 Сгенерировать AI-отчет
                </button>
            </div>

            <div style={styles.analyticsControls}>
                <div style={styles.periodButtonGroup}>
                    <button style={period === '7d' ? styles.periodButtonActive : styles.periodButton} onClick={() => setPeriod('7d')}>7 дней</button>
                    <button style={period === '30d' ? styles.periodButtonActive : styles.periodButton} onClick={() => setPeriod('30d')}>30 дней</button>
                </div>
                <div style={styles.compareCheckboxContainer}>
                    <input type="checkbox" id="compare-checkbox" style={styles.compareCheckbox} checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                    <label htmlFor="compare-checkbox" style={{cursor: 'pointer'}}>Сравнить с пред. периодом</label>
                </div>
            </div>
        
            <div style={styles.analyticsGrid}>
                <StatCard icon="✍️" value={current.totalPosts} label="Опубликовано постов" previousValue={previous?.totalPosts} />
                <StatCard icon="❤️" value={current.totalLikes} label="Всего лайков" previousValue={previous?.totalLikes} />
                <StatCard icon="💬" value={current.totalComments} label="Всего комментариев" previousValue={previous?.totalComments} />
                <StatCard icon="👁️" value={current.totalViews} label="Всего просмотров" previousValue={previous?.totalViews} />
            </div>
            
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ ...styles.card, flex: 1, minWidth: '300px' }}>
                    <h3 style={styles.analyticsSectionTitle}>Эффективность по платформам</h3>
                     <div style={styles.platformPerformanceList}>
                        {current.platformPerformance && Object.entries(current.platformPerformance).map(([platform, data]) => (
                            <PlatformPerformanceItem key={platform} platform={platform} data={data} />
                        ))}
                    </div>
                </div>

                <div style={{ ...styles.card, flex: 1, minWidth: '300px' }}>
                    <h3 style={styles.analyticsSectionTitle}>Лучшие публикации</h3>
                     <div style={styles.topPostsList}>
                        {current.topPosts && current.topPosts.map(post => (
                             <div key={post.id} style={styles.topPostItem}>
                                <div style={{flex: 1, marginRight: '16px'}}>
                                    <p style={{fontSize: '14px', marginBottom: '4px'}}>{post.content.substring(0, 80)}...</p>
                                    <span style={{fontSize: '12px', color: '#6c757d'}}>{post.platform}</span>
                                </div>
                                <div style={{display: 'flex', gap: '12px', color: '#495057'}}>
                                    <span>❤️ {formatNumber(post.likes_count)}</span>
                                    <span>💬 {formatNumber(post.comments_count)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};