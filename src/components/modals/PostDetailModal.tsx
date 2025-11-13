import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../../api';
import { styles } from '../../styles';
import type { Post, Platform, PostStatus, AppFile } from '../../types';
import { MediaLibraryPickerModal } from './MediaLibraryPickerModal';

const PLATFORMS: Platform[] = ['instagram', 'telegram', 'vk', 'facebook', 'youtube', 'tiktok', 'twitter', 'linkedin', 'dzen'];
const STATUSES: PostStatus[] = ['idea', 'draft', 'scheduled', 'published', 'error'];

export const PostDetailModal = () => {
    const { state: appState, dispatch: appDispatch } = useAppContext();
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    
    const [editedPost, setEditedPost] = useState<Post | null>(null);
    const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const originalPost = useMemo(() => 
        dataState.posts.find(p => p.id === appState.activePostId)
    , [appState.activePostId, dataState.posts]);
    
    useEffect(() => {
        if (originalPost) {
            setEditedPost(JSON.parse(JSON.stringify(originalPost)));
        } else {
            setEditedPost(null);
        }
    }, [originalPost]);

    const handleClose = () => {
        appDispatch({ type: 'CLOSE_POST_DETAIL_MODAL' });
    };

    const handleSave = async () => {
        if (editedPost) {
             try {
                const updatedPostFromServer = await fetchWithAuth(`${API_BASE_URL}/api/posts/${editedPost.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(editedPost),
                });
                dataDispatch({ type: 'UPDATE_POST', payload: updatedPostFromServer });
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пост успешно сохранен!', type: 'success' } });
                handleClose();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Не удалось сохранить пост.";
                appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
            }
        }
    };
    
    const handleDelete = async () => {
        if (editedPost && window.confirm('Вы уверены, что хотите удалить этот пост? Это действие необратимо.')) {
            try {
                await fetchWithAuth(`${API_BASE_URL}/api/posts/${editedPost.id}`, {
                    method: 'DELETE',
                });
                dataDispatch({ type: 'DELETE_POST', payload: editedPost.id });
                appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пост удален.', type: 'success' } });
                handleClose();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Не удалось удалить пост.";
                appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
            }
        }
    };

    const handlePublish = async () => {
        if (!editedPost) return;
        setIsPublishing(true);
        try {
            const updatedPost = await fetchWithAuth(`${API_BASE_URL}/api/posts/${editedPost.id}/publish`, {
                method: 'POST',
            });
            dataDispatch({ type: 'UPDATE_POST', payload: updatedPost });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пост успешно опубликован в Telegram!', type: 'success' } });
            handleClose();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Не удалось опубликовать пост.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsPublishing(false);
        }
    };
    
    const handleInputChange = <K extends keyof Post>(key: K, value: Post[K]) => {
        if (editedPost) {
            const newPost = { ...editedPost, [key]: value };

            if (key === 'status' && value === 'scheduled' && !newPost.publishDate) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(10, 0, 0, 0);
                newPost.publishDate = tomorrow.toISOString();
            }
            
            if (key === 'status' && value !== 'scheduled') {
                newPost.publishDate = undefined;
            }

            setEditedPost(newPost);
        }
    };

    const handleImageSelect = (selectedFiles: AppFile[]) => {
        if (editedPost) {
            const newMediaUrls = selectedFiles.map(file => file.url);
            const updatedMedia = [...new Set([...editedPost.media, ...newMediaUrls])];
            handleInputChange('media', updatedMedia);
        }
        setIsMediaPickerOpen(false);
    };

    const handleRemoveImage = (urlToRemove: string) => {
        if (editedPost) {
            const updatedMedia = editedPost.media.filter(url => url !== urlToRemove);
            handleInputChange('media', updatedMedia);
        }
    };

    if (!editedPost) {
        return null;
    }
    
    const isChanged = JSON.stringify(originalPost) !== JSON.stringify(editedPost);
    const canPublishNow = editedPost.platform === 'telegram' && (editedPost.status === 'scheduled' || editedPost.status === 'draft');

    return (
        <>
            <div style={styles.modalOverlay} onClick={handleClose}>
                <div style={{...styles.modalContent, maxWidth: '800px'}} onClick={e => e.stopPropagation()}>
                    <header style={styles.modalHeader}>
                        <h3 style={styles.modalTitle}>Редактирование поста</h3>
                        <button style={styles.modalCloseButton} onClick={handleClose}>&times;</button>
                    </header>
                    <div style={styles.modalBody}>
                        <div style={styles.postDetailModalBody}>
                            <div style={styles.postDetailContent}>
                                <div>
                                    <h4 style={styles.postDetailLabel}>Текст поста</h4>
                                    <textarea
                                        style={styles.postDetailTextarea}
                                        value={editedPost.content}
                                        onChange={(e) => handleInputChange('content', e.target.value)}
                                    />
                                </div>
                                <div style={styles.postDetailMediaSection}>
                                    <h4 style={styles.postDetailLabel}>Медиафайлы</h4>
                                    <div style={styles.postDetailMediaGrid}>
                                        {editedPost.media.map(url => (
                                            <div key={url} style={styles.postDetailMediaThumbnailContainer}>
                                                <img src={`${API_BASE_URL}${url}`} alt="thumbnail" style={styles.postDetailMediaThumbnail}/>
                                                <button style={styles.postDetailMediaRemoveBtn} onClick={() => handleRemoveImage(url)}>&times;</button>
                                            </div>
                                        ))}
                                        <button style={styles.postDetailAddMediaBtn} onClick={() => setIsMediaPickerOpen(true)}>
                                            <span style={{fontSize: '24px'}}>+</span>
                                            <span>Добавить</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <aside style={styles.postDetailSidebar}>
                                <div>
                                    <h4 style={styles.postDetailLabel}>Платформа</h4>
                                    <select
                                        style={styles.postDetailSelect}
                                        value={editedPost.platform}
                                        onChange={(e) => handleInputChange('platform', e.target.value as Platform)}
                                    >
                                        {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <h4 style={styles.postDetailLabel}>Статус</h4>
                                     <select
                                        style={styles.postDetailSelect}
                                        value={editedPost.status}
                                        onChange={(e) => handleInputChange('status', e.target.value as PostStatus)}
                                    >
                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                 <div>
                                    <h4 style={styles.postDetailLabel}>Дата публикации</h4>
                                    <input
                                        type="datetime-local"
                                        style={styles.postDetailSelect}
                                        value={editedPost.publishDate ? editedPost.publishDate.substring(0, 16) : ''}
                                        onChange={(e) => handleInputChange('publishDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                                        disabled={editedPost.status !== 'scheduled'}
                                    />
                                </div>
                                 {canPublishNow && (
                                    <button
                                        style={isPublishing ? styles.buttonDisabled : styles.postDetailPublishButton}
                                        onClick={handlePublish}
                                        disabled={isPublishing}
                                    >
                                        {isPublishing ? 'Публикация...' : '🚀 Опубликовать сейчас'}
                                    </button>
                                )}
                            </aside>
                        </div>
                    </div>
                    <footer style={styles.modalFooter}>
                        <button
                            style={{...styles.button, ...styles.buttonDanger, ...styles.postDetailDeleteButton}}
                            onClick={handleDelete}
                        >
                            Удалить
                        </button>
                        <button
                            style={{...styles.button, ...styles.buttonSecondary}}
                            onClick={handleClose}
                        >
                            Отмена
                        </button>
                         <button
                            style={{...styles.button, ...(isChanged ? styles.buttonPrimary : styles.buttonDisabled)}}
                            onClick={handleSave}
                            disabled={!isChanged}
                        >
                            Сохранить
                        </button>
                    </footer>
                </div>
            </div>
             {isMediaPickerOpen && (
                <MediaLibraryPickerModal
                    onClose={() => setIsMediaPickerOpen(false)}
                    onAttach={handleImageSelect}
                    initiallySelectedUrls={editedPost.media || []}
                />
            )}
        </>
    );
};