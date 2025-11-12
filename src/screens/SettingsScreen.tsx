import React, { useState } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { styles } from '../styles';

export const SettingsScreen = () => {
    const { state, dispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const { team } = state;

    const [inviteEmail, setInviteEmail] = useState('');

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        if (inviteEmail.trim() && /\S+@\S+\.\S+/.test(inviteEmail)) {
            // Mocking the addition of a new team member
            const newMember = {
                id: Date.now(), // Temporary unique ID
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
        <div style={styles.settingsLayout}>
            <div style={styles.settingsSectionCard}>
                <h3 style={styles.settingsSectionTitle}>Управление командой</h3>
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
             {/* Other settings sections can be added here later */}
        </div>
    );
};