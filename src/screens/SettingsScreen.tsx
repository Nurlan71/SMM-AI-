import React, { useState } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import type { Project } from '../types';

const ALL_PLATFORMS = [
    { id: 'telegram', name: 'Telegram', icon: '✈️', available: true },
    { id: 'instagram', name: 'Instagram', icon: '📸', available: false },
    { id: 'vk', name: 'VKontakte', icon: '👥', available: false },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', available: false },
    { id: 'twitter', name: 'X (Twitter)', icon: '🐦', available: false },
    { id: 'youtube', name: 'YouTube', icon: '📺', available: false },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', available: false },
];

const ConnectedAccountsSection = () => {
    const { state: dataState } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();

    const handleConnectClick = (platformId: string, isAvailable: boolean) => {
        if (!isAvailable) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Интеграция с этой платформой скоро появится!', type: 'success' } });
            return;
        }
        if (platformId === 'telegram') {
            appDispatch({ type: 'SET_TELEGRAM_CONNECT_MODAL_OPEN', payload: true });
        }
    };

    const isTelegramConnected = !!(dataState.settings.telegram?.token && dataState.settings.telegram?.chatId);

    const getPlatformStatus = (platformId: string) => {
        if (platformId === 'telegram') {
            return isTelegramConnected;
        }
        return false; // For other platforms
    };

    return (
        <div style={styles.settingsSectionCard}>
            <h2 style={styles.settingsSectionTitle}>Подключенные аккаунты</h2>
            <p style={{ color: '#6c757d', marginTop: '-16px', marginBottom: '24px' }}>
                Управляйте вашими социальными сетями для автоматического постинга.
            </p>
            <div style={{...styles.platformGrid, gridTemplateColumns: '1fr'}}>
                {ALL_PLATFORMS.map(platform => {
                    const isConnected = getPlatformStatus(platform.id);
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
                                style={{
                                    ...styles.button, 
                                    ...(platform.available ? (isConnected ? styles.buttonSecondary : styles.buttonPrimary) : styles.buttonDisabled), 
                                    ...styles.platformButton,
                                    minWidth: '110px'
                                }}
                                onClick={() => handleConnectClick(platform.id, platform.available)}
                            >
                                {platform.available ? (isConnected ? 'Настроить' : 'Подключить') : 'Скоро'}
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

const ProjectManagementSection = () => {
    const { state: appState, dispatch: appDispatch } = useAppContext();
    const { projects, activeProjectId } = appState;
    const [modalState, setModalState] = useState<{ isOpen: boolean, project?: Project, mode: 'create' | 'rename' }>({ isOpen: false, mode: 'create' });
    const [projectName, setProjectName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const openModal = (mode: 'create' | 'rename', project?: Project) => {
        setModalState({ isOpen: true, mode, project });
        setProjectName(project ? project.name : '');
    };

    const closeModal = () => {
        setModalState({ isOpen: false, mode: 'create' });
        setProjectName('');
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (!projectName.trim()) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Название проекта не может быть пустым', type: 'error' } });
            return;
        }
        setIsLoading(true);
        try {
            if (modalState.mode === 'create') {
                const newProject = await fetchWithAuth(`${API_BASE_URL}/api/projects`, {
                    method: 'POST', body: JSON.stringify({ name: projectName }),
                });
                appDispatch({ type: 'ADD_PROJECT', payload: newProject });
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Проект создан!', type: 'success' } });
            } else if (modalState.project) {
                const updatedProject = await fetchWithAuth(`${API_BASE_URL}/api/projects/${modalState.project.id}`, {
                    method: 'PUT', body: JSON.stringify({ name: projectName }),
                });
                appDispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Проект переименован!', type: 'success' } });
            }
            closeModal();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Не удалось сохранить проект.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
            setIsLoading(false);
        }
    };

    const handleDelete = async (project: Project) => {
        if (window.confirm(`Вы уверены, что хотите удалить проект "${project.name}"? Это действие необратимо.`)) {
            try {
                await fetchWithAuth(`${API_BASE_URL}/api/projects/${project.id}`, { method: 'DELETE' });
                appDispatch({ type: 'DELETE_PROJECT', payload: project.id });
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Проект удален.', type: 'success' } });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Не удалось удалить проект.";
                appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
            }
        }
    };

    return (
        <div style={styles.settingsSectionCard}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
                 <h2 style={styles.settingsSectionTitle}>Управление проектами</h2>
                 <button style={{...styles.button, ...styles.buttonPrimary}} onClick={() => openModal('create')}>+ Создать проект</button>
            </div>
            <div style={styles.teamList}>
                {projects.map(project => (
                    <div key={project.id} style={{...styles.teamMemberItem, backgroundColor: project.id === activeProjectId ? '#e7f1ff' : '#f8f9fa' }}>
                        <div style={styles.teamMemberInfo}>
                            <span style={styles.teamMemberEmail}>{project.name} {project.id === activeProjectId && '(текущий)'}</span>
                        </div>
                        <button style={{...styles.teamRemoveButton, color: '#007bff'}} onClick={() => openModal('rename', project)}>Переименовать</button>
                        <button 
                            style={{...styles.teamRemoveButton, color: projects.length <= 1 ? '#adb5bd' : '#dc3545', cursor: projects.length <= 1 ? 'not-allowed' : 'pointer'}} 
                            onClick={() => handleDelete(project)}
                            disabled={projects.length <= 1}
                            title={projects.length <= 1 ? "Нельзя удалить последний проект" : "Удалить проект"}
                        >
                            Удалить
                        </button>
                    </div>
                ))}
            </div>

            {modalState.isOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <header style={styles.modalHeader}>
                            <h3 style={styles.modalTitle}>{modalState.mode === 'create' ? 'Создание нового проекта' : 'Переименование проекта'}</h3>
                            <button style={styles.modalCloseButton} onClick={closeModal}>&times;</button>
                        </header>
                        <div style={styles.modalBody}>
                            <label style={styles.generatorLabel}>Название проекта</label>
                            <input type="text" style={styles.inviteInput} value={projectName} onChange={e => setProjectName(e.target.value)} autoFocus/>
                        </div>
                        <footer style={styles.modalFooter}>
                             <button style={{...styles.button, ...styles.buttonSecondary}} onClick={closeModal}>Отмена</button>
                             <button style={isLoading ? styles.buttonDisabled : {...styles.button, ...styles.buttonPrimary}} onClick={handleSave} disabled={isLoading}>
                                {isLoading ? 'Сохранение...' : 'Сохранить'}
                             </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};


export const SettingsScreen = () => {
    const [activeTab, setActiveTab] = useState<'projects' | 'team' | 'accounts'>('projects');
    
    return (
         <div style={styles.settingsLayout}>
            <div style={{...styles.settingsSectionCard, padding: '0', maxWidth: 'none'}}>
                <div style={styles.settingsTabsContainer}>
                     <button
                        style={activeTab === 'projects' ? styles.settingsTabButtonActive : styles.settingsTabButton}
                        onClick={() => setActiveTab('projects')}
                    >
                        Проекты
                    </button>
                    <button
                        style={activeTab === 'team' ? styles.settingsTabButtonActive : styles.settingsTabButton}
                        onClick={() => setActiveTab('team')}
                    >
                        Команда
                    </button>
                    <button
                        style={activeTab === 'accounts' ? styles.settingsTabButtonActive : styles.settingsTabButton}
                        onClick={() => setActiveTab('accounts')}
                    >
                        Аккаунты
                    </button>
                </div>
            </div>

            {activeTab === 'projects' && <ProjectManagementSection />}
            {activeTab === 'team' && <TeamManagementSection />}
            {activeTab === 'accounts' && <ConnectedAccountsSection />}
        </div>
    );
};