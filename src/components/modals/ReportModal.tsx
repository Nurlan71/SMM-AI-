import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { fetchWithAuth, API_BASE_URL } from '../../api';
import { styles } from '../../styles';

export const ReportModal = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { state: dataState } = useDataContext();
    
    const [reportContent, setReportContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const generateReport = async () => {
            setIsLoading(true);
            setError('');
            try {
                // Fetch fresh analytics data to ensure report is up-to-date
                const analyticsData = await fetchWithAuth(`${API_BASE_URL}/api/analytics`);
                const result = await fetchWithAuth(`${API_BASE_URL}/api/generate-report`, {
                    method: 'POST',
                    body: JSON.stringify({ analyticsData }),
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
    }, []);

    const handleClose = () => {
        appDispatch({ type: 'SET_REPORT_MODAL_OPEN', payload: false });
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
                    <p>Анализируем данные и готовим отчет...</p>
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
                    <h3 style={styles.modalTitle}>Аналитический отчет от AI</h3>
                    <button style={styles.modalCloseButton} onClick={handleClose}>&times;</button>
                </header>
                <div style={styles.modalBody}>
                    {renderBody()}
                </div>
                <footer style={styles.modalFooter}>
                    <button
                        style={{ ...styles.button, ...styles.buttonSecondary }}
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