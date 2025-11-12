import React, { useState, useRef, DragEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import { AppFile } from '../types';


const FileCard = ({ file, onDelete }: { file: AppFile; onDelete: (id: number) => void }) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <div 
            style={styles.fileCard} 
            className="fileCard"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <img src={`${API_BASE_URL}${file.url}`} alt={file.name} style={styles.fileCardImage} />
            <div style={{ ...styles.fileCardOverlay, ...(isHovered && styles.fileCardHover) }}>
                <p style={styles.fileCardName}>{file.name}</p>
                <button 
                    style={styles.fileCardDeleteButton}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(file.id);
                    }}
                >&times;</button>
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


export const KnowledgeBaseScreen = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const { files, dataLoading } = dataState;

    const [isUploading, setIsUploading] = useState(0); // Count of files being uploaded
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    // Drag and Drop handlers
    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation(); // Necessary to allow drop
    };
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const droppedFiles = e.dataTransfer.files;
        handleFileSelect(droppedFiles);
    };

    const triggerFileInput = () => fileInputRef.current?.click();

    return (
        <div style={styles.mediaLibraryLayout}>
            <input
                type="file"
                multiple
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelect(e.target.files)}
            />
            <div
                style={{
                    ...styles.mediaUploadZone,
                    ...(isDragOver && styles.mediaUploadZoneActive)
                }}
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

            {dataLoading && <p>Загрузка медиатеки...</p>}

            {!dataLoading && files.length === 0 && isUploading === 0 && (
                <EmptyState
                    icon="📚"
                    title="Ваша база знаний пока пуста"
                    description="Загрузите изображения, которые вы будете использовать в своих постах. Это могут быть фотографии продуктов, логотипы или любые другие медиафайлы."
                />
            )}

            {(files.length > 0 || isUploading > 0) && (
                 <div style={styles.mediaGrid}>
                    {Array.from({ length: isUploading }).map((_, index) => <UploadingCard key={`uploading-${index}`} />)}
                    {files.map(file => (
                        <FileCard key={file.id} file={file} onDelete={handleDeleteFile} />
                    ))}
                </div>
            )}
        </div>
    );
};