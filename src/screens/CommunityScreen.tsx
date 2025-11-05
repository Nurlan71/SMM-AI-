import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { styles } from '../styles'; 
import type { Comment } from '../types';
import { EmptyState } from '../components/EmptyState';

// A local type for managing UI state within the component
type CommentWithUIState = Comment & {
    isGeneratingReplies?: boolean;
    replies?: string[];
};

const getTagStyle = (tag: string): React.CSSProperties => {
    switch (tag) {
        case 'lead':
            return { backgroundColor: '#d4edda', color: '#155724', borderColor: '#c3e6cb' };
        case 'complaint':
            return { backgroundColor: '#f8d7da', color: '#721c24', borderColor: '#f5c6cb' };
        case 'faq_candidate':
            return { backgroundColor: '#cce5ff', color: '#004085', borderColor: '#b8daff' };
        case 'positive_feedback':
            return { backgroundColor: '#fff3cd', color: '#856404', borderColor: '#ffeeba' };
        default:
            return { backgroundColor: '#e9ecef', color: '#495057', borderColor: '#ced4da' };
    }
};

const getTagLabel = (tag: string): string => {
    switch (tag) {
        case 'lead': return '🔥 Лид';
        case 'complaint': return '😡 Жалоба';
        case 'faq_candidate': return '❓ В FAQ';
        case 'positive_feedback': return '👍 Позитив';
        default: return tag;
    }
};


export const CommunityScreen = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const [localComments, setLocalComments] = useState<CommentWithUIState[]>([]);
    const [filter, setFilter] = useState<'all' | 'new' | 'replied'>('all');
    const [isAutopilotOn, setIsAutopilotOn] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);

    useEffect(() => {
        // Sync local state with global context on initial load and context changes
        setLocalComments(dataState.comments);
    }, [dataState.comments]);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const brandContextPrompt = useMemo(() => `
        Тон голоса (Tone of Voice): "${dataState.settings.toneOfVoice}"
        Ключевые и стоп-слова: "${dataState.settings.keywords}"
        Целевая аудитория: "${dataState.settings.targetAudience}"
    `.trim(), [dataState.settings]);

    const handleGenerateReplies = async (comment: CommentWithUIState) => {
        setLocalComments(prev => prev.map(c => c.id === comment.id ? { ...c, isGeneratingReplies: true } : c));
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Ты — SMM-менеджер. Тебе нужно предложить 3 варианта ответа на комментарий пользователя. Ответы должны быть вежливыми, полезными и соответствовать тону бренда.
            **Гайдлайны по стилю бренда:** ${brandContextPrompt}
            **Комментарий пользователя:** "${comment.text}"
            Верни результат в формате JSON-массива из 3 строк.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            });

            const parsedReplies: string[] = JSON.parse(response.text as string);
            setLocalComments(prev => prev.map(c => c.id === comment.id ? { ...c, isGeneratingReplies: false, replies: parsedReplies } : c));
        } catch (error) {
            addToast('Не удалось сгенерировать ответы.', 'error');
            setLocalComments(prev => prev.map(c => c.id === comment.id ? { ...c, isGeneratingReplies: false } : c));
        }
    };
    
    const handleAutopilotResponse = useCallback(async (comment: Comment) => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const tagCommentFunction: FunctionDeclaration = {
              name: 'tagComment',
              parameters: {
                type: Type.OBJECT,
                description: 'Применяет описательный тег к комментарию для его категоризации. Используй этот инструмент, если комментарий является жалобой, вопросом для FAQ, положительным отзывом или запросом на покупку.',
                properties: {
                  tag: {
                    type: Type.STRING,
                    description: "Тег для применения. Должен быть одним из: 'lead' (запрос на покупку), 'complaint' (жалоба), 'faq_candidate' (вопрос для FAQ), 'positive_feedback' (положительный отзыв)."
                  },
                },
                required: ['tag'],
              },
            };

            const prompt = `Ты — AI-автопилот SMM-менеджера. Твоя задача - проанализировать комментарий и отреагировать.
            **Гайдлайны по стилю бренда:** ${brandContextPrompt}
            **Комментарий пользователя:** "${comment.text}"
            
            **Инструкции:**
            1.  Проанализируй намерение пользователя.
            2.  Если комментарий - это прямой вопрос о покупке, жалоба, частый вопрос или ценный положительный отзыв, ИСПОЛЬЗУЙ ИНСТРУМЕНТ \`tagComment\` для его классификации.
            3.  После использования инструмента (или если он не нужен), напиши вежливый и полезный ответ, соответствующий тону бренда. Если инструмент был использован, ответ должен это учитывать (например, если это жалоба, извинись).
            4.  Верни только текст ответа, без лишних фраз.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ functionDeclarations: [tagCommentFunction] }]
                }
            });

            const functionCalls = response.functionCalls;
            let updatedTags = comment.tags || [];

            if (functionCalls) {
                for (const fc of functionCalls) {
                    if (fc.name === 'tagComment') {
                        const tag = fc.args.tag as string;
                        if (tag && !updatedTags.includes(tag)) {
                            updatedTags.push(tag);
                        }
                    }
                }
            }

            // Update comment on the backend
             const updatedCommentData: Partial<Comment> = {
                status: 'replied',
                aiTag: true,
                tags: updatedTags,
            };

             const updateResponse = await fetchWithAuth(`${API_BASE_URL}/api/comments/${comment.id}`, {
                 method: 'PUT',
                 body: JSON.stringify(updatedCommentData),
             });
             const savedComment: Comment = await updateResponse.json();
             
             // Update global and local state
             dataDispatch({ type: 'UPDATE_COMMENT', payload: savedComment });
             addToast(`Автопилот ответил на комментарий от ${comment.author}.`, 'success');

        } catch (error) {
            console.error(`Autopilot failed for comment ${comment.id}:`, error);
            // Optionally update the comment to indicate failure
        }
    }, [brandContextPrompt, dataDispatch, addToast]);

    const handleSimulateComments = async () => {
        setIsSimulating(true);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/comments/simulate`, { method: 'POST' });
            const newComments: Comment[] = await response.json();
            dataDispatch({ type: 'ADD_COMMENTS', payload: newComments });
            addToast(`Получено ${newComments.length} новых комментариев!`, 'success');

            if (isAutopilotOn) {
                addToast(`🤖 AI Autopilot активирован...`, 'success');
                await Promise.all(newComments.map(comment => handleAutopilotResponse(comment)));
            }

        } catch (error) {
            addToast('Не удалось симулировать комментарии.', 'error');
        } finally {
            setIsSimulating(false);
        }
    };
    
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast('Ответ скопирован!', 'success');
    };

    const filteredComments = useMemo(() => {
        if (filter === 'all') return localComments;
        return localComments.filter(c => c.status === filter);
    }, [filter, localComments]);

    return (
        <div style={styles.communityLayout}>
            <div style={styles.communitySidebar}>
                <h3 style={styles.cardTitle}>Фильтры</h3>
                <button 
                    style={filter === 'all' ? {...styles.communityFilterButton, ...styles.communityFilterButtonActive} : styles.communityFilterButton}
                    onClick={() => setFilter('all')}
                >
                    Все
                </button>
                <button 
                    style={filter === 'new' ? {...styles.communityFilterButton, ...styles.communityFilterButtonActive} : styles.communityFilterButton}
                    onClick={() => setFilter('new')}
                >
                    Новые
                </button>
                 <button 
                    style={filter === 'replied' ? {...styles.communityFilterButton, ...styles.communityFilterButtonActive} : styles.communityFilterButton}
                    onClick={() => setFilter('replied')}
                >
                    Отвечено
                </button>
                <div style={{borderTop: '1px solid #e9ecef', margin: '16px 0'}}></div>
                 <label style={styles.autopilotToggle} htmlFor="autopilot-switch">
                    <span style={{fontWeight: 600}}>🤖 AI Autopilot</span>
                    <input 
                        type="checkbox" 
                        id="autopilot-switch"
                        checked={isAutopilotOn}
                        onChange={(e) => setIsAutopilotOn(e.target.checked)}
                    />
                </label>
                 <p style={styles.cardSubtitle}>Если включено, AI будет автоматически отвечать и тегировать новые комментарии.</p>
                <button 
                    style={isSimulating ? styles.buttonDisabled : styles.button}
                    onClick={handleSimulateComments}
                    disabled={isSimulating}
                >
                    {isSimulating ? <div style={styles.miniLoader}></div> : '📥 Симулировать новые'}
                </button>
            </div>
            <div style={{overflowY: 'auto', height: '100%', paddingRight: '10px'}}>
                {filteredComments.length === 0 ? (
                    <EmptyState 
                        icon="💬"
                        title="Здесь пока пусто"
                        description="Здесь будут отображаться комментарии из ваших социальных сетей. Нажмите 'Симулировать', чтобы увидеть пример."
                    />
                ) : (
                    <div style={styles.inboxFeed}>
                        {filteredComments.map(comment => (
                            <div key={comment.id} style={styles.inboxCard}>
                                <div style={styles.inboxCardHeader}>
                                    <div style={{...styles.inboxCardAvatar, background: `hsl(${comment.id * 50}, 70%, 80%)`}}></div>
                                    <div>
                                        <p style={styles.inboxCardAuthor}>{comment.author}</p>
                                        <p style={styles.inboxCardMeta}>из {comment.platform}</p>
                                    </div>
                                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        {comment.tags?.map(tag => <span key={tag} style={{...styles.inboxCardTag, ...getTagStyle(tag)}}>{getTagLabel(tag)}</span>)}
                                        {comment.aiTag && <span style={styles.inboxCardAiTag}>Обработано AI</span>}
                                    </div>
                                </div>
                                <p>{comment.text}</p>
                                {comment.status === 'new' && (
                                    <div style={styles.inboxCardReplySection}>
                                        <button 
                                            style={{...styles.button, ...styles.replyButton}}
                                            onClick={() => handleGenerateReplies(comment)}
                                            disabled={comment.isGeneratingReplies}
                                        >
                                            {comment.isGeneratingReplies ? <div style={{...styles.miniLoader, borderTopColor: '#004085', border: '3px solid rgba(0, 64, 133, 0.3)'}}></div> : '💡 Ответить с AI'}
                                        </button>
                                        {comment.replies && (
                                            <div style={{marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                                {comment.replies.map((reply, index) => (
                                                    <div key={index} style={styles.inboxCardReplyOption}>
                                                        <p style={{flex: 1, marginRight: '12px'}}>{reply}</p>
                                                        <button style={{...styles.button, ...styles.inboxCardReplyButton}} onClick={() => handleCopy(reply)}>Копировать</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
