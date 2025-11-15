import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../../api';
import { styles } from '../../styles';
import type { Post, Platform, PostStatus, AppFile, PostVariant } from '../../types';
import { MediaLibraryPickerModal } from './MediaLibraryPickerModal';

const PLATFORMS: Platform[] = ['instagram', 'telegram', 'vk', 'facebook', 'youtube', 'tiktok', 'twitter', 'linkedin', 'dzen'];
const STATUSES: PostStatus[] = ['idea', 'draft', 'scheduled', 'published', 'error'];

const PostStats = ({ post }: { post: Post }) => (
    <div style={{...styles.platformCard, flexDirection: 'column', alignItems: 'flex-start', gap: '8px'}}>
        <h4 style={styles.postDetailLabel}>Статистика</h4>
         {/* Fix: Changed property access from snake_case to camelCase to match the 'Post' type. */}
         <div style={{fontSize: '14px'}}>❤️ Лайки: <strong>{post.likesCount}</strong></div>
         <div style={{fontSize: '14px'}}>💬 Комментарии: <strong>{post.commentsCount}</strong></div>
         <div style={{fontSize: '14px'}}>👁️ Просмотры: <strong>{post.viewsCount}</strong></div>
    </div>
);

const ABTestDisplay = ({ post, onTestEnd }: { post: Post, onTestEnd: (winnerVariantText: string) => void }) => {
    const [activeTab, setActiveTab] = useState(0);

    const winnerIndex = useMemo(() => {
        if (!post.variants || post.variants.length === 0) return -1;
        // Fix: Changed property access from snake_case to camelCase to match the 'PostVariant' type.
        return post.variants.reduce((bestIndex, variant, currentIndex, arr) => {
            const currentScore = variant.likesCount + variant.commentsCount;
            const bestScore = arr[bestIndex].likesCount + arr[bestIndex].commentsCount;
            return currentScore > bestScore ? currentIndex : bestIndex;
        }, 0);
    }, [post.variants]);

    if (!post.variants) return null;

    const activeVariant = post.variants[activeTab];

    return (
        <div style={styles.postDetailContent}>
            <div style={styles.postDetailABTestTabsContainer}>
                {post.variants.map((_, index) => (
                    <button
                        key={index}
                        style={activeTab === index ? styles.postDetailABTestTabActive : styles.postDetailABTestTab}
                        onClick={() => setActiveTab(index)}
                    >
                        Вариант {String.fromCharCode(65 + index)}
                        {index === winnerIndex && <span style={styles.postDetailABTestWinnerBadge}>🏆</span>}
                    </button>
                ))}
            </div>
            
            <textarea
                style={{...styles.postDetailTextarea, minHeight: '300px'}}
                value={activeVariant.text}
                readOnly
            />
            
            <div style={{...styles.analyticsGrid, gridTemplateColumns: '1fr 1fr'}}>
                <div style={styles.postDetailABTestStatsCard}>
                    <span>❤️ Лайки</span>
                    {/* Fix: Changed property access from snake_case to camelCase to match the 'PostVariant' type. */}
                    <strong>{activeVariant.likesCount}</strong>
                </div>
                <div style={styles.postDetailABTestStatsCard}>
                    <span>💬 Комментарии</span>
                    {/* Fix: Changed property access from snake_case to camelCase to match the 'PostVariant' type. */}
                    <strong>{activeVariant.commentsCount}</strong>
                </div>
            </div>
            
            <button
                style={{...styles.button, ...styles.buttonPrimary, backgroundColor: '#28a745', marginTop: '16px'}}
                onClick={() => onTestEnd(post.variants![winnerIndex].text)}
            >
                Завершить тест и использовать победителя (Вариант {String.fromCharCode(65 + winnerIndex)})
            </button>
        </div>
    );
};

export const PostDetailModal = () => {
    const { state: appState, dispatch: appDispatch } = useAppContext();
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    
    const [editedPost, setEditedPost] = useState<Post | null>(null);
    const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [suggestion, setSuggestion] = useState({ text: '', error: '', isLoading: false });

    const originalPost = useMemo(() => 
        dataState.posts.find(p => p.id === appState.activePostId)
    , [appState.activePostId, dataState.posts]);
    
    useEffect(() => {
        if (originalPost) {
            setEditedPost(JSON.parse(JSON.stringify(originalPost)));
        } else {
            setEditedPost(null);
        }
        setSuggestion({ text: '', error: '', isLoading: false });
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

     const handleEndABTest = async (winnerVariantText: string) => {
        if (!editedPost) return;
        setIsLoading(true);
        try {
            const updatedPost = await fetchWithAuth(`${API_BASE_URL}/api/posts/${editedPost.id}/end-ab-test`, {
                method: 'PUT',
                body: JSON.stringify({ winnerVariantText }),
            });
            dataDispatch({ type: 'UPDATE_POST', payload: updatedPost });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'A/B тест завершен!', type: 'success' } });
            // The modal will re-render with the standard editor view
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Не удалось завершить тест.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsLoading(false);
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
            
            if (key === 'status' && (value === 'idea' || value === 'draft')) {
                 newPost.publishDate = undefined;
            }

            setEditedPost(newPost);
        }
    };

    const handleImageSelect = (selectedFiles: AppFile[]) => {
        if (editedPost) {
            const newMediaUrls = selectedFiles.map(file => file.url);
            handleInputChange('media', newMediaUrls);
        }
        setIsMediaPickerOpen(false);
    };

    const handleRemoveImage = (urlToRemove: string) => {
        if (editedPost) {
            const updatedMedia = editedPost.media.filter(url => url !== urlToRemove);
            handleInputChange('media', updatedMedia);
        }
    };
    
    const handleFindBestTime = async () => {
        setSuggestion({ text: '', error: '', isLoading: true });
        const publishedPosts = dataState.posts.filter(p => p.status === 'published');

        if (publishedPosts.length < 3) {
            setSuggestion({ text: '', error: 'Нужно хотя бы 3 опубликованных поста для анализа.', isLoading: false });
            return;
        }

        try {
            const result = await fetchWithAuth(`${API_BASE_URL}/api/analytics/suggestion`, {
                method: 'POST',
                body: JSON.stringify({ posts: publishedPosts }),
            });
            
            if (editedPost) {
                setEditedPost({
                    ...editedPost,
                    publishDate: result.suggestedDateISO,
                    status: 'scheduled',
                });
            }
            setSuggestion({ text: result.suggestionText, error: '', isLoading: false });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Не удалось получить совет от AI.";
            setSuggestion({ text: '', error: errorMessage, isLoading: false });
        }
    };

    if (!editedPost) {
        return null;
    }
    
    const isChanged = JSON.stringify(originalPost) !== JSON.stringify(editedPost);
    const canPublishNow = !editedPost.isABTest && editedPost.platform === 'telegram' && (editedPost.status === 'scheduled' || editedPost.status === 'draft' || editedPost.status === 'idea');

    return (
        <>
            <div style={styles.modalOverlay} onClick={handleClose}>
                <div style={{...styles.modalContent, maxWidth: '800px'}} onClick={e => e.stopPropagation()}>
                    <header style={styles.modalHeader}>
                        <h3 style={styles.modalTitle}>
                            {editedPost.isABTest ? '🧪 A/B Тестирование' : 'Редактирование поста'}
                        </h3>
                        <button style={styles.modalCloseButton} onClick={handleClose}>&times;</button>
                    </header>
                    <div style={{...styles.modalBody, ...styles.postDetailModalBody}}>
                        {isLoading && <div style={styles.analyzingOverlay}><div style={styles.spinner}></div></div>}
                        
                        {editedPost.isABTest ? (
                            <ABTestDisplay post={editedPost} onTestEnd={handleEndABTest} />
                        ) : (
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
                        )}
                        <aside style={styles.postDetailSidebar}>
                             {editedPost.status === 'published' && <PostStats post={editedPost} />}
                            <div>
                                <h4 style={styles.postDetailLabel}>Платформа</h4>
                                <select
                                    style={styles.postDetailSelect}
                                    value={editedPost.platform}
                                    onChange={(e) => handleInputChange('platform', e.target.value as Platform)}
                                    disabled={editedPost.isABTest}
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
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                    <h4 style={styles.postDetailLabel}>Дата публикации</h4>
                                    {(editedPost.status === 'idea' || editedPost.status === 'draft') && !editedPost.isABTest && (
                                        <button 
                                            onClick={handleFindBestTime} 
                                            style={{...styles.aiReplyButton, marginRight: 0, padding: '4px 8px', fontSize: '12px', border: 'none'}}
                                            disabled={suggestion.isLoading}
                                        >
                                            {suggestion.isLoading ? 'Анализ...' : '🤖 Найти лучшее время'}
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="datetime-local"
                                    style={styles.postDetailSelect}
                                    value={editedPost.publishDate ? editedPost.publishDate.substring(0, 16) : ''}
                                    onChange={(e) => handleInputChange('publishDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                                    disabled={editedPost.status !== 'scheduled' || editedPost.isABTest}
                                />
                                {suggestion.text && <p style={{fontSize: '12px', color: '#0056b3', marginTop: '6px'}}>💡 {suggestion.text}</p>}
                                {suggestion.error && <p style={{fontSize: '12px', color: '#dc3545', marginTop: '6px'}}>⚠️ {suggestion.error}</p>}
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
                    {!editedPost.isABTest && (
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
                                disabled={!isChanged || isPublishing}
                            >
                                Сохранить
                            </button>
                        </footer>
                    )}
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
