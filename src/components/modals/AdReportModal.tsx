import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { fetchWithAuth, API_BASE_URL } from '../../api';
import { styles } from '../../styles';

export const AdReportModal = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { state: dataState } = useDataContext();
    const { adAccounts, adCampaigns, selectedAdAccountId } = dataState;
    
    const [reportContent, setReportContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const selectedAccount = useMemo(() => 
        adAccounts.find(acc => acc.id === selectedAdAccountId)
    , [adAccounts, selectedAdAccountId]);

    useEffect(() => {
        if (!selectedAccount) {
            setError('Не выбран рекламный аккаунт для анализа.');
            setIsLoading(false);
            return;
        }

        const generateReport = async () => {
            setIsLoading(true);
            setError('');
            try {
                const result = await fetchWithAuth(`${API_BASE_URL}/api/ads/recommendations`, {
                    method: 'POST',
                    body: JSON.stringify({ account: selectedAccount, campaigns: adCampaigns }),
                });
                setReportContent(result.report);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        generateReport();
    }, [selectedAccount, adCampaigns]);

    const handleClose = () => {
        appDispatch({ type: 'SET_AD_REPORT_MODAL_OPEN', payload: false });
    };

    const handleCopy = () => {
        if (!reportContent) return;
        navigator.clipboard.writeText(reportContent);
        appDispatch({ type: 'ADD_TOAST', payload: { message: 'Отчет скопирован!', type: 'success' } });
    };

    const renderBody = () => {
        if (isLoading) {
            return (
                <div style={styles.wizardLoadingContainer}>
                    <div style={styles.spinner}></div>
                    <p>AI анализирует ваши кампании...</p>
                </div>
            );
        }
        if (error) {
            return (
                <div style={{ color: 'red', textAlign: 'center' }}>
                    <p><strong>Ошибка генерации отчета:</strong></p>
                    <p>{error}</p>
                </div>
            );
        }
        return <pre style={styles.reportModalContent}>{reportContent}</pre>;
    };

    return (
        <div style={styles.modalOverlay} onClick={handleClose}>
            <div style={{ ...styles.modalContent, maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
                <header style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>AI-рекомендации по кампаниям</h3>
                    <button style={styles.modalCloseButton} onClick={handleClose}>&times;</button>
                </header>
                <div style={styles.modalBody}>
                    {renderBody()}
                </div>
                <footer style={styles.modalFooter}>
                    <button
                        style={{ ...styles.button, ...styles.buttonSecondary, marginRight: 'auto' }}
                        onClick={handleClose}
                    >
                        Закрыть
                    </button>
                    {!isLoading && !error && (
                        <button
                            style={{ ...styles.button, ...styles.buttonPrimary }}
                            onClick={handleCopy}
                        >
                            Копировать отчет
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
};