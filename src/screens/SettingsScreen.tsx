import React, { useState, useEffect } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import type { Project, AiProvider, AiProviderKeyStatus, CustomAiProvider } from '../types';

const ConnectedAccountsSection = () => {
    const { state: dataState } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();

    const isTelegramConnected = !!(dataState.settings.telegram?.token && dataState.settings.telegram?.chatId);

    return (
        <div style={styles.settingsSectionCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={styles.settingsSectionTitle}>Подключенные аккаунты</h2>
                <button
                    style={{ ...styles.button, ...styles.buttonPrimary }}
                    onClick={() => appDispatch({ type: 'SET_ADD_ACCOUNT_MODAL_OPEN', payload: true })}
                >
                    + Добавить новый аккаунт
                </button>
            </div>
            
            {!isTelegramConnected ? (
                <p style={{ color: '#6c757d', textAlign: 'center', padding: '20px 0' }}>
                    У вас пока нет подключенных аккаунтов.
                </p>
            ) : (
                <div style={{ ...styles.platformGrid, gridTemplateColumns: '1fr' }}>
                    {isTelegramConnected && (
                        <div style={styles.platformCard}>
                            <div style={styles.platformIcon}>✈️</div>
                            <div style={styles.platformInfo}>
                                <div style={styles.platformName}>Telegram</div>
                                <div style={styles.statusConnected}>
                                    <div style={{ ...styles.statusIndicator, backgroundColor: '#28a745' }}></div>
                                    <span>Подключен</span>
                                </div>
                            </div>
                            <button
                                style={{ ...styles.button, ...styles.buttonSecondary, ...styles.platformButton }}
                                onClick={() => appDispatch({ type: 'SET_TELEGRAM_CONNECT_MODAL_OPEN', payload: true })}
                            >
                                Настроить
                            </button>
                        </div>
                    )}
                </div>
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

const AI_PROVIDERS: { id: AiProvider; name: string; icon: string }[] = [
    { id: 'google', name: 'Google Gemini', icon: '✨' },
    { id: 'openai', name: 'OpenAI', icon: '🧠' },
    { id: 'anthropic', name: 'Anthropic', icon: '📚' },
];

const AiProvidersSection = () => {
    const { dispatch: appDispatch } = useAppContext();
    const [keyStatuses, setKeyStatuses] = useState<AiProviderKeyStatus[]>([]);
    const [customProviders, setCustomProviders] = useState<CustomAiProvider[]>([]);
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statuses, custom] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/api/ai-keys`),
                fetchWithAuth(`${API_BASE_URL}/api/custom-ai-providers`),
            ]);
            setKeyStatuses(statuses);
            setCustomProviders(custom);
        } catch (error) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Не удалось загрузить данные AI-провайдеров.', type: 'error' } });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveKey = async (provider: AiProvider | string) => {
        const apiKey = apiKeys[provider];
        if (!apiKey?.trim()) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'API ключ не может быть пустым.', type: 'error' } });
            return;
        }
        try {
            await fetchWithAuth(`${API_BASE_URL}/api/ai-keys`, {
                method: 'POST',
                body: JSON.stringify({ provider, apiKey }),
            });
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ключ для ${provider} сохранен.`, type: 'success' } });
            setApiKeys(prev => ({ ...prev, [provider]: '' }));
            fetchData();
        } catch (error) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${error instanceof Error ? error.message : 'Не удалось сохранить ключ.'}`, type: 'error' } });
        }
    };

    const handleDeleteKey = async (provider: AiProvider | string) => {
        if (window.confirm(`Вы уверены, что хотите удалить ключ для ${provider}?`)) {
            try {
                await fetchWithAuth(`${API_BASE_URL}/api/ai-keys/${provider}`, { method: 'DELETE' });
                appDispatch({ type: 'ADD_TOAST', payload: { message: `Ключ для ${provider} удален.`, type: 'success' } });
                fetchData();
            } catch (error) {
                 appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${error instanceof Error ? error.message : 'Не удалось удалить ключ.'}`, type: 'error' } });
            }
        }
    };
    
    const handleDeleteCustomProvider = async (provider: CustomAiProvider) => {
        if (window.confirm(`Вы уверены, что хотите удалить провайдер "${provider.displayName}"?`)) {
            try {
                await fetchWithAuth(`${API_BASE_URL}/api/custom-ai-providers/${provider.id}`, { method: 'DELETE' });
                appDispatch({ type: 'ADD_TOAST', payload: { message: `Провайдер "${provider.displayName}" удален.`, type: 'success' } });
                fetchData();
            } catch (error) {
                appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${error instanceof Error ? error.message : 'Не удалось удалить провайдер.'}`, type: 'error' } });
            }
        }
    }

    if (loading) {
        return <div style={styles.settingsSectionCard}><div style={styles.spinner}></div> Загрузка...</div>;
    }

    return (
        <div style={styles.settingsSectionCard}>
             <h2 style={styles.settingsSectionTitle}>Основные провайдеры</h2>
            <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                {AI_PROVIDERS.map(provider => {
                    const status = keyStatuses.find(s => s.providerName === provider.id);
                    const isConnected = status?.isSet || false;
                    return (
                        <div key={provider.id} style={styles.platformCard}>
                             <div style={styles.platformIcon}>{provider.icon}</div>
                            <div style={styles.platformInfo}>
                                <div style={styles.platformName}>{provider.name}</div>
                                 <div style={isConnected ? styles.statusConnected : styles.statusDisconnected}>
                                    <div style={{...styles.statusIndicator, backgroundColor: isConnected ? '#28a745' : '#6c757d'}}></div>
                                    <span>{isConnected ? 'Подключен' : 'Не подключен'}</span>
                                </div>
                            </div>
                            <div style={{display: 'flex', gap: '8px', flex: 1}}>
                                <input
                                    type="password"
                                    style={styles.inviteInput}
                                    placeholder={isConnected ? '••••••••••••••••' : 'Введите ваш API ключ'}
                                    value={apiKeys[provider.id] || ''}
                                    onChange={e => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                />
                                <button style={{...styles.button, ...styles.buttonPrimary}} onClick={() => handleSaveKey(provider.id)}>Сохранить</button>
                                {isConnected && <button style={{...styles.button, ...styles.buttonDanger}} onClick={() => handleDeleteKey(provider.id)}>Удалить</button>}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ borderTop: '1px solid #e9ecef', marginTop: '32px', paddingTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={styles.settingsSectionTitle}>Пользовательские провайдеры</h2>
                    <button style={{ ...styles.button, ...styles.buttonPrimary }}>+ Добавить провайдера</button>
                </div>
                 <p style={{ color: '#6c757d', marginTop: '-16px', marginBottom: '24px' }}>
                    Подключайте любые OpenAI-совместимые API (например, Grok, Deepseek, локальные модели).
                </p>

                {customProviders.length === 0 ? (
                    <p style={{ color: '#6c757d', textAlign: 'center' }}>Пользовательские провайдеры не добавлены.</p>
                ) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                        {customProviders.map(p => (
                            <div key={p.id} style={{ ...styles.teamMemberItem, alignItems: 'flex-start' }}>
                                <div style={styles.teamMemberInfo}>
                                    <span style={styles.teamMemberEmail}>{p.displayName}</span>
                                    <span style={styles.teamMemberRole}>
                                        {p.apiBaseUrl || 'URL не указан'}
                                    </span>
                                </div>
                                <div style={p.isKeySet ? styles.statusConnected : styles.statusDisconnected}>
                                    <div style={{ ...styles.statusIndicator, backgroundColor: p.isKeySet ? '#28a745' : '#dc3545' }}></div>
                                    <span>{p.isKeySet ? 'Ключ добавлен' : 'Нет ключа'}</span>
                                </div>
                                <button style={{ ...styles.teamRemoveButton, color: '#007bff' }}>Редактировать</button>
                                <button style={styles.teamRemoveButton} onClick={() => handleDeleteCustomProvider(p)}>Удалить</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export const SettingsScreen = () => {
    const [activeTab, setActiveTab] = useState<'projects' | 'team' | 'accounts' | 'ai-providers'>('projects');
    
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
                     <button
                        style={activeTab === 'ai-providers' ? styles.settingsTabButtonActive : styles.settingsTabButton}
                        onClick={() => setActiveTab('ai-providers')}
                    >
                        AI Провайдеры
                    </button>
                </div>
            </div>

            {activeTab === 'projects' && <ProjectManagementSection />}
            {activeTab === 'team' && <TeamManagementSection />}
            {activeTab === 'accounts' && <ConnectedAccountsSection />}
            {activeTab === 'ai-providers' && <AiProvidersSection />}
        </div>
    );
};