import React, { useState, useEffect, useCallback } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { styles } from '../styles';
import type { Settings, TeamMember } from '../types';

const platformOptions = [
    { id: 'instagram', name: 'Instagram', icon: '📸' },
    { id: 'vk', name: 'VK', icon: '👥' },
    { id: 'telegram', name: 'Telegram', icon: '✈️' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵' },
    { id: 'youtube', name: 'YouTube', icon: '📺' },
    { id: 'dzen', name: 'Дзен', icon: '🧘' },
    { id: 'pinterest', name: 'Pinterest', icon: '📌' },
    { id: 'odnoklassniki', name: 'Одноклассники', icon: '🧑‍🤝‍🧑' },
    { id: 'rutube', name: 'Rutube', icon: '▶️' },
];


export const SettingsScreen = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    
    const [localSettings, setLocalSettings] = useState<Settings>(dataState.settings);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('SMM-менеджер');

    useEffect(() => {
        setLocalSettings(dataState.settings);
        setIsDirty(false); // Reset dirty state when global state changes
    }, [dataState.settings]);
    
    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const handleSettingChange = (field: keyof Settings, value: any) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
        if (!isDirty) setIsDirty(true);
    };

    const handlePlatformToggle = (platformId: string) => {
        const newPlatforms = localSettings.platforms.includes(platformId)
            ? localSettings.platforms.filter(p => p !== platformId)
            : [...localSettings.platforms, platformId];
        handleSettingChange('platforms', newPlatforms);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/settings`, {
                method: 'POST',
                body: JSON.stringify(localSettings),
            });
            const savedSettings = await response.json();
            dataDispatch({ type: 'SET_SETTINGS', payload: savedSettings });
            addToast('Настройки успешно сохранены!', 'success');
            setIsDirty(false);
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Не удалось сохранить настройки.', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleInvite = () => {
        if (!inviteEmail) return;
        const newMember: TeamMember = {
            id: Date.now(),
            email: inviteEmail,
            role: inviteRole,
        };
        dataDispatch({ type: 'ADD_TEAM_MEMBER', payload: newMember });
        addToast(`Приглашение отправлено на ${inviteEmail}`, 'success');
        setInviteEmail('');
    };

    const handleRemoveMember = (memberId: number) => {
        if (window.confirm('Вы уверены, что хотите удалить этого участника?')) {
             dataDispatch({ type: 'REMOVE_TEAM_MEMBER', payload: memberId });
             addToast('Участник команды удален.', 'success');
        }
    };

    return (
        <div style={styles.settingsLayout}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Тон голоса (Tone of Voice)</h2>
                    <p style={styles.cardSubtitle}>Опишите, как должен общаться AI. Это повлияет на стиль всех генерируемых текстов.</p>
                    <textarea
                        style={{ ...styles.textarea, minHeight: '120px' }}
                        placeholder="Например: 'Дружелюбный, но экспертный. Обращаемся к клиентам на 'вы', используем эмодзи...'"
                        value={localSettings.toneOfVoice}
                        onChange={(e) => handleSettingChange('toneOfVoice', e.target.value)}
                    />
                </div>
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Ключевые и стоп-слова</h2>
                     <p style={styles.cardSubtitle}>Укажите слова, которые AI должен часто использовать или, наоборот, избегать.</p>
                    <textarea
                        style={{ ...styles.textarea, minHeight: '100px' }}
                        placeholder="Например: 'ключевые: #одеждаручнойработы; стоп-слова: дешевый, скидка'"
                        value={localSettings.keywords}
                        onChange={(e) => handleSettingChange('keywords', e.target.value)}
                    />
                </div>
                 <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Целевая аудитория</h2>
                     <p style={styles.cardSubtitle}>Опишите вашу аудиторию, чтобы AI создавал более релевантный контент.</p>
                    <textarea
                        style={{ ...styles.textarea, minHeight: '120px' }}
                        placeholder="Например: 'Женщины 25-45 лет, ценящие уют, ручную работу...'"
                        value={localSettings.targetAudience}
                        onChange={(e) => handleSettingChange('targetAudience', e.target.value)}
                    />
                </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Подключенные платформы</h2>
                    <p style={styles.cardSubtitle}>Выберите, для каких соцсетей вы планируете создавать контент.</p>
                    <div style={styles.platformGrid}>
                        {platformOptions.map(platform => (
                            <div
                                key={platform.id}
                                style={localSettings.platforms.includes(platform.id) ? { ...styles.platformCard, ...styles.platformCardActive } : styles.platformCard}
                                onClick={() => handlePlatformToggle(platform.id)}
                            >
                                <span style={{fontSize: '1.5rem', marginRight: '12px'}}>{platform.icon}</span>
                                <span style={styles.platformName}>{platform.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Команда</h2>
                    <p style={styles.cardSubtitle}>Пригласите коллег для совместной работы.</p>
                     <div style={styles.teamInviteForm}>
                        <input 
                            type="email" 
                            placeholder="Email" 
                            style={{...styles.input, flex: 1}} 
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                        />
                        <select style={styles.input} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                            <option>SMM-менеджер</option>
                            <option>Гость</option>
                        </select>
                        <button style={styles.inviteButton} className="inviteButton" onClick={handleInvite}>Пригласить</button>
                    </div>
                    <table style={styles.teamTable}>
                        <thead>
                            <tr>
                                <th style={styles.teamTableTh}>Участник</th>
                                <th style={styles.teamTableTh}>Роль</th>
                                <th style={styles.teamTableTh}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {dataState.team.map(member => (
                                <tr key={member.id}>
                                    <td style={styles.teamTableTd}>{member.email}</td>
                                    <td style={styles.teamTableTd}>{member.role}</td>
                                    <td style={{...styles.teamTableTd, textAlign: 'right'}}>
                                        {member.role !== 'Владелец' && (
                                            <button style={styles.teamRemoveButton} className="teamRemoveButton" onClick={() => handleRemoveMember(member.id)}>Удалить</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                 <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                     <button
                        style={isDirty ? styles.button : styles.buttonDisabled}
                        onClick={handleSave}
                        disabled={!isDirty || isSaving}
                    >
                         {isSaving ? <div style={styles.miniLoader}></div> : 'Сохранить изменения'}
                    </button>
                 </div>
            </div>
        </div>
    );
};