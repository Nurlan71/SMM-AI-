import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../../api';
import { styles } from '../../styles';
import type { Post, PostStatus } from '../../types';

interface CampaignResult {
    campaign_name: string;
    target_audience: string;
    goals: string[];
    post_ideas: Omit<Post, 'id' | 'status' | 'date'>[];
}

export const CampaignWizardModal = () => {
    const { dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();
    const [step, setStep] = useState(1);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<CampaignResult | null>(null);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const onClose = () => appDispatch({ type: 'SET_CAMPAIGN_WIZARD_OPEN', payload: false });
    
    const onAddPostIdeas = async (ideas: Omit<Post, 'id' | 'status'>[]) => {
        const ideasWithStatus = ideas.map(idea => ({ ...idea, status: 'draft' as PostStatus }));
        try {
            const savedPostsPromises = ideasWithStatus.map(idea => 
                fetchWithAuth(`${API_BASE_URL}/api/posts`, {
                    method: 'POST',
                    body: JSON.stringify(idea),
                }).then(res => res.json())
            );
            const savedPosts = await Promise.all(savedPostsPromises);
            dataDispatch({ type: 'ADD_MANY_POSTS', payload: savedPosts });
            addToast(`${ideas.length} идей добавлено в бэклог!`, 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Не удалось сохранить идеи.", 'error');
        }
    };

    const handleGenerateCampaign = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const fullPrompt = `
                Ты — гениальный SMM-стратег. Тебе нужно создать креативную SMM-кампанию.
                **Задача кампании:** ${prompt}
                **Что нужно сгенерировать:**
                1.  **campaign_name**: Яркое и запоминающееся название для кампании.
                2.  **target_audience**: Детальное описание целевой аудитории этой кампании.
                3.  **goals**: Список из 3-4 ключевых целей кампании (например, "Увеличить вовлеченность", "Привлечь новых подписчиков").
                4.  **post_ideas**: Список из 5-7 конкретных идей для постов, которые раскрывают суть кампании. Для каждой идеи укажи 'topic', 'postType' и 'description'.
                Верни ответ СТРОГО в формате JSON.
            `;
            
            const postIdeaSchema = {
                 type: Type.OBJECT,
                properties: {
                    topic: { type: Type.STRING },
                    postType: { type: Type.STRING },
                    description: { type: Type.STRING },
                },
                required: ["topic", "postType", "description"],
            };

            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    campaign_name: { type: Type.STRING },
                    target_audience: { type: Type.STRING },
                    goals: { type: Type.ARRAY, items: { type: Type.STRING } },
                    post_ideas: { type: Type.ARRAY, items: postIdeaSchema },
                },
                required: ["campaign_name", "target_audience", "goals", "post_ideas"],
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });

            const parsedResult = JSON.parse(response.text as string) as CampaignResult;
            setResult(parsedResult);
            setStep(2);

        } catch (err) {
            console.error('Ошибка при генерации кампании:', err);
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Произошла ошибка: ${message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAddAndClose = async () => {
        if (result) {
            await onAddPostIdeas(result.post_ideas);
        }
        onClose();
    };

    const resetWizard = () => {
        setStep(1);
        setPrompt('');
        setError('');
        setResult(null);
    };

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button style={styles.modalCloseButton} onClick={onClose}>&times;</button>
                 <div style={styles.modalHeader}>
                    <h2 style={styles.cardTitle}>🚀 Мастер создания кампании (Шаг {step}/2)</h2>
                 </div>
                 <div style={styles.modalBody}>
                    {step === 1 && (
                         <>
                            <div style={styles.formGroup}>
                                <label style={styles.label} htmlFor="campaign-prompt">Опишите цель вашей кампании</label>
                                <textarea
                                    id="campaign-prompt"
                                    style={{...styles.textarea, minHeight: '120px'}}
                                    placeholder="Например: 'Запуск новой летней коллекции одежды из льна' или 'Привлечение внимания к нашему новому веганскому меню'"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                />
                            </div>
                            {error && <p style={styles.errorText}>{error}</p>}
                            <button
                                style={prompt ? styles.button : styles.buttonDisabled}
                                disabled={!prompt || isLoading}
                                onClick={handleGenerateCampaign}
                            >
                                {isLoading ? <div style={styles.miniLoader}></div> : '✨ Сгенерировать кампанию'}
                            </button>
                        </>
                    )}
                    {step === 2 && result && (
                        <>
                            <div style={styles.campaignWizardResultSection}>
                                <h3 style={styles.cardTitle}>Кампания: "{result.campaign_name}"</h3>
                                <p><strong>Целевая аудитория:</strong> {result.target_audience}</p>
                                <p><strong>Цели:</strong> {result.goals.join(', ')}</p>
                            </div>
                            <div style={{...styles.planList, maxHeight: '300px', overflowY: 'auto', padding: '10px 0'}}>
                                {result.post_ideas.map((post, index) => (
                                    <div key={index} style={{...styles.planCard, cursor: 'default'}}>
                                        <strong style={styles.planCardTitle}>{post.topic}</strong>
                                        <span style={styles.planCardBadge}>{post.postType}</span>
                                        <p style={styles.planCardDescription}>{post.description}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                 </div>
                  <div style={{...styles.modalFooter, justifyContent: 'space-between'}}>
                    <button style={{...styles.button, backgroundColor: '#6c757d'}} onClick={resetWizard}>Начать заново</button>
                    <button style={styles.button} disabled={!result} onClick={handleAddAndClose}>
                        Добавить идеи и закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};
