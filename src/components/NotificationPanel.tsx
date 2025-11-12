import React from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { styles } from '../styles';
import { timeAgo } from '../lib/timeUtils';
import type { Notification } from '../types';

const NotificationItem = ({ notification, onClick }: { notification: Notification, onClick: (notification: Notification) => void }) => {
    const itemStyle = {
        ...styles.notificationItem,
        ...(notification.read ? {} : styles.notificationItemUnread)
    };
    return (
        <div style={itemStyle} onClick={() => onClick(notification)}>
            <p style={styles.notificationItemMessage}>{notification.message}</p>
            <p style={styles.notificationItemTimestamp}>{timeAgo(notification.timestamp)}</p>
        </div>
    );
};

export const NotificationPanel = ({ onClose }: { onClose: () => void }) => {
    const { state: dataState } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const { notifications } = dataState;

    const sortedNotifications = (Array.isArray(notifications) ? [...notifications] : [])
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const handleItemClick = (notification: Notification) => {
        if (notification.link) {
            appDispatch({ type: 'SET_ACTIVE_SCREEN', payload: notification.link.screen });
        }
        onClose();
    };

    return (
        <div style={styles.notificationPanel}>
            <div style={styles.notificationPanelHeader}>Уведомления</div>
            <div style={styles.notificationList}>
                {sortedNotifications.length > 0 ? (
                    sortedNotifications.map(n => (
                        <NotificationItem key={n.id} notification={n} onClick={handleItemClick} />
                    ))
                ) : (
                    <p style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>Новых уведомлений нет</p>
                )}
            </div>
        </div>
    );
};