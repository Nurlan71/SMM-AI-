import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { fetchWithAuth, API_BASE_URL } from '../../api';
import { styles } from '../../styles';

declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

export const ReportModal = () => {
    const { dispatch: appDispatch } = useAppContext();
    
    const [reportContent, setReportContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const reportContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const generateReport = async () => {
            setIsLoading(true);
            setError('');
            try {
                // Fetch fresh analytics data to ensure report is up-to-date
                const analyticsData = await fetchWithAuth(`${API_BASE_URL}/api/analytics`);
                const result = await fetchWithAuth(`${API_BASE_URL}/api/generate-report`, {
                    method: 'POST',
                    body: JSON.stringify({ analyticsData: analyticsData.current }),
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
    
    const handleExportPdf = async () => {
        if (!reportContentRef.current || !window.html2canvas || !window.jspdf) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Ошибка экспорта: библиотеки не загружены.', type: 'error' } });
            return;
        }

        try {
            const canvas = await window.html2canvas(reportContentRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
            });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`smm-ai-report-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("PDF Export Error:", error);
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Не удалось создать PDF.', type: 'error' } });
        }
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
                <div style={styles.modalBody} ref={reportContentRef}>
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
                        <>
                            <button
                                style={{ ...styles.button, ...styles.buttonSecondary }}
                                onClick={handleExportPdf}
                            >
                                Экспортировать в PDF
                            </button>
                            <button
                                style={{ ...styles.button, ...styles.buttonPrimary }}
                                onClick={handleCopy}
                            >
                                Копировать отчет
                            </button>
                        </>
                    )}
                </footer>
            </div>
        </div>
    );
};