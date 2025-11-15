import React, { useState } from 'react';
import { useDataContext } from '../../contexts/DataContext';
import { API_BASE_URL } from '../../api';
import { styles } from '../../styles';
import type { AppFile } from '../../types';

interface MediaLibraryPickerModalProps {
    onClose: () => void;
    onAttach: (files: AppFile[]) => void;
    initiallySelectedUrls: string[];
}

const PickerFileCard = ({ file, isSelected, onSelect }: { file: AppFile, isSelected: boolean, onSelect: (url: string) => void }) => {
    const cardStyle = {
        ...styles.fileCard,
        cursor: 'pointer',
        border: isSelected ? '3px solid #007bff' : '1px solid #e9ecef',
        position: 'relative' as const,
    };

    return (
        <div style={cardStyle} onClick={() => onSelect(file.url)}>
            <img src={`${API_BASE_URL}${file.url}`} alt={file.name} style={styles.fileCardImage} />
            {isSelected && (
                <div style={styles.pickerSelectedOverlay}>
                    <span style={styles.pickerSelectedCheckmark}>✔</span>
                </div>
            )}
        </div>
    );
};

export const MediaLibraryPickerModal = ({ onClose, onAttach, initiallySelectedUrls }: MediaLibraryPickerModalProps) => {
    const { state: dataState } = useDataContext();
    const [selectedUrls, setSelectedUrls] = useState<string[]>(initiallySelectedUrls);

    const handleToggleSelection = (url: string) => {
        setSelectedUrls(prev => 
            prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
        );
    };

    const handleAttach = () => {
        const selectedFiles = dataState.files.filter(file => selectedUrls.includes(file.url));
        onAttach(selectedFiles);
    };
    
    return (
        <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalContent, maxWidth: '900px', height: '80vh' }}>
                <header style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>Выбрать медиафайл из Базы знаний</h3>
                    <button style={styles.modalCloseButton} onClick={onClose}>&times;</button>
                </header>
                <div style={styles.modalBody}>
                    {dataState.files.length === 0 ? (
                         <p style={{textAlign: 'center', color: '#6c757d'}}>Ваша База знаний пуста. Сначала загрузите файлы.</p>
                    ) : (
                        <div style={styles.mediaGrid}>
                            {dataState.files.map(file => (
                                <PickerFileCard 
                                    key={file.id} 
                                    file={file} 
                                    isSelected={selectedUrls.includes(file.url)} 
                                    onSelect={handleToggleSelection} 
                                />
                            ))}
                        </div>
                    )}
                </div>
                <footer style={styles.modalFooter}>
                    <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={onClose}>
                        Отмена
                    </button>
                    <button 
                        style={{ ...styles.button, ...(selectedUrls.length > 0 ? styles.buttonPrimary : styles.buttonDisabled) }} 
                        onClick={handleAttach}
                        disabled={selectedUrls.length === 0}
                    >
                        Прикрепить {selectedUrls.length > 0 ? `(${selectedUrls.length})` : ''}
                    </button>
                </footer>
            </div>
        </div>
    );
};
