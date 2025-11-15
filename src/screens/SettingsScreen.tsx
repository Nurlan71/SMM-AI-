import React, { useState } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';

const ConnectedAccountsSection = () => {
    const { state: dataState } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();

    const handleConnect = (platformId: string) => {
        if (platformId === 'telegram') {
            appDispatch({ type: 'SET_TELEGRAM_CONNECT_MODAL_OPEN', payload: true });
        } else {
             appDispatch({ type: 'SET_ADD_ACCOUNT_MODAL_OPEN', payload: true });
        }
    };
    
    // Determine connection status from settings
    const isTelegramConnected = !!(dataState.settings.telegram?.token && dataState.settings.telegram?.chatId);
    // In the future, we would check other platforms here
    const connectedPlatforms = [];
    if (isTelegramConnected) {
        connectedPlatforms.push({ id: 'telegram', name: 'Telegram', icon: '✈️' });
    }

    return (
        <div style={styles.settingsSectionCard}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
                <div>
                    <h2 style={styles.settingsSectionTitle}>Подключенные аккаунты</h2>
                    <p style={{ color: '#6c757d', marginTop: '-16px' }}>
                        Управляйте вашими социальными сетями для автоматического постинга.
                    </p>
                </div>
                <button
                    style={{ ...styles.button, ...styles.buttonPrimary}}
                    onClick={() => appDispatch({ type: 'SET_ADD_ACCOUNT_MODAL_OPEN', payload: true })}
                >
                    + Добавить аккаунт
                </button>
            </div>
            {connectedPlatforms.length > 0 ? (
                <div style={{...styles.platformGrid, gridTemplateColumns: '1fr'}}>
                    {connectedPlatforms.map(platform => (
                        <div key={platform.id} style={styles.platformCard}>
                            <div style={styles.platformIcon}>{platform.icon}</div>
                            <div style={styles.platformInfo}>
                                <div style={styles.platformName}>{platform.name}</div>
                                <div style={styles.statusConnected}>
                                    <div style={{...styles.statusIndicator, backgroundColor: '#28a745'}}></div>
                                    <span>Подключен</span>
                                </div>
                            </div>
                            <button
                                style={{...styles.button, ...styles.buttonSecondary, ...styles.platformButton}}
                                onClick={() => handleConnect(platform.id)}
                            >
                                Настроить
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                 <p style={{textAlign: 'center', color: '#6c757d', padding: '20px 0'}}>У вас пока нет подключенных аккаунтов.</p>
            )}
        </div>
    );
};

const TeamManagementSection = () => {
    const { state, dispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const { team } = state;

    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !/\S+@\S+\.\S+/.test(inviteEmail)) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пожалуйста, введите корректный email', type: 'error' } });
            return;
        }
        setIsInviting(true);
        try {
            const newMember = await fetchWithAuth(`${API_BASE_URL}/api/team/invite`, {
                method: 'POST',
                body: JSON.stringify({ email: inviteEmail }),
            });
            dispatch({ type: 'ADD_TEAM_MEMBER', payload: newMember });
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Приглашение отправлено на ${inviteEmail}`, type: 'success' } });
            setInviteEmail('');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Не удалось пригласить участника.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsInviting(false);
        }
    };

    const handleRemove = async (memberId: number, memberEmail: string) => {
        if (window.confirm(`Вы уверены, что хотите удалить ${memberEmail} из проекта?`)) {
            try {
                await fetchWithAuth(`${API_BASE_URL}/api/team/${memberId}`, { method: 'DELETE' });
                dispatch({ type: 'REMOVE_TEAM_MEMBER', payload: memberId });
                appDispatch({ type: 'ADD_TOAST', payload: { message: `${memberEmail} удален из проекта`, type: 'success' } });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Не удалось удалить участника.";
                appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
            }
        }
    };

    const handleRoleChange = async (memberId: number, newRole: 'SMM-менеджер' | 'Гость') => {
         try {
            const updatedMember = await fetchWithAuth(`${API_BASE_URL}/api/team/${memberId}`, {
                method: 'PUT',
                body: JSON.stringify({ role: newRole }),
            });
            dispatch({ type: 'UPDATE_TEAM_MEMBER', payload: updatedMember });
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Роль для ${updatedMember.email} обновлена.`, type: 'success' } });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Не удалось изменить роль.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        }
    };

    return (
        <div style={styles.settingsSectionCard}>
            <h2 style={styles.settingsSectionTitle}>Управление командой проекта</h2>
            <div style={styles.teamList}>
                {team.map(member => (
                    <div key={member.id} style={styles.teamMemberItem}>
                        <div style={{...styles.teamMemberAvatar, backgroundColor: member.role === 'Владелец' ? '#007bff' : '#6c757d'}}>
                            {member.email.charAt(0).toUpperCase()}
                        </div>
                        <div style={styles.teamMemberInfo}>
                            <span style={styles.teamMemberEmail}>{member.email}</span>
                            {member.role === 'Владелец' ? (
                                <span style={styles.teamMemberRole}>{member.role}</span>
                            ) : (
                                <select 
                                    style={styles.teamRoleSelect} 
                                    value={member.role}
                                    onChange={(e) => handleRoleChange(member.id, e.target.value as 'SMM-менеджер' | 'Гость')}
                                >
                                    <option value="SMM-менеджер">SMM-менеджер</option>
                                    <option value="Гость">Гость</option>
                                </select>
                            )}
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
                    placeholder="Email пользователя для приглашения в проект"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={isInviting}
                />
                <button type="submit" style={isInviting ? styles.buttonDisabled : styles.inviteButton} className="inviteButton" disabled={isInviting}>
                    {isInviting ? 'Отправка...' : 'Пригласить'}
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