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

/**
 * Safely formats a number for display, handling null, undefined, and non-numeric values.
 * @param value The number to format.
 * @returns A formatted string or '0' if the value is invalid.
 */
const formatNumber = (value: number | undefined | null): string => {
    const num = Number(value);
    if (value === null || value === undefined || isNaN(num)) {
        return '0';
    }
    return num.toLocaleString();
};


const StatCard = ({ icon, value, label }: { icon: string, value: number | string, label: string }) => (
    <div style={styles.statCard}>
        <div style={styles.statCardIcon}>{icon}</div>
        <div>
            <div style={styles.statCardValue}>{value}</div>
            <div style={styles.statCardLabel}>{label}</div>
        </div>
    </div>
);

const PlatformPerformanceItem = ({ platform, data }: { platform: string, data: PlatformPerformance }) => {
    if (!data) { // Guard clause for malformed data
        return null;
    }
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
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await fetchWithAuth(`${API_BASE_URL}/api/analytics`);
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
    }, [appDispatch]);
    
    if (isLoading) {
        return <div style={{ padding: '24px' }}> <div style={styles.spinner}></div> Загрузка аналитики...</div>;
    }

    if (error) {
        return <div style={{ padding: '24px', color: 'red' }}>Ошибка загрузки данных: {error}</div>;
    }

    if (!analyticsData || analyticsData.totalPosts === 0) {
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
    
    const { totalPosts, totalLikes, totalComments, totalViews, platformPerformance, topPosts } = analyticsData;

    return (
        <div style={styles.analyticsLayout}>
            <div style={styles.analyticsGrid}>
                <StatCard icon="✍️" value={formatNumber(totalPosts)} label="Опубликовано постов" />
                <StatCard icon="❤️" value={formatNumber(totalLikes)} label="Всего лайков" />
                <StatCard icon="💬" value={formatNumber(totalComments)} label="Всего комментариев" />
                <StatCard icon="👁️" value={formatNumber(totalViews)} label="Всего просмотров" />
            </div>
            
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ ...styles.card, flex: 1, minWidth: '300px' }}>
                    <h3 style={styles.analyticsSectionTitle}>Эффективность по платформам</h3>
                     <div style={styles.platformPerformanceList}>
                        {platformPerformance && Object.entries(platformPerformance).map(([platform, data]) => (
                            <PlatformPerformanceItem key={platform} platform={platform} data={data} />
                        ))}
                    </div>
                </div>

                <div style={{ ...styles.card, flex: 1, minWidth: '300px' }}>
                    <h3 style={styles.analyticsSectionTitle}>Лучшие публикации</h3>
                     <div style={styles.topPostsList}>
                        {topPosts && topPosts.map(post => (
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