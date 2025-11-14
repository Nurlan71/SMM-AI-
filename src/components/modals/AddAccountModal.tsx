import React from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { styles } from '../../styles';

const ALL_PLATFORMS = [
    { id: 'telegram', name: 'Telegram', icon: '✈️', available: true },
    { id: 'instagram', name: 'Instagram', icon: '📸', available: false },
    { id: 'vk', name: 'VKontakte', icon: '👥', available: false },
    { id: 'youtube', name: 'YouTube', icon: '📺', available: false },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', available: false },
    { id: 'pinterest', name: 'Pinterest', icon: '📌', available: false },
    { id: 'ok', name: 'Odnoklassniki', icon: '🧑‍🤝‍🧑', available: false },
    { id: 'rutube', name: 'RuTube', icon: '🇷🇺', available: false },
];

export const AddAccountModal = () => {
    const { dispatch } = useAppContext();

    const handleClose = () => {
        dispatch({ type: 'SET_ADD_ACCOUNT_MODAL_OPEN', payload: false });
    };

    const handleConnectClick = (platformId: string, isAvailable: boolean) => {
        if (!isAvailable) {
            dispatch({ type: 'ADD_TOAST', payload: { message: 'Интеграция с этой платформой скоро появится!', type: 'success' } });
            return;
        }
        if (platformId === 'telegram') {
            handleClose(); // Close this modal
            dispatch({ type: 'SET_TELEGRAM_CONNECT_MODAL_OPEN', payload: true }); // Open Telegram modal
        }
    };

    return (
        <div style={styles.modalOverlay} onClick={handleClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <header style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>Добавить аккаунт</h3>
                    <button style={styles.modalCloseButton} onClick={handleClose}>&times;</button>
                </header>
                <div style={styles.modalBody}>
                    <p style={{ color: '#6c757d', marginBottom: '24px' }}>
                        Выберите социальную сеть, которую хотите подключить.
                    </p>
                    <div style={{...styles.platformGrid, gridTemplateColumns: '1fr'}}>
                        {ALL_PLATFORMS.map(platform => (
                            <div key={platform.id} style={styles.platformCard}>
                                <div style={styles.platformIcon}>{platform.icon}</div>
                                <div style={styles.platformInfo}>
                                    <div style={styles.platformName}>{platform.name}</div>
                                </div>
                                <button
                                    style={{
                                        ...styles.button, 
                                        ...(platform.available ? styles.buttonPrimary : styles.buttonDisabled), 
                                        ...styles.platformButton,
                                        minWidth: '110px'
                                    }}
                                    onClick={() => handleConnectClick(platform.id, platform.available)}
                                >
                                    {platform.available ? 'Подключить' : 'Скоро'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                <footer style={styles.modalFooter}>
                    <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={handleClose}>
                        Закрыть
                    </button>
                </footer>
            </div>
        </div>
    );
};