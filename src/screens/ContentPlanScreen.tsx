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


const Calendar = ({ posts, currentDate }: { posts: Post[], currentDate: Date }) => {
    const { dispatch: appDispatch } = useAppContext();
    const monthDays = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const today = new Date();

    const handlePostClick = (postId: number) => {
        appDispatch({ type: 'OPEN_POST_DETAIL_MODAL', payload: postId });
    };
    
    const handleAddPost = (date: Date) => {
        // In the future, this would open a modal with the date pre-filled
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
                    const postDate = new Date(post.publishDate || '');
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

    if (!posts || posts.length === 0) {
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
        <div style={styles.contentPlanContainer}>
            <header style={styles.contentPlanHeader}>
                <h2 style={styles.contentPlanTitle}>{monthName} {year}</h2>
                <div style={styles.calendarNav}>
                    <button style={styles.calendarNavButton} className="calendarNavButton" onClick={() => changeMonth(-1)}>‹</button>
                    <button style={styles.calendarNavButton} className="calendarNavButton" onClick={() => setCurrentDate(new Date())}>Сегодня</button>
                    <button style={styles.calendarNavButton} className="calendarNavButton" onClick={() => changeMonth(1)}>›</button>
                </div>
                <button 
                    style={{...styles.button, ...styles.buttonPrimary, marginLeft: 'auto' }} 
                    className="newCampaignButton"
                    onClick={() => appDispatch({ type: 'SET_CAMPAIGN_WIZARD_OPEN', payload: true })}
                >
                    ✨ Создать кампанию
                </button>
            </header>
            <div style={styles.calendarContainer}>
                <Calendar posts={posts} currentDate={currentDate} />
            </div>
        </div>
    );
};