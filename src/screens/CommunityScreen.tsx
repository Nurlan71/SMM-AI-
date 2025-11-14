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
        case 'spam': return { text: 'Спам', color: '#ffc107' };
        default: return { text: 'Неизвестно', color: '#6c757d' };
    }
};

const SpamCommentCard = ({ comment, onStatusChange }: { comment: Comment; onStatusChange: (id: number, status: Comment['status']) => void; }) => {
    const formattedDate = new Date(comment.timestamp).toLocaleString('ru-RU', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div style={{...styles.commentCard, ...styles.spamCommentCard}}>
             <div style={styles.commentHeader}>
                <div>
                    <span style={styles.commentAuthor}>⚠️ {comment.author}</span>
                    <p style={styles.commentTimestamp}>{formattedDate}</p>
                </div>
            </div>
            <p style={{...styles.commentBody, ...styles.spamCommentText}}>{comment.text}</p>
            <div style={{...styles.commentActions, ...styles.spamCommentActions}}>
                 <button style={{...styles.commentActionButton, color: '#28a745', borderColor: '#28a745'}} onClick={() => onStatusChange(comment.id, 'unanswered')}>
                    ✅ Это не спам
                </button>
                 <button style={styles.commentActionButton} onClick={() => onStatusChange(comment.id, 'hidden')}>
                    🗑️ Скрыть
                </button>
            </div>
        </div>
    );
};

const CommentCard = ({ comment, post, onStatusChange }: { comment: Comment; post: Post | undefined; onStatusChange: (id: number, status: Comment['status']) => void; }) => {
    const { state: dataState } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const [aiReply, setAiReply] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const statusInfo = getStatusInfo(comment.status);
    const formattedDate = new Date(comment.timestamp).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    useEffect(() => {
        // Automatically populate the reply textarea if AI has a suggestion.
        if (comment.suggestedReply && !aiReply) {
            setAiReply(comment.suggestedReply);
        }
    }, [comment.suggestedReply]);


    const handleGenerateReply = async () => {
        if (!post) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Не найден исходный пост', type: 'error' } });
            return;
        }
        setIsGenerating(true);
        setAiReply('');
        try {
            const result = await fetchWithAuth(`${API_BASE_URL}/api/generate-comment-reply`, {
                method: 'POST',
                body: JSON.stringify({
                    postContent: post.content,
                    commentText: comment.text,
                    brandSettings: dataState.settings
                }),
            });
            setAiReply(result.reply);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Не удалось сгенерировать ответ.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка AI: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUseReply = () => {
        navigator.clipboard.writeText(aiReply);
        onStatusChange(comment.id, 'answered');
        appDispatch({ type: 'ADD_TOAST', payload: { message: 'Ответ скопирован и комментарий отмечен как отвеченный!', type: 'success' } });
        setAiReply('');
    };
    
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
             {isGenerating && (
                <div style={{...styles.wizardLoadingContainer, minHeight: '50px', padding: '10px 0'}}>
                    <div style={{...styles.spinner, width: '24px', height: '24px'}}></div>
                    <p style={{fontSize: '14px'}}>AI подбирает слова...</p>
                </div>
            )}
            {aiReply && !isGenerating && (
                <div style={styles.aiReplyContainer}>
                    <textarea 
                        style={styles.aiReplyTextarea}
                        value={aiReply}
                        onChange={(e) => setAiReply(e.target.value)}
                        rows={4}
                    />
                    <div style={styles.aiReplyActions}>
                        <button style={styles.commentActionButton} onClick={() => setAiReply('')}>
                            Отмена
                        </button>
                        <button style={{...styles.commentActionButton, color: '#28a745', borderColor: '#28a745'}} onClick={handleUseReply}>
                            Использовать ответ
                        </button>
                    </div>
                </div>
            )}

            <div style={styles.commentActions}>
                 <button style={styles.aiReplyButton} onClick={handleGenerateReply} disabled={isGenerating}>
                    {isGenerating ? 'Думаем...' : '🤖 Ответить с AI'}
                </button>
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
    const [activeTab, setActiveTab] = useState<'unanswered' | 'spam'>('unanswered');
    const [isSimulating, setIsSimulating] = useState(false);

    const { postsWithComments, spamCount } = useMemo(() => {
        const safeComments = Array.isArray(comments) ? comments : [];
        const safePosts = Array.isArray(posts) ? posts : [];
        
        let spamCount = 0;
        const postsMap = new Map<number, { post: Post; unansweredCount: number }>();
        
        safeComments.forEach(comment => {
            if (comment.status === 'hidden') return;
            
            if (comment.status === 'spam') {
                spamCount++;
                return; // Don't show spam comments in the post list
            }
            
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
        
        const sortedPosts = Array.from(postsMap.values())
            .filter(item => item.unansweredCount > 0)
            .sort((a, b) => b.unansweredCount - a.unansweredCount);

        return { postsWithComments: sortedPosts, spamCount };
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
            if (status !== 'answered') {
                 appDispatch({ type: 'ADD_TOAST', payload: { message: 'Статус комментария обновлен!', type: 'success' } });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Не удалось обновить статус.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        }
    };
    
    const handleSimulateNewComments = async () => {
        setIsSimulating(true);
        try {
            const newComments = await fetchWithAuth(`${API_BASE_URL}/api/comments/simulate-new`, {
                method: 'POST'
            });
            dataDispatch({ type: 'ADD_COMMENTS', payload: newComments });
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Получено ${newComments.length} новых комментариев!`, type: 'success' } });
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : "Не удалось симулировать комментарии.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsSimulating(false);
        }
    }

    const selectedPostComments = useMemo(() => {
        if (!selectedPostId || activeTab !== 'unanswered') return [];
        return (Array.isArray(comments) ? comments : [])
            .filter(c => c.postId === selectedPostId && c.status === 'unanswered')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [selectedPostId, comments, activeTab]);
    
    const spamComments = useMemo(() => {
        return (Array.isArray(comments) ? comments : [])
            .filter(c => c.status === 'spam')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [comments]);


    if (dataLoading) {
        return <div style={{ padding: '24px' }}> <div style={styles.spinner}></div> Загрузка комментариев...</div>;
    }

    const renderMainContent = () => {
        if (activeTab === 'unanswered') {
            if (postsWithComments.length === 0) {
                return (
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                        <EmptyState icon="✅" title="Все комментарии обработаны!" description="Вы отлично поработали. Новые комментарии появятся здесь." />
                    </div>
                );
            }
            return (
                <>
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
                                <CommentCard 
                                    key={comment.id} 
                                    comment={comment}
                                    post={posts.find(p => p.id === comment.postId)}
                                    onStatusChange={handleStatusChange} 
                                />
                            ))
                        ) : (
                            <p>Выберите пост слева, чтобы увидеть комментарии.</p>
                        )}
                    </div>
                </>
            );
        }

        if (activeTab === 'spam') {
            if (spamComments.length === 0) {
                 return (
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                        <EmptyState icon="🛡️" title="Папка 'Спам' пуста" description="AI-модератор будет автоматически помещать сюда подозрительные комментарии." />
                    </div>
                );
            }
             return (
                <div style={{...styles.commentFeedColumn, gridColumn: '1 / -1'}}>
                    {spamComments.map(comment => (
                        <SpamCommentCard key={comment.id} comment={comment} onStatusChange={handleStatusChange} />
                    ))}
                </div>
             );
        }
        return null;
    }

    return (
        <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
            <div style={{...styles.analyticsHeader, padding: '12px 24px', borderBottom: '1px solid #e9ecef'}}>
                <div style={styles.settingsTabsContainer}>
                     <button
                        style={activeTab === 'unanswered' ? styles.settingsTabButtonActive : styles.settingsTabButton}
                        onClick={() => setActiveTab('unanswered')}
                    >
                       Требуют ответа
                    </button>
                    <button
                        style={activeTab === 'spam' ? styles.settingsTabButtonActive : styles.settingsTabButton}
                        onClick={() => setActiveTab('spam')}
                    >
                       Спам {spamCount > 0 && <span style={styles.notificationBadge}>{spamCount}</span>}
                    </button>
                </div>
                 <button 
                    style={{...styles.button, ...styles.buttonSecondary}}
                    onClick={handleSimulateNewComments}
                    disabled={isSimulating}
                >
                    {isSimulating ? 'Симуляция...' : '📡 Симулировать новые комментарии'}
                </button>
            </div>
            <div style={{...styles.communityLayout, padding: '24px', flex: 1, gridTemplateColumns: activeTab === 'spam' ? '1fr' : '400px 1fr' }}>
                {renderMainContent()}
            </div>
        </div>
    );
};