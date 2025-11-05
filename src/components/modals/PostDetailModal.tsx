import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../../api';
import { styles } from '../../styles';
import type { Post, PostStatus, BrandComplianceResult, PerformanceForecastResult } from '../../types';

const statusOptions: { value: PostStatus; label: string }[] = [
    { value: 'draft', label: 'Черновик' },
    { value: 'scheduled', label: 'Запланировано' },
    { value: 'published', label: 'Опубликовано' },
    { value: 'needs-approval', label: 'Требует утверждения' },
    { value: 'needs-revision', label: 'Нужна доработка' },
    { value: 'approved', label: 'Утверждено' },
];

export const PostDetailModal = () => {
    const { state: appState, dispatch: appDispatch } = useAppContext();
    const { state: dataState, dispatch: dataDispatch } = useDataContext();

    const [post, setPost] = useState<Post | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [complianceResult, setComplianceResult] = useState<BrandComplianceResult | null>(null);
    const [forecastResult, setForecastResult] = useState<PerformanceForecastResult | null>(null);
    const [analysisError, setAnalysisError] = useState('');

    useEffect(() => {
        if (appState.activePostId) {
            const activePost = dataState.posts.find(p => p.id === appState.activePostId);
            setPost(activePost ? { ...activePost } : null);
            setIsEditing(false); // Reset editing state when post changes
        }
    }, [appState.activePostId, dataState.posts]);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const onClose = () => appDispatch({ type: 'CLOSE_POST_DETAIL_MODAL' });

    const handleFieldChange = (field: keyof Post, value: string) => {
        if (post) {
            setPost({ ...post, [field]: value });
            if (!isEditing) setIsEditing(true);
        }
    };

    const handleSave = async () => {
        if (!post) return;
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/posts/${post.id}`, {
                method: 'PUT',
                body: JSON.stringify(post),
            });
            const savedPost: Post = await response.json();
            dataDispatch({ type: 'UPDATE_POST', payload: savedPost });
            addToast('Пост успешно сохранен!', 'success');
            onClose();
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Не удалось сохранить пост.', 'error');
        }
    };
    
    const handleDelete = async () => {
        if (!post || !window.confirm(`Вы уверены, что хотите удалить пост "${post.topic}"?`)) return;
        try {
            await fetchWithAuth(`${API_BASE_URL}/api/posts/${post.id}`, { method: 'DELETE' });
            dataDispatch({ type: 'DELETE_POST', payload: post.id });
            addToast('Пост удален.', 'success');
            onClose();
        } catch (error) {
             addToast(error instanceof Error ? error.message : 'Не удалось удалить пост.', 'error');
        }
    };

    const handleAnalyze = async () => {
        if (!post?.content) return;
        setIsAnalyzing(true);
        setAnalysisError('');
        setComplianceResult(null);
        setForecastResult(null);
    
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const settings = dataState.settings;
    
            // --- Brand Compliance Check ---
            const compliancePrompt = `
                Ты — AI-ассистент, который проверяет контент на соответствие гайдлайнам бренда.
                **Гайдлайны бренда:**
                - Тон голоса: ${settings.toneOfVoice}
                - Ключевые/стоп-слова: ${settings.keywords}
                - Целевая аудитория: ${settings.targetAudience}
                **Текст поста для анализа:** "${post.content}"
                **Твоя задача:** Оцени пост по 100-балльной шкале и дай краткий, конструктивный фидбэк (не более 2-3 предложений).
                Верни ответ СТРОГО в формате JSON.
            `;
            const complianceResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: compliancePrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            score: { type: Type.NUMBER },
                            feedback: { type: Type.STRING }
                        },
                        required: ["score", "feedback"]
                    }
                }
            });
            setComplianceResult(JSON.parse(complianceResponse.text as string));
    
            // --- Performance Forecast ---
            const forecastPrompt = `
                Ты — AI-маркетолог, прогнозирующий эффективность SMM-постов.
                **Информация о бренде:**
                - Целевая аудитория: ${settings.targetAudience}
                **Текст поста для анализа:** "${post.content}"
                **Твоя задача:** Спрогнозируй показатели: engagement_score (0-100), potential_reach ('Низкий'/'Средний'/'Высокий'), virality_chance ('Низкий'/'Средний'/'Высокий') и дай 1-2 кратких совета по улучшению.
                Верни ответ СТРОГО в формате JSON.
            `;
             const forecastResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: forecastPrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            engagement_score: { type: Type.NUMBER },
                            potential_reach: { type: Type.STRING },
                            virality_chance: { type: Type.STRING },
                            recommendations: { type: Type.STRING }
                        },
                         required: ["engagement_score", "potential_reach", "virality_chance", "recommendations"]
                    }
                }
            });
            setForecastResult(JSON.parse(forecastResponse.text as string));
    
        } catch (err) {
            setAnalysisError('Не удалось выполнить анализ. Попробуйте позже.');
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    const scoreColor = useMemo(() => {
        if (!complianceResult) return '#6c757d';
        if (complianceResult.score >= 85) return '#28a745';
        if (complianceResult.score >= 60) return '#ffc107';
        return '#dc3545';
    }, [complianceResult]);

    if (!post) return null;

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={{...styles.modalContent, maxWidth: '800px'}} onClick={(e) => e.stopPropagation()}>
                <button style={styles.modalCloseButton} onClick={onClose}>&times;</button>
                <div style={styles.modalHeader}>
                     <input 
                        type="text"
                        value={post.topic}
                        onChange={(e) => handleFieldChange('topic', e.target.value)}
                        style={{...styles.input, fontSize: '1.5rem', fontWeight: 600, border: 'none', padding: '0'}}
                     />
                </div>
                <div style={{...styles.modalBody, display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', flex: 1}}>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                        <textarea
                            value={post.content || ''}
                            onChange={(e) => handleFieldChange('content', e.target.value)}
                            style={{...styles.textarea, minHeight: '300px', flex: 1}}
                            placeholder="Начните писать текст вашего поста здесь..."
                        />
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Статус</label>
                            <select value={post.status} onChange={(e) => handleFieldChange('status', e.target.value)} style={styles.input}>
                                {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                         <div style={styles.formGroup}>
                            <label style={styles.label}>Дата публикации</label>
                            <input type="date" value={post.date || ''} onChange={(e) => handleFieldChange('date', e.target.value)} style={styles.input} />
                        </div>
                        <div style={{borderTop: '1px solid #e9ecef', paddingTop: '20px'}}>
                            <button style={styles.button} onClick={handleAnalyze} disabled={isAnalyzing || !post.content}>
                                {isAnalyzing ? <div style={styles.miniLoader}></div> : '🚀 Анализ и улучшение'}
                            </button>
                            {analysisError && <p style={{...styles.errorText, marginTop: '10px'}}>{analysisError}</p>}
                            {complianceResult && (
                                <div style={{...styles.analysisSection, marginTop: '12px'}}>
                                    <div style={{...styles.analysisScoreCircle, backgroundColor: scoreColor}}>{complianceResult.score}</div>
                                    <div style={styles.analysisFeedback}>
                                        <p style={styles.analysisTitle}>✅ Соответствие бренду</p>
                                        <p style={styles.analysisText}>{complianceResult.feedback}</p>
                                    </div>
                                </div>
                            )}
                             {forecastResult && (
                                <div style={{...styles.analysisSection, marginTop: '12px', display: 'block'}}>
                                    <p style={styles.analysisTitle}>📈 Прогноз эффективности</p>
                                    <div style={styles.forecastMetrics}>
                                        <div style={styles.forecastMetricItem}>
                                            <span style={styles.forecastMetricValue}>{forecastResult.engagement_score}</span>
                                            <span style={styles.forecastMetricLabel}>Вовлеченность</span>
                                        </div>
                                         <div style={styles.forecastMetricItem}>
                                            <span style={styles.forecastMetricValue}>{forecastResult.potential_reach}</span>
                                            <span style={styles.forecastMetricLabel}>Охват</span>
                                        </div>
                                         <div style={styles.forecastMetricItem}>
                                            <span style={styles.forecastMetricValue}>{forecastResult.virality_chance}</span>
                                            <span style={styles.forecastMetricLabel}>Виральность</span>
                                        </div>
                                    </div>
                                    <div style={{...styles.forecastRecommendations, marginTop: '12px'}}>
                                        <p style={styles.analysisText}><strong>Совет:</strong> {forecastResult.recommendations}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={styles.modalFooter}>
                    <button style={styles.deleteButtonFooter} onClick={handleDelete}>Удалить пост</button>
                    <button style={isEditing ? styles.button : styles.buttonDisabled} onClick={handleSave} disabled={!isEditing}>
                        Сохранить изменения
                    </button>
                </div>
            </div>
        </div>
    );
};