import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { styles } from '../../styles';
import type { Post, Platform, PostStatus } from '../../types';

const PLATFORMS: Platform[] = ['instagram', 'telegram', 'vk', 'facebook', 'youtube', 'tiktok', 'twitter', 'linkedin', 'dzen'];
const STATUSES: PostStatus[] = ['idea', 'draft', 'scheduled', 'published', 'error'];

export const PostDetailModal = () => {
    const { state: appState, dispatch: appDispatch } = useAppContext();
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    
    const [editedPost, setEditedPost] = useState<Post | null>(null);

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

    const handleSave = () => {
        if (editedPost) {
            dataDispatch({ type: 'UPDATE_POST', payload: editedPost });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пост успешно сохранен!', type: 'success' } });
            handleClose();
        }
    };
    
    const handleDelete = () => {
        if (editedPost && window.confirm('Вы уверены, что хотите удалить этот пост? Это действие необратимо.')) {
            dataDispatch({ type: 'DELETE_POST', payload: editedPost.id });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пост удален.', type: 'success' } });
            handleClose();
        }
    };
    
    const handleInputChange = <K extends keyof Post>(key: K, value: Post[K]) => {
        if (editedPost) {
            setEditedPost({ ...editedPost, [key]: value });
        }
    };

    if (!editedPost) {
        return null;
    }
    
    const isChanged = JSON.stringify(originalPost) !== JSON.stringify(editedPost);

    return (
        <div style={styles.modalOverlay} onClick={handleClose}>
            <div style={{...styles.modalContent, maxWidth: '800px'}} onClick={e => e.stopPropagation()}>
                <header style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>Редактирование поста</h3>
                    <button style={styles.modalCloseButton} onClick={handleClose}>&times;</button>
                </header>
                <div style={styles.modalBody}>
                    <div style={styles.postDetailModalBody}>
                        <div style={styles.postDetailContent}>
                             <h4 style={styles.postDetailLabel}>Текст поста</h4>
                            <textarea
                                style={styles.postDetailTextarea}
                                value={editedPost.content}
                                onChange={(e) => handleInputChange('content', e.target.value)}
                            />
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
                                    onChange={(e) => handleInputChange('publishDate', new Date(e.target.value).toISOString())}
                                    disabled={editedPost.status !== 'scheduled'}
                                />
                            </div>
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
    );
};