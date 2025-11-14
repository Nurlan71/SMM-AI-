import React, { useState, useMemo, DragEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { useDataContext } from '../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import { getDaysInMonth, getMonthName } from '../lib/dateUtils';
import { Post } from '../types';

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const getStatusColor = (status: Post['status']) => {
    const colors: { [key in Post['status']]: string } = {
        idea: '#6c757d',
        draft: '#ffc107',
        scheduled: '#007bff',
        published: '#28a745',
        error: '#dc3545',
    };
    return colors[status];
};

const UnscheduledPostsList = ({ posts }: { posts: Post[] }) => {
    const { dispatch: appDispatch } = useAppContext();
    
    const handleDragStart = (e: DragEvent<HTMLDivElement>, postId: number) => {
        e.dataTransfer.setData("postId", postId.toString());
    };

    if (posts.length === 0) {
        return <p style={{color: '#6c757d', fontSize: '14px', textAlign: 'center'}}>Здесь будут появляться ваши идеи и черновики.</p>;
    }

    return (
        <div>
            {posts.map(post => (
                 <div
                    key={post.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, post.id)}
                    style={styles.unscheduledPostCard}
                    className="planCardClickable"
                    onClick={() => appDispatch({ type: 'OPEN_POST_DETAIL_MODAL', payload: post.id })}
                >
                    <p style={{fontSize: '14px', marginBottom: '4px' }}>{post.content.substring(0, 100)}...</p>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span style={{fontSize: '12px', color: '#6c757d'}}>Платформа: {post.platform}</span>
                         <span style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: getStatusColor(post.status),
                            color: 'white'
                         }}>{post.status}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};


const Calendar = ({ posts, currentDate, onDropPost, onShowTooltip, onHideTooltip }: { posts: Post[], currentDate: Date, onDropPost: (postId: number, date: Date) => void, onShowTooltip: (content: string, e: React.MouseEvent) => void, onHideTooltip: () => void }) => {
    const { dispatch: appDispatch } = useAppContext();
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const monthDays = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const today = new Date();

    const handlePostClick = (postId: number) => {
        appDispatch({ type: 'OPEN_POST_DETAIL_MODAL', payload: postId });
    };
    
    const handleAddPost = (date: Date) => {
        console.log('Add post for:', date.toLocaleDateString());
         appDispatch({ type: 'SET_CAMPAIGN_WIZARD_OPEN', payload: true });
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>, date: Date) => {
        e.preventDefault();
        setDragOverIndex(null);
        const postId = parseInt(e.dataTransfer.getData("postId"), 10);
        if (postId) {
            onDropPost(postId, date);
        }
    };

    return (
        <div style={styles.calendarGrid}>
            {WEEK_DAYS.map(day => (
                <div key={day} style={styles.calendarHeaderCell}>{day}</div>
            ))}
            {monthDays.map((day, index) => {
                const isToday = day.isCurrentMonth && 
                                day.date.getDate() === today.getDate() &&
                                day.date.getMonth() === today.getMonth() &&
                                day.date.getFullYear() === today.getFullYear();

                const dayStyle = {
                    ...styles.calendarDay,
                    ...(day.isCurrentMonth ? {} : styles.calendarDayNotInMonth),
                    ...(isToday ? styles.calendarDayToday : {}),
                    ...(dragOverIndex === index ? styles.calendarDayDragOver : {})
                };

                const postsForDay = posts.filter(post => {
                    if (!post || !post.publishDate) return false;
                    const postDate = new Date(post.publishDate);
                    return postDate.getDate() === day.date.getDate() &&
                           postDate.getMonth() === day.date.getMonth() &&
                           postDate.getFullYear() === day.date.getFullYear();
                });

                return (
                    <div 
                        key={index} 
                        style={dayStyle} 
                        className="calendarDay"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, day.date)}
                        onDragEnter={() => day.isCurrentMonth && setDragOverIndex(index)}
                        onDragLeave={() => setDragOverIndex(null)}
                    >
                        <div style={styles.calendarDayNumber}>{day.date.getDate()}</div>
                        {day.isCurrentMonth && (
                            <button className="calendarDayAddBtn" onClick={() => handleAddPost(day.date)}>+</button>
                        )}
                        <div style={styles.calendarPostsContainer}>
                            {postsForDay.slice(0, 3).map(post => (
                                <div
                                    key={post.id}
                                    style={{ ...styles.postPill, backgroundColor: getStatusColor(post.status) }}
                                    onClick={() => handlePostClick(post.id)}
                                    onMouseEnter={(e) => onShowTooltip(post.content, e)}
                                    onMouseLeave={onHideTooltip}
                                >
                                    {post.content.substring(0, 20)}...
                                </div>
                            ))}
                            {postsForDay.length > 3 && (
                                <div style={styles.postPillMore}>
                                    + {postsForDay.length - 3} еще
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};


export const ContentPlanScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { posts, dataLoading } = dataState;
    const [currentDate, setCurrentDate] = useState(new Date());
    const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState('');
    const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
    const [suggestionError, setSuggestionError] = useState('');

    const safePosts = Array.isArray(posts) ? posts : [];
    
    const { scheduledPosts, unscheduledPosts } = useMemo(() => {
        const scheduled = safePosts.filter(p => p.status === 'scheduled' || p.status === 'published');
        const unscheduled = safePosts.filter(p => p.status === 'idea' || p.status === 'draft');
        return { scheduledPosts: scheduled, unscheduledPosts: unscheduled };
    }, [safePosts]);

    const changeMonth = (offset: number) => {
        setCurrentDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };
    
    const handleShowTooltip = (content: string, e: React.MouseEvent) => {
        setTooltip({ content, x: e.clientX, y: e.clientY });
    };

    const handleHideTooltip = () => {
        setTooltip(null);
    };

    const handleGetAiSuggestion = async () => {
        setIsSuggestionLoading(true);
        setSuggestionError('');
        setAiSuggestion('');

        const publishedPosts = safePosts.filter(p => p.status === 'published');

        if (publishedPosts.length < 3) {
            setSuggestionError('Нужно хотя бы 3 опубликованных поста для анализа.');
            setIsSuggestionLoading(false);
            return;
        }

        try {
            const result = await fetchWithAuth(`${API_BASE_URL}/api/analytics/suggestion`, {
                method: 'POST',
                body: JSON.stringify({ posts: publishedPosts }),
            });
            setAiSuggestion(result.suggestion);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Не удалось получить совет от AI.";
            setSuggestionError(errorMessage);
        } finally {
            setIsSuggestionLoading(false);
        }
    };

    const handleDropPost = async (postId: number, date: Date) => {
        const postToUpdate = dataState.posts.find(p => p.id === postId);
        if (postToUpdate) {
            const updatedPost: Post = {
                ...postToUpdate,
                status: 'scheduled',
                publishDate: date.toISOString(),
            };
            try {
                const updatedPostFromServer = await fetchWithAuth(`${API_BASE_URL}/api/posts/${postId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updatedPost),
                });
                dataDispatch({ type: 'UPDATE_POST', payload: updatedPostFromServer });
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пост успешно запланирован!', type: 'success' } });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Не удалось запланировать пост.";
                appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
            }
        }
    };

    const monthName = getMonthName(currentDate.getMonth());
    const year = currentDate.getFullYear();

    if (dataLoading) {
        return <div style={{ padding: '24px' }}>Загрузка контент-плана...</div>
    }

    if (safePosts.length === 0) {
        return (
            <div style={{ padding: '24px', height: '100%' }}>
                <EmptyState
                    icon="🗓️"
                    title="Ваш контент-план пуст"
                    description="Начните создание контента, запустив помощника по созданию кампаний или сгенерировав идеи для постов."
                    buttonText="✨ Создать новую кампанию"
                    onButtonClick={() => appDispatch({ type: 'SET_CAMPAIGN_WIZARD_OPEN', payload: true })}
                />
            </div>
        );
    }
    
    return (
        <div style={styles.contentPlanLayout}>
            {tooltip && (
                <div style={{...styles.tooltipContainer, top: tooltip.y + 15, left: tooltip.x + 15 }}>
                    <div style={styles.tooltipContent}>
                       {tooltip.content}
                    </div>
                </div>
            )}
            <div style={styles.contentPlanControls}>
                <button 
                    style={{...styles.button, ...styles.buttonPrimary, width: '100%' }} 
                    className="newCampaignButton"
                    onClick={() => appDispatch({ type: 'SET_CAMPAIGN_WIZARD_OPEN', payload: true })}
                >
                    ✨ Создать кампанию
                </button>

                 <div style={{...styles.card, padding: '16px', background: 'linear-gradient(to bottom, #e7f1ff, #f8f9fa)', border: '1px solid #b8d6ff'}}>
                     <h3 style={styles.unscheduledPostsTitle}>💡 Проактивный аналитик</h3>
                     {isSuggestionLoading ? (
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', minHeight: '50px'}}>
                            <div style={{...styles.spinner, width: '20px', height: '20px', borderTop: '3px solid #007bff', borderRight: '3px solid #f3f3f3', borderBottom: '3px solid #f3f3f3', borderLeft: '3px solid #f3f3f3' }}></div>
                            <span>Анализируем ваши успехи...</span>
                        </div>
                     ) : aiSuggestion ? (
                        <p style={{fontSize: '14px', lineHeight: 1.6, color: '#0056b3', minHeight: '50px'}}>{aiSuggestion}</p>
                     ) : suggestionError ? (
                        <p style={{fontSize: '14px', color: '#dc3545', minHeight: '50px'}}>{suggestionError}</p>
                     ) : (
                        <p style={{fontSize: '14px', color: '#6c757d', minHeight: '50px'}}>Нажмите, чтобы AI проанализировал ваши посты и подсказал лучшее время для публикации.</p>
                     )}
                     <button 
                        onClick={handleGetAiSuggestion} 
                        style={{...styles.button, backgroundColor: '#fff', color: '#007bff', border: '1px solid #007bff', width: '100%', marginTop: '12px'}}
                        disabled={isSuggestionLoading}
                    >
                        {isSuggestionLoading ? 'Анализ...' : 'Получить AI-совет'}
                    </button>
                </div>
                
                 <div style={styles.unscheduledPostsContainer}>
                    <h3 style={styles.unscheduledPostsTitle}>Идеи и черновики ({unscheduledPosts.length})</h3>
                    <UnscheduledPostsList posts={unscheduledPosts} />
                </div>
            </div>

            <div style={styles.contentPlanCalendar}>
                 <header style={{display: 'flex', alignItems: 'center', marginBottom: '16px'}}>
                    <h2 style={{fontSize: '24px', fontWeight: 600}}>{monthName} {year}</h2>
                    <div style={styles.calendarNav}>
                        <button style={styles.calendarNavButton} className="calendarNavButton" onClick={() => changeMonth(-1)}>‹</button>
                        <button style={styles.calendarNavButton} className="calendarNavButton" onClick={() => setCurrentDate(new Date())}>Сегодня</button>
                        <button style={styles.calendarNavButton} className="calendarNavButton" onClick={() => changeMonth(1)}>›</button>
                    </div>
                </header>
                <div style={styles.calendarContainer}>
                    <Calendar 
                        posts={scheduledPosts} 
                        currentDate={currentDate} 
                        onDropPost={handleDropPost}
                        onShowTooltip={handleShowTooltip}
                        onHideTooltip={handleHideTooltip}
                    />
                </div>
            </div>
        </div>
    );
};