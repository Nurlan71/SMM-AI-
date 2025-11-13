import React, { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../../api';
import { styles } from '../../styles';
import { Settings } from '../../types';

export const TelegramConnectModal = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { state: dataState, dispatch: dataDispatch } = useDataContext();

    const [token, setToken] = useState(dataState.settings.telegram?.token || '');
    const [chatId, setChatId] = useState(dataState.settings.telegram?.chatId || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleClose = () => {
        appDispatch({ type: 'SET_TELEGRAM_CONNECT_MODAL_OPEN', payload: false });
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const updatedSettings = await fetchWithAuth(`${API_BASE_URL}/api/settings/telegram`, {
                method: 'POST',
                body: JSON.stringify({ token, chatId }),
            });
            dataDispatch({ type: 'SET_SETTINGS', payload: updatedSettings as Settings });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Настройки Telegram сохранены!', type: 'success' } });
            handleClose();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Не удалось сохранить настройки.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsLoading(false);
        }
    };
    
    const isFormValid = token.trim() !== '' && chatId.trim() !== '';

    return (
        <div style={styles.modalOverlay} onClick={handleClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <header style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>Подключение Telegram</h3>
                    <button style={styles.modalCloseButton} onClick={handleClose}>&times;</button>
                </header>
                <div style={styles.modalBody}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label htmlFor="token" style={styles.generatorLabel}>Токен бота (Bot Token)</label>
                            <input
                                id="token"
                                type="text"
                                style={styles.authInput}
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                            />
                        </div>
                        <div>
                            <label htmlFor="chatId" style={styles.generatorLabel}>ID чата или канала (Chat ID)</label>
                            <input
                                id="chatId"
                                type="text"
                                style={styles.authInput}
                                value={chatId}
                                onChange={(e) => setChatId(e.target.value)}
                                placeholder="@yourchannel или -100123456789"
                            />
                        </div>
                        <div style={{ fontSize: '14px', color: '#6c757d', backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '8px' }}>
                            <strong>Как получить данные:</strong>
                            <ol style={{ paddingLeft: '20px', marginTop: '8px' }}>
                                <li>Найдите в Telegram <strong>@BotFather</strong> и создайте нового бота командой <code>/newbot</code>.</li>
                                <li>Скопируйте полученный токен.</li>
                                <li>Добавьте вашего бота в администраторы канала.</li>
                                <li>Напишите в канале любое сообщение.</li>
                                <li>Перешлите это сообщение боту <strong>@myidbot</strong>, чтобы узнать ID канала (он будет начинаться с -100...).</li>
                            </ol>
                        </div>
                    </div>
                </div>
                <footer style={styles.modalFooter}>
                    <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={handleClose}>
                        Отмена
                    </button>
                    <button
                        style={{ ...styles.button, ...(isFormValid ? styles.buttonPrimary : styles.buttonDisabled) }}
                        onClick={handleSave}
                        disabled={!isFormValid || isLoading}
                    >
                        {isLoading ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </footer>
            </div>
        </div>
    );
};