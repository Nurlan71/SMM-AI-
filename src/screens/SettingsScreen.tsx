import React, { useState } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { styles } from '../styles';

const PLATFORMS = [
    { id: 'telegram', name: 'Telegram', icon: '✈️' },
    { id: 'instagram', name: 'Instagram', icon: '📸' },
    { id: 'vk', name: 'VKontakte', icon: '👥' },
    { id: 'youtube', name: 'YouTube', icon: '📺' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵' },
    { id: 'pinterest', name: 'Pinterest', icon: '📌' },
    { id: 'ok', name: 'Odnoklassniki', icon: '🧑‍🤝‍🧑' },
    { id: 'rutube', name: 'RuTube', icon: '🇷🇺' },
];

const ConnectedAccountsSection = () => {
    const { state: dataState } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();

    const handleConnect = (platformId: string) => {
        if (platformId === 'telegram') {
            appDispatch({ type: 'SET_TELEGRAM_CONNECT_MODAL_OPEN', payload: true });
        } else {
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Интеграция с ${platformId} будет добавлена позже.`, type: 'error' } });
        }
    };
    
    // Determine connection status from settings
    const isTelegramConnected = !!(dataState.settings.telegram?.token && dataState.settings.telegram?.chatId);

    const getIsConnected = (platformId: string) => {
        if (platformId === 'telegram') return isTelegramConnected;
        return false; // For other platforms
    };

    return (
        <div style={styles.settingsSectionCard}>
            <h2 style={styles.settingsSectionTitle}>Подключенные аккаунты</h2>
            <p style={{ color: '#6c757d', marginTop: '-16px', marginBottom: '24px' }}>
                Подключите ваши социальные сети для автоматического постинга и сбора аналитики.
            </p>
            <div style={styles.platformGrid}>
                {PLATFORMS.map(platform => {
                    const isConnected = getIsConnected(platform.id);
                    return (
                        <div key={platform.id} style={styles.platformCard}>
                            <div style={styles.platformIcon}>{platform.icon}</div>
                            <div style={styles.platformInfo}>
                                <div style={styles.platformName}>{platform.name}</div>
                                <div style={isConnected ? styles.statusConnected : styles.statusDisconnected}>
                                    <div style={{...styles.statusIndicator, backgroundColor: isConnected ? '#28a745' : '#6c757d'}}></div>
                                    <span>{isConnected ? 'Подключен' : 'Не подключен'}</span>
                                </div>
                            </div>
                            <button
                                style={{...styles.button, ...(isConnected ? styles.buttonSecondary : styles.buttonPrimary), ...styles.platformButton}}
                                onClick={() => handleConnect(platform.id)}
                            >
                                {isConnected ? 'Настроить' : 'Подключить'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const TeamManagementSection = () => {
    const { state, dispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const { team } = state;

    const [inviteEmail, setInviteEmail] = useState('');

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        if (inviteEmail.trim() && /\S+@\S+\.\S+/.test(inviteEmail)) {
            const newMember = {
                id: Date.now(),
                email: inviteEmail,
                role: 'Гость' as const,
            };
            dispatch({ type: 'ADD_TEAM_MEMBER', payload: newMember });
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Приглашение отправлено на ${inviteEmail}`, type: 'success' } });
            setInviteEmail('');
        } else {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пожалуйста, введите корректный email', type: 'error' } });
        }
    };

    const handleRemove = (memberId: number, memberEmail: string) => {
        if (window.confirm(`Вы уверены, что хотите удалить ${memberEmail} из команды?`)) {
            dispatch({ type: 'REMOVE_TEAM_MEMBER', payload: memberId });
            appDispatch({ type: 'ADD_TOAST', payload: { message: `${memberEmail} удален из команды`, type: 'success' } });
        }
    };

    return (
        <div style={styles.settingsSectionCard}>
            <h2 style={styles.settingsSectionTitle}>Управление командой</h2>
            <div style={styles.teamList}>
                {team.map(member => (
                    <div key={member.id} style={styles.teamMemberItem}>
                        <div style={{...styles.teamMemberAvatar, backgroundColor: member.role === 'Владелец' ? '#007bff' : '#6c757d'}}>
                            {member.email.charAt(0).toUpperCase()}
                        </div>
                        <div style={styles.teamMemberInfo}>
                            <span style={styles.teamMemberEmail}>{member.email}</span>
                            <span style={styles.teamMemberRole}>{member.role}</span>
                        </div>
                        {member.role !== 'Владелец' && (
                            <button style={styles.teamRemoveButton} className="teamRemoveButton" onClick={() => handleRemove(member.id, member.email)}>
                                Удалить
                            </button>
                        )}
                    </div>
                ))}
            </div>
            <form style={styles.inviteForm} onSubmit={handleInvite}>
                <input
                    type="email"
                    style={styles.inviteInput}
                    placeholder="Email нового участника"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                />
                <button type="submit" style={styles.inviteButton} className="inviteButton">
                    Пригласить
                </button>
            </form>
        </div>
    );
};

export const SettingsScreen = () => {
    return (
        <div style={styles.settingsLayout}>
            <ConnectedAccountsSection />
            <TeamManagementSection />
        </div>
    );
};