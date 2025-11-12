import React, { useState, useMemo } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { useDataContext } from '../contexts/DataContext';
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
    if (posts.length === 0) {
        return <p style={{color: '#6c757d', fontSize: '14px', textAlign: 'center'}}>Здесь будут появляться ваши идеи и черновики.</p>;
    }

    return (
        <div>
            {posts.map(post => (
                 <div
                    key={post.id}
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


const Calendar = ({ posts, currentDate }: { posts: Post[], currentDate: Date }) => {
    const { dispatch: appDispatch } = useAppContext();
    const monthDays = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const today = new Date();

    const handlePostClick = (postId: number) => {
        appDispatch({ type: 'OPEN_POST_DETAIL_MODAL', payload: postId });
    };
    
    const handleAddPost = (date: Date) => {
        console.log('Add post for:', date.toLocaleDateString());
         appDispatch({ type: 'SET_CAMPAIGN_WIZARD_OPEN', payload: true });
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
                };

                const postsForDay = posts.filter(post => {
                    if (!post || !post.publishDate) return false;
                    const postDate = new Date(post.publishDate);
                    return postDate.getDate() === day.date.getDate() &&
                           postDate.getMonth() === day.date.getMonth() &&
                           postDate.getFullYear() === day.date.getFullYear();
                });

                return (
                    <div key={index} style={dayStyle} className="calendarDay">
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
    const { state: dataState } = useDataContext();
    const { posts, dataLoading } = dataState;
    const [currentDate, setCurrentDate] = useState(new Date());

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
            <div style={styles.contentPlanControls}>
                <button 
                    style={{...styles.button, ...styles.buttonPrimary, width: '100%' }} 
                    className="newCampaignButton"
                    onClick={() => appDispatch({ type: 'SET_CAMPAIGN_WIZARD_OPEN', payload: true })}
                >
                    ✨ Создать кампанию
                </button>
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
                    <Calendar posts={scheduledPosts} currentDate={currentDate} />
                </div>
            </div>
        </div>
    );
};
