import React, { useState, useCallback, useRef } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { styles } from '../styles';
import { AppFile } from '../types';
import { EmptyState } from '../components/EmptyState';

const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.startsWith('video/')) return '🎞️';
    return '📁';
};

const FileCard = ({ file, onDelete }: { file: AppFile; onDelete: (id: number) => void }) => (
    <div 
        className="fileCard"
        style={{
            ...styles.fileCard,
            ...(file.mimeType.startsWith('image/') && { backgroundImage: `url(${file.url})` }),
        }}
    >
        {file.isAnalyzing && (
            <div style={styles.fileCardAnalyzingOverlay}>
                <div style={{textAlign: 'center', color: '#0056b3'}}>
                    <div style={{...styles.miniLoader, margin: '0 auto 10px'}}></div>
                    <p style={{fontWeight: 600}}>Анализ AI...</p>
                </div>
            </div>
        )}
        <button 
            className="deleteButton" 
            style={{...styles.deleteButton, opacity: file.isAnalyzing ? 0 : '' }} 
            onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
        >
            &times;
        </button>
        {!file.mimeType.startsWith('image/') && <div style={styles.fileCardIcon}>{getFileIcon(file.mimeType)}</div>}
        <div style={styles.fileCardOverlay}>
            <span style={styles.fileName}>{file.name}</span>
        </div>
    </div>
);

const FileCardSkeleton = () => (
    <div style={styles.fileCardSkeleton}>
        <div style={styles.shimmer}></div>
    </div>
);

export const KnowledgeBaseScreen = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const handleUpload = useCallback(async (files: FileList) => {
        if (files.length === 0) return;
        setIsUploading(true);

        const formData = new FormData();
        Array.from(files).forEach(file => formData.append('files', file));
        
        // Optimistic UI update: show skeletons
        const optimisticFiles: AppFile[] = Array.from(files).map((f, i) => ({
             id: Date.now() + i, name: f.name, mimeType: f.type, url: '', isAnalyzing: true 
        }));
        dataDispatch({ type: 'ADD_FILES', payload: optimisticFiles });


        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/files`, {
                method: 'POST',
                body: formData,
            });
            const uploadedFiles: AppFile[] = await response.json();
            
            // Replace optimistic files with real ones, but keep analyzing state for a bit for effect
            dataDispatch({ type: 'SET_FILES', payload: [...uploadedFiles.map(f => ({...f, isAnalyzing: true})), ...dataState.files.filter(f => !optimisticFiles.find(o => o.id === f.id))] });
            
            setTimeout(() => {
                 dataDispatch({ type: 'SET_FILES', payload: [...uploadedFiles, ...dataState.files.filter(f => !optimisticFiles.find(o => o.id === f.id))] });
            }, 1500); // Simulate analysis time

            addToast(`${uploadedFiles.length} файл(ов) успешно загружено!`, 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Не удалось загрузить файлы.', 'error');
            // Revert optimistic update on error
            dataDispatch({ type: 'SET_FILES', payload: dataState.files.filter(f => !optimisticFiles.find(o => o.id === f.id)) });
        } finally {
            setIsUploading(false);
        }
    }, [addToast, dataDispatch, dataState.files]);

    const handleDelete = useCallback(async (fileId: number) => {
        if (!window.confirm('Вы уверены, что хотите удалить этот файл?')) return;
        const originalFiles = [...dataState.files];
        dataDispatch({ type: 'DELETE_FILE', payload: fileId });

        try {
            await fetchWithAuth(`${API_BASE_URL}/api/files/${fileId}`, { method: 'DELETE' });
            addToast('Файл удален.', 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Не удалось удалить файл.', 'error');
            dataDispatch({ type: 'SET_FILES', payload: originalFiles }); // Revert on error
        }
    }, [addToast, dataDispatch, dataState.files]);

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUpload(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };
    
    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    return (
        <div style={styles.knowledgeBaseContent}>
            <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
            <div
                style={{ ...styles.dropzone, ...(isDragOver && styles.dropzoneActive) }}
                onClick={() => fileInputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
            >
                <span style={styles.uploadIcon}>📥</span>
                <p style={{fontWeight: 600, fontSize: '1.1rem'}}>Перетащите файлы сюда или нажмите, чтобы выбрать</p>
                <p style={{marginTop: '8px'}}>Загрузите изображения, PDF-документы или видео, чтобы обучить AI</p>
            </div>
            <div style={{...styles.card, flex: 1}}>
                 <h2 style={styles.cardTitle}>Загруженные файлы</h2>
                 {dataState.dataLoading ? (
                     <div style={styles.fileGrid}>
                         {Array.from({ length: 6 }).map((_, i) => <FileCardSkeleton key={i} />)}
                     </div>
                 ) : dataState.files.length === 0 ? (
                    <EmptyState 
                        icon="📚"
                        title="База знаний пуста"
                        description="Загрузите файлы вашего бренда, чтобы AI мог генерировать более точный и релевантный контент."
                    />
                 ) : (
                     <div style={styles.fileGrid}>
                         {dataState.files.map(file => (
                             <FileCard key={file.id} file={file} onDelete={handleDelete} />
                         ))}
                     </div>
                 )}
            </div>
        </div>
    );
};