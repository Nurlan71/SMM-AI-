import React, { useState, useMemo, useCallback } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { styles } from '../styles';
import type { Post } from '../types';
import { EmptyState } from '../components/EmptyState';

const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const ContentPlanScreen = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);
    
    const draftPosts = useMemo(() => dataState.posts.filter(p => p.status === 'draft'), [dataState.posts]);
    const scheduledPosts = useMemo(() => {
        return dataState.posts.reduce((acc, post) => {
            if ((post.status === 'scheduled' || post.status === 'published' || post.status === 'approved' || post.status === 'needs-approval' || post.status === 'needs-revision') && post.date) {
                (acc[post.date] = acc[post.date] || []).push(post);
            }
            return acc;
        }, {} as Record<string, Post[]>);
    }, [dataState.posts]);

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        
        // Day of week: 0=Sun, 1=Mon, ..., 6=Sat. We want 0=Mon.
        let startDayOfWeek = firstDayOfMonth.getDay();
        if (startDayOfWeek === 0) startDayOfWeek = 6;
        else startDayOfWeek -= 1;

        const grid = [];
        // Add empty cells for previous month
        for (let i = 0; i < startDayOfWeek; i++) {
            grid.push({ key: `empty-${i}`, empty: true });
        }
        // Add cells for current month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateString = date.toISOString().split('T')[0];
            grid.push({
                key: dateString,
                date: date,
                dateString: dateString,
                dayNumber: day,
                isToday: new Date().toDateString() === date.toDateString(),
                posts: scheduledPosts[dateString] || [],
            });
        }
        return grid;
    }, [currentDate, scheduledPosts]);
    
    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    // --- DRAG AND DROP HANDLERS ---
    const handleDragStart = (e: React.DragEvent, postId: number) => {
        e.dataTransfer.setData('text/plain', postId.toString());
    };
    
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, dateString: string) => {
        e.preventDefault();
        setDragOverDate(null);
        const postId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const post = dataState.posts.find(p => p.id === postId);

        if (post && post.status === 'draft') {
            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/api/posts/${postId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ date: dateString, status: 'scheduled' }),
                });
                const savedPost: Post = await response.json();
                dataDispatch({ type: 'UPDATE_POST', payload: savedPost });
                addToast(`Пост "${savedPost.topic}" запланирован!`, 'success');
            } catch (error) {
                addToast(error instanceof Error ? error.message : 'Не удалось запланировать пост.', 'error');
            }
        }
    };

    return (
        <div style={styles.contentPlanLayout}>
            <div style={styles.contentPlanControls}>
                <div style={{...styles.card, flex: 1}}>
                    <h2 style={styles.cardTitle}>Бэклог идей</h2>
                    <p style={styles.cardSubtitle}>Перетащите идею на календарь, чтобы запланировать ее.</p>
                    <button
                        style={{...styles.button, ...styles.newCampaignButton, width: '100%', marginBottom: '16px'}}
                        className="newCampaignButton"
                        onClick={() => appDispatch({type: 'SET_CAMPAIGN_WIZARD_OPEN', payload: true})}
                    >
                       🚀 Новая кампания с AI
                    </button>
                    <div style={styles.planList}>
                        {draftPosts.length === 0 ? (
                           <p style={{textAlign: 'center', color: '#6c757d', padding: '20px 0'}}>Нет идей в бэклоге. Создайте кампанию!</p>
                        ) : (
                            draftPosts.map(post => (
                                <div 
                                    key={post.id}
                                    style={{...styles.planCard, ...styles.planCardDraggable}}
                                    className="planCardClickable"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, post.id)}
                                >
                                    <strong style={styles.planCardTitle}>{post.topic}</strong>
                                    <span style={styles.planCardBadge}>{post.postType}</span>
                                    <p style={styles.planCardDescription}>{post.description}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            <div style={styles.calendarContainer}>
                 <div style={{...styles.card, flex: 1, display: 'flex', flexDirection: 'column'}}>
                    <div style={styles.calendarHeader}>
                         <button style={styles.calendarNavButton} className="calendarNavButton" onClick={() => changeMonth(-1)}>‹</button>
                        <h2 style={styles.calendarTitle}>{currentDate.toLocaleString('ru', { month: 'long', year: 'numeric' })}</h2>
                        <button style={styles.calendarNavButton} className="calendarNavButton" onClick={() => changeMonth(1)}>›</button>
                    </div>
                    <div style={{...styles.calendarGrid, gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'auto'}}>
                        {daysOfWeek.map(day => <div key={day} style={styles.calendarWeekDay}>{day}</div>)}
                    </div>
                    <div style={styles.calendarGrid}>
                        {calendarGrid.map(cell => {
                            if (cell.empty) {
                                return <div key={cell.key} style={styles.calendarDayEmpty}></div>;
                            }
                            const isDragOver = dragOverDate === cell.dateString;
                            return (
                                <div
                                    key={cell.key}
                                    style={{
                                        ...styles.calendarDay,
                                        ...(cell.isToday && styles.calendarDayToday),
                                        ...(isDragOver && styles.calendarDayDragOver)
                                    }}
                                    className="calendarDay"
                                    onDragOver={(e) => { e.preventDefault(); setDragOverDate(cell.dateString!); }}
                                    onDragLeave={() => setDragOverDate(null)}
                                    onDrop={(e) => handleDrop(e, cell.dateString!)}
                                >
                                    <div style={styles.calendarDayNumber}>{cell.dayNumber}</div>
                                    <div style={styles.scheduledPostsContainer}>
                                        {cell.posts?.map(post => (
                                             <div 
                                                key={post.id} 
                                                style={styles.scheduledPostItem} 
                                                className="scheduledPostItem"
                                                onClick={() => appDispatch({ type: 'OPEN_POST_DETAIL_MODAL', payload: post.id })}
                                             >
                                                {post.topic}
                                             </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                 </div>
            </div>
        </div>
    );
};