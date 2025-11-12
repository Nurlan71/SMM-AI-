import React, { useState, useMemo, useEffect } from 'react';
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { styles } from '../styles';
import type { Post, Comment } from '../types';
import { EmptyState } from '../components/EmptyState';

const getStatusInfo = (status: Comment['status']) => {
    switch (status) {
        case 'unanswered': return { text: 'Требует ответа', color: '#dc3545' };
        case 'answered': return { text: 'Отвечено', color: '#007bff' };
        case 'archived': return { text: 'В архиве', color: '#6c757d' };
        default: return { text: 'Неизвестно', color: '#6c757d' };
    }
};

const CommentCard = ({ comment, onStatusChange }: { comment: Comment; onStatusChange: (id: number, status: Comment['status']) => void; }) => {
    const statusInfo = getStatusInfo(comment.status);
    const formattedDate = new Date(comment.timestamp).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    return (
        <div style={styles.commentCard}>
            <div style={styles.commentHeader}>
                <div>
                    <span style={styles.commentAuthor}>{comment.author}</span>
                    <p style={styles.commentTimestamp}>{formattedDate}</p>
                </div>
                <div style={{ ...styles.commentStatusIndicator, color: statusInfo.color }}>
                    <div style={{ ...styles.commentStatusDot, backgroundColor: statusInfo.color }}></div>
                    {statusInfo.text}
                </div>
            </div>
            <p style={styles.commentBody}>{comment.text}</p>
            <div style={styles.commentActions}>
                {comment.status !== 'answered' && (
                    <button style={styles.commentActionButton} onClick={() => onStatusChange(comment.id, 'answered')}>
                        ✅ Отметить как отвеченный
                    </button>
                )}
                {comment.status !== 'archived' && (
                     <button style={styles.commentActionButton} onClick={() => onStatusChange(comment.id, 'archived')}>
                        📦 Архивировать
                    </button>
                )}
            </div>
        </div>
    );
};

export const CommunityScreen = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const { posts, comments, dataLoading } = dataState;

    const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

    const postsWithComments = useMemo(() => {
        const safeComments = Array.isArray(comments) ? comments : [];
        const safePosts = Array.isArray(posts) ? posts : [];

        const postsMap = new Map<number, { post: Post; unansweredCount: number }>();
        
        safeComments.forEach(comment => {
            if (!postsMap.has(comment.postId)) {
                const post = safePosts.find(p => p.id === comment.postId);
                if (post) {
                    postsMap.set(comment.postId, { post, unansweredCount: 0 });
                }
            }
            if (comment.status === 'unanswered') {
                const entry = postsMap.get(comment.postId);
                if (entry) {
                    entry.unansweredCount += 1;
                }
            }
        });
        
        return Array.from(postsMap.values())
            .sort((a, b) => b.unansweredCount - a.unansweredCount);
    }, [posts, comments]);

    useEffect(() => {
        if (!selectedPostId && postsWithComments.length > 0) {
            setSelectedPostId(postsWithComments[0].post.id);
        }
    }, [postsWithComments, selectedPostId]);

    const handleStatusChange = async (commentId: number, status: Comment['status']) => {
        try {
            const updatedComment = await fetchWithAuth(`${API_BASE_URL}/api/comments/${commentId}`, {
                method: 'PUT',
                body: JSON.stringify({ status }),
            });
            dataDispatch({ type: 'UPDATE_COMMENT', payload: updatedComment });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Статус комментария обновлен!', type: 'success' } });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Не удалось обновить статус.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        }
    };

    const selectedPostComments = useMemo(() => {
        if (!selectedPostId) return [];
        return (Array.isArray(comments) ? comments : [])
            .filter(c => c.postId === selectedPostId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [selectedPostId, comments]);

    if (dataLoading) {
        return <div style={{ padding: '24px' }}> <div style={styles.spinner}></div> Загрузка комментариев...</div>;
    }

    if (postsWithComments.length === 0) {
        return (
            <div style={{ padding: '24px', height: '100%' }}>
                <EmptyState
                    icon="💬"
                    title="Комментариев пока нет"
                    description="Здесь будут отображаться комментарии к вашим постам, чтобы вы могли легко на них отвечать."
                />
            </div>
        );
    }
    
    return (
        <div style={styles.communityLayout}>
            <div style={styles.postListColumn}>
                <div style={styles.postListHeader}>Посты с комментариями</div>
                <div style={styles.postList}>
                    {postsWithComments.map(({ post, unansweredCount }) => (
                        <div
                            key={post.id}
                            style={selectedPostId === post.id ? {...styles.postListItem, ...styles.postListItemActive} : styles.postListItem}
                            onClick={() => setSelectedPostId(post.id)}
                        >
                            <p style={styles.postListItemContent}>{post.content}</p>
                            <div style={styles.postListItemMeta}>
                                <span>{post.platform}</span>
                                {unansweredCount > 0 && <div style={styles.unansweredBadge}>{unansweredCount}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={styles.commentFeedColumn}>
                {selectedPostComments.length > 0 ? (
                    selectedPostComments.map(comment => (
                        <CommentCard key={comment.id} comment={comment} onStatusChange={handleStatusChange} />
                    ))
                ) : (
                    <p>Выберите пост слева, чтобы увидеть комментарии.</p>
                )}
            </div>
        </div>
    );
};