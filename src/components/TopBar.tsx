import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useDataContext } from '../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import { NotificationPanel } from './NotificationPanel';

interface TopBarProps {
    screenTitle: string;
}

const ProjectSwitcher = () => {
    const { state, dispatch } = useAppContext();
    const { projects, activeProjectId } = state;

    const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProjectId = Number(e.target.value);
        if (newProjectId !== activeProjectId) {
            dispatch({ type: 'SET_ACTIVE_PROJECT_ID', payload: newProjectId });
        }
    };
    
    if (!projects || projects.length === 0) {
        return <h2 style={{...styles.screenTitle, maxWidth: '200px'}}>Загрузка...</h2>
    }

    if (projects.length === 1) {
        return <h2 style={{...styles.screenTitle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{projects[0]?.name || 'Проект'}</h2>;
    }

    return (
        <select
            style={styles.projectSwitcher}
            value={activeProjectId || ''}
            onChange={handleProjectChange}
        >
            {projects.map(project => (
                <option key={project.id} value={project.id}>
                    {project.name}
                </option>
            ))}
        </select>
    );
};

export const TopBar: React.FC<TopBarProps> = ({ screenTitle }) => {
    const { dispatch: appDispatch } = useAppContext();
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const unreadCount = useMemo(() => 
        (Array.isArray(dataState.notifications) ? dataState.notifications : []).filter(n => !n.read).length
    , [dataState.notifications]);
    
    const handleTogglePanel = async () => {
        if (!isPanelOpen && unreadCount > 0) {
            // Mark as read on backend
            try {
                await fetchWithAuth(`${API_BASE_URL}/api/notifications/read`, { method: 'POST' });
                const updatedNotifications = dataState.notifications.map(n => ({...n, read: true}));
                dataDispatch({ type: 'SET_NOTIFICATIONS', payload: updatedNotifications });
            } catch (error) {
                console.error("Failed to mark notifications as read", error);
            }
        }
        setIsPanelOpen(!isPanelOpen);
    };

    // Close panel on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setIsPanelOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    return (
        <header style={styles.topBar}>
            <div style={styles.topBarLeft}>
                 <button style={styles.burgerButton} className="burgerButton" onClick={() => appDispatch({ type: 'TOGGLE_SIDEBAR' })}>
                    ☰
                </button>
                <ProjectSwitcher />
                <h1 style={{...styles.screenTitle, color: '#6c757d', fontWeight: 500}}>/ {screenTitle}</h1>
            </div>
             <div style={styles.topBarRight} ref={panelRef}>
                <button style={styles.notificationBell} onClick={handleTogglePanel}>
                    <span>🔔</span>
                    {unreadCount > 0 && <div style={styles.notificationBadge}>{unreadCount}</div>}
                </button>
                {isPanelOpen && <NotificationPanel onClose={() => setIsPanelOpen(false)} />}
            </div>
        </header>
    );
};