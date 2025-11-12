import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { styles } from '../styles';
import { Screen } from '../types';

const mainNavItems = [
    { id: 'content-plan', label: 'Контент-план', icon: '🗓️' },
    { id: 'community', label: 'Сообщество', icon: '💬' },
    { id: 'analytics', label: 'Аналитика', icon: '📊' },
    { id: 'knowledge-base', label: 'База знаний и Бренд', icon: '📚' },
];

const aiToolsNavItems = [
    { id: 'post-generator', label: 'Генератор постов', icon: '✍️' },
    { id: 'image-generator', label: 'Генератор изображений', icon: '🎨' },
    { id: 'image-editor', label: 'Редактор изображений', icon: '🪄' },
    { id: 'video-generator', label: 'Генератор видео', icon: '🎬' },
    { id: 'strategy-generator', label: 'Генератор стратегий', icon: '🧭' },
    { id: 'trend-spotter', label: 'Поиск трендов', 'icon': '📈' },
    { id: 'content-adapter', label: 'Адаптер контента', 'icon': '🔄' },
];

const bottomNavItems = [
    { id: 'settings', label: 'Настройки', icon: '⚙️' },
];

export const Sidebar = () => {
    const { state, dispatch } = useAppContext();
    const { isSidebarOpen, activeScreen, isAiToolsOpen } = state;

    const handleNavClick = (screen: Screen) => {
        dispatch({ type: 'SET_ACTIVE_SCREEN', payload: screen });
        if (window.innerWidth <= 768) {
            dispatch({ type: 'SET_SIDEBAR', payload: false });
        }
    };
    
    const handleLogout = () => {
        localStorage.removeItem('smm_ai_token');
        dispatch({ type: 'LOGOUT' });
    }

    const navButtonStyle = (id: Screen) => (activeScreen === id ? styles.navButtonActive : styles.navButton);

    return (
        <aside style={{ ...styles.sidebar, ...(isSidebarOpen && styles.sidebarOpen) }} className={isSidebarOpen ? 'sidebar open' : 'sidebar'}>
            <div>
                <div style={styles.logo}>SMM AI</div>
                <nav style={styles.nav}>
                    {mainNavItems.map(item => (
                        <button key={item.id} style={navButtonStyle(item.id as Screen)} onClick={() => handleNavClick(item.id as Screen)}>
                            <span style={styles.navIcon}>{item.icon}</span> {item.label}
                        </button>
                    ))}
                    
                    <button style={styles.navButton} onClick={() => dispatch({ type: 'TOGGLE_AI_TOOLS' })}>
                        <span style={styles.navIcon}>🤖</span> AI Инструменты
                        <span style={{...styles.navChevron, ...(isAiToolsOpen && styles.navChevronOpen)}}>▼</span>
                    </button>
                    <div style={{...styles.aiToolsContainer, maxHeight: isAiToolsOpen ? `${aiToolsNavItems.length * 50}px` : '0px' }}>
                         {aiToolsNavItems.map(item => (
                            <button key={item.id} style={navButtonStyle(item.id as Screen)} onClick={() => handleNavClick(item.id as Screen)}>
                                <span style={styles.navIcon}>{item.icon}</span> {item.label}
                            </button>
                        ))}
                    </div>
                </nav>
            </div>
            <nav style={styles.nav}>
                {bottomNavItems.map(item => (
                    <button key={item.id} style={navButtonStyle(item.id as Screen)} onClick={() => handleNavClick(item.id as Screen)}>
                        <span style={styles.navIcon}>{item.icon}</span> {item.label}
                    </button>
                ))}
                 <button style={styles.navButton} onClick={handleLogout}>
                    <span style={styles.navIcon}>🚪</span> Выход
                </button>
            </nav>
        </aside>
    );
};