import React, { useState, useRef, DragEvent, useMemo } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import type { AppFile, Settings, KnowledgeItem } from '../types';

const FileCard = ({ file, onDelete }: { file: AppFile; onDelete: (id: number) => void }) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <div 
            style={styles.fileCard} 
            className="fileCard"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {file.isAnalyzing && (
                <div style={styles.analyzingOverlay}>
                    <div style={{...styles.spinner, width: '24px', height: '24px', borderTop: '3px solid #007bff', borderRight: '3px solid #f3f3f3', borderBottom: '3px solid #f3f3f3', borderLeft: '3px solid #f3f3f3'}}></div>
                    <span style={{fontSize: '12px'}}>Анализ AI...</span>
                </div>
            )}
            <img src={`${API_BASE_URL}${file.url}`} alt={file.name} style={styles.fileCardImage} />
            <div style={{ ...styles.fileCardOverlay, ...(isHovered && styles.fileCardHover) }}>
                <div>
                     <button 
                        style={styles.fileCardDeleteButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(file.id);
                        }}
                    >&times;</button>
                    <p style={styles.fileCardName}>{file.name}</p>
                </div>
                {file.tags && file.tags.length > 0 && (
                    <div style={styles.fileCardTagsContainer}>
                        {file.tags.slice(0, 3).map(tag => <span key={tag} style={styles.fileCardTag}>{tag}</span>)}
                    </div>
                )}
            </div>
        </div>
    );
};

const UploadingCard = () => (
    <div style={{...styles.fileCard, ...styles.fileCardUploading}}>
        <div style={styles.spinner}></div>
        <p style={{fontSize: '14px', color: '#6c757d'}}>Загрузка...</p>
    </div>
);

const MediaLibrarySection = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const { files, dataLoading } = dataState;

    const [isUploading, setIsUploading] = useState(0);
    const [isDragOver, setIsDragOver] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const analyzeFile = (file: AppFile) => {
        dataDispatch({ type: 'UPDATE_FILE', payload: { ...file, isAnalyzing: true } });
        fetchWithAuth(`${API_BASE_URL}/api/files/analyze/${file.id}`, { method: 'POST' })
            .then((updatedFile: AppFile) => {
                dataDispatch({ type: 'UPDATE_FILE', payload: updatedFile });
            })
            .catch(err => {
                console.error(`Failed to analyze file ${file.id}:`, err);
                dataDispatch({ type: 'UPDATE_FILE', payload: { ...file, isAnalyzing: false } });
            });
    };

    const handleFileSelect = (fileList: FileList | null) => {
        if (!fileList) return;
        
        const filesToUpload = Array.from(fileList).filter(file => file.type.startsWith('image/'));
        if(filesToUpload.length === 0) return;

        const formData = new FormData();
        filesToUpload.forEach(file => formData.append('files', file));
        
        setIsUploading(prev => prev + filesToUpload.length);

        fetchWithAuth(`${API_BASE_URL}/api/files/upload`, {
            method: 'POST',
            body: formData,
        }).then((newFiles: AppFile[]) => {
            dataDispatch({ type: 'ADD_FILES', payload: newFiles });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Файлы успешно загружены!', type: 'success' } });
            newFiles.forEach(analyzeFile); // Start analysis for each new file
        }).catch(err => {
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка загрузки: ${err.message}`, type: 'error' } });
        }).finally(() => {
             setIsUploading(prev => prev - filesToUpload.length);
        });
    };
    
    const handleDeleteFile = (fileId: number) => {
        if(window.confirm('Вы уверены, что хотите удалить этот файл?')) {
             fetchWithAuth(`${API_BASE_URL}/api/files/${fileId}`, {
                method: 'DELETE',
            }).then(() => {
                dataDispatch({ type: 'DELETE_FILE', payload: fileId });
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Файл удален.', type: 'success' } });
            }).catch(err => {
                appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка удаления: ${err.message}`, type: 'error' } });
            });
        }
    };
    
    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); };
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const triggerFileInput = () => fileInputRef.current?.click();

    const filteredFiles = useMemo(() => {
        if (!searchTerm) return files;
        const lowercasedTerm = searchTerm.toLowerCase();
        return files.filter(file => 
            file.name.toLowerCase().includes(lowercasedTerm) ||
            (file.tags && file.tags.some(tag => tag.toLowerCase().includes(lowercasedTerm)))
        );
    }, [files, searchTerm]);

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
            <input
                type="file"
                multiple
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelect(e.target.files)}
            />
            <div
                style={{ ...styles.mediaUploadZone, ...(isDragOver && styles.mediaUploadZoneActive) }}
                onClick={triggerFileInput}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <p style={{fontSize: '2rem'}}>📤</p>
                <h3 style={{fontWeight: 600, color: '#0056b3'}}>Перетащите файлы сюда</h3>
                <p style={{color: '#495057'}}>или нажмите, чтобы выбрать с компьютера</p>
            </div>
            
             <input
                type="text"
                style={styles.mediaSearchInput}
                placeholder="🔎 Поиск по названию или тегам..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />

            {dataLoading && <p>Загрузка медиатеки...</p>}

            {!dataLoading && files.length === 0 && isUploading === 0 && (
                <EmptyState
                    icon="📚"
                    title="Ваша медиатека пока пуста"
                    description="Загрузите изображения, которые вы будете использовать в своих постах. Это могут быть фотографии продуктов, логотипы или любые другие медиафайлы."
                />
            )}

            {(filteredFiles.length > 0 || isUploading > 0) && (
                 <div style={styles.mediaGrid}>
                    {Array.from({ length: isUploading }).map((_, index) => <UploadingCard key={`uploading-${index}`} />)}
                    {filteredFiles.map(file => (
                        <FileCard key={file.id} file={file} onDelete={handleDeleteFile} />
                    ))}
                </div>
            )}
        </div>
    );
}

const BrandKnowledgeSection = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const docInputRef = useRef<HTMLInputElement>(null);

    const handleUploadDoc = async (fileList: FileList | null) => {
        const file = fileList?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('document', file);

        try {
            const newItem = await fetchWithAuth(`${API_BASE_URL}/api/knowledge/upload-doc`, {
                method: 'POST',
                body: formData,
            });
            dataDispatch({ type: 'ADD_KNOWLEDGE_ITEM', payload: newItem });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Документ успешно загружен!', type: 'success' } });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Не удалось загрузить документ.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        }
    };

    const handleAddLink = async () => {
        const url = prompt("Введите ссылку на Google Doc или другой ресурс:");
        if (url && url.startsWith('http')) {
             try {
                const newItem = await fetchWithAuth(`${API_BASE_URL}/api/knowledge/add-link`, {
                    method: 'POST',
                    body: JSON.stringify({ url }),
                });
                dataDispatch({ type: 'ADD_KNOWLEDGE_ITEM', payload: newItem });
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Ссылка добавлена!', type: 'success' } });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Не удалось добавить ссылку.";
                appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
            }
        } else if (url) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пожалуйста, введите корректный URL.', type: 'error' } });
        }
    };

    const handleDeleteItem = async (itemId: number) => {
        if(window.confirm('Вы уверены, что хотите удалить этот элемент?')) {
            try {
                await fetchWithAuth(`${API_BASE_URL}/api/knowledge/${itemId}`, { method: 'DELETE' });
                dataDispatch({ type: 'DELETE_KNOWLEDGE_ITEM', payload: itemId });
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Элемент удален.', type: 'success' } });
            } catch (err) {
                 const errorMessage = err instanceof Error ? err.message : "Не удалось удалить элемент.";
                 appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
            }
        }
    };

    return (
        <div style={styles.knowledgeSection}>
             <h3 style={styles.settingsSectionTitle}>База знаний бренда</h3>
             <p style={{ color: '#6c757d', marginTop: '-16px', marginBottom: '24px' }}>
                Загрузите сюда ваши брендбуки, гайдлайны, примеры текстов или ссылки на них, чтобы AI лучше понимал контекст вашего бренда.
            </p>
             <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                ref={docInputRef}
                style={{ display: 'none' }}
                onChange={(e) => handleUploadDoc(e.target.files)}
            />
            <div style={styles.knowledgeActions}>
                <button style={{...styles.button, ...styles.buttonPrimary}} onClick={() => docInputRef.current?.click()}>
                    📄 Загрузить документ
                </button>
                 <button style={{...styles.button, ...styles.buttonSecondary}} onClick={handleAddLink}>
                    🔗 Добавить ссылку
                </button>
            </div>

            <div style={styles.knowledgeList}>
                {dataState.knowledgeBaseItems.map(item => (
                    <div key={item.id} style={styles.knowledgeItem}>
                        <span style={styles.knowledgeItemIcon}>{item.type === 'document' ? '📄' : '🔗'}</span>
                        <a href={item.type === 'link' ? item.url : `${API_BASE_URL}${item.url}`} target="_blank" rel="noopener noreferrer" style={styles.knowledgeItemName}>
                            {item.name}
                        </a>
                        <button style={styles.teamRemoveButton} onClick={() => handleDeleteItem(item.id)}>Удалить</button>
                    </div>
                ))}
                 {dataState.knowledgeBaseItems.length === 0 && (
                    <p style={{textAlign: 'center', color: '#6c757d', padding: '20px 0'}}>База знаний пуста.</p>
                 )}
            </div>
        </div>
    );
};

const BrandAiSettingsSection = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const [formState, setFormState] = useState<Settings>(dataState.settings);

    const handleInputChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setFormState(prevState => ({ ...prevState, [key]: value }));
    };

    const handleSave = () => {
        dataDispatch({ type: 'SET_SETTINGS', payload: formState });
        appDispatch({ type: 'ADD_TOAST', payload: { message: 'Настройки AI успешно сохранены!', type: 'success' } });
    };

    const isChanged = JSON.stringify(dataState.settings) !== JSON.stringify(formState);

    return (
        <div style={{ ...styles.card, maxWidth: '800px', margin: '0 auto' }}>
            <div style={styles.settingsForm}>
                 <h3 style={styles.settingsSectionTitle}>Настройки "Голоса бренда"</h3>
                <div style={styles.settingsFormGroup}>
                    <label style={styles.settingsLabel} htmlFor="toneOfVoice">Стиль общения (Tone of Voice)</label>
                    <textarea
                        id="toneOfVoice"
                        style={styles.settingsTextarea}
                        rows={4}
                        value={formState.toneOfVoice}
                        onChange={(e) => handleInputChange('toneOfVoice', e.target.value)}
                        placeholder="Например: Дружелюбный и экспертный. Обращаемся на 'вы'..."
                    />
                </div>
                <div style={styles.settingsFormGroup}>
                    <label style={styles.settingsLabel} htmlFor="keywords">Ключевые слова и стоп-слова</label>
                    <textarea
                        id="keywords"
                        style={styles.settingsTextarea}
                        rows={3}
                        value={formState.keywords}
                        onChange={(e) => handleInputChange('keywords', e.target.value)}
                        placeholder="Например: ключевые: #одежда, #стиль; стоп-слова: дешевый, скидка"
                    />
                </div>
                <div style={styles.settingsFormGroup}>
                    <label style={styles.settingsLabel} htmlFor="targetAudience">Целевая аудитория</label>
                    <textarea
                        id="targetAudience"
                        style={styles.settingsTextarea}
                        rows={4}
                        value={formState.targetAudience}
                        onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                        placeholder="Например: Женщины 25-45 лет, ценящие качество и ручную работу..."
                    />
                </div>
                <div style={styles.settingsSaveButtonContainer}>
                    <button
                        style={{...styles.button, ...(isChanged ? styles.buttonPrimary : styles.buttonDisabled)}}
                        onClick={handleSave}
                        disabled={!isChanged}
                    >
                        Сохранить изменения
                    </button>
                </div>
            </div>
            <BrandKnowledgeSection />
        </div>
    );
};


export const KnowledgeBaseScreen = () => {
    const [activeTab, setActiveTab] = useState<'media' | 'brand'>('media');

    return (
        <div style={{padding: '24px'}}>
             <div style={{...styles.settingsSectionCard, padding: '0', marginBottom: '24px', maxWidth: 'none'}}>
                <div style={styles.settingsTabsContainer}>
                    <button
                        style={activeTab === 'media' ? styles.settingsTabButtonActive : styles.settingsTabButton}
                        onClick={() => setActiveTab('media')}
                    >
                        Медиатека
                    </button>
                    <button
                        style={activeTab === 'brand' ? styles.settingsTabButtonActive : styles.settingsTabButton}
                        onClick={() => setActiveTab('brand')}
                    >
                        Голос Бренда (AI)
                    </button>
                </div>
            </div>
            
            {activeTab === 'media' && <MediaLibrarySection />}
            {activeTab === 'brand' && <BrandAiSettingsSection />}
        </div>
    );
};