import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { styles } from '../../styles';
import { Post } from '../../types';

const GOALS = [
    { id: 'awareness', icon: '🎨', title: 'Повысить узнаваемость' },
    { id: 'followers', icon: '📈', title: 'Привлечь подписчиков' },
    { id: 'sales', icon: '💰', title: 'Увеличить продажи' },
    { id: 'launch', icon: '🚀', title: 'Анонсировать событие' },
    { id: 'content', icon: '✍️', title: 'Просто создать контент' },
];

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const CampaignWizardModal = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { state: dataState, dispatch: dataDispatch } = useDataContext();

    const [step, setStep] = useState(1);
    const [goal, setGoal] = useState('');
    const [description, setDescription] = useState('');
    const [postCount, setPostCount] = useState(5);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleClose = () => appDispatch({ type: 'SET_CAMPAIGN_WIZARD_OPEN', payload: false });

    const handleGenerate = async () => {
        if (!API_KEY) {
            setError("API ключ не найден. Пожалуйста, добавьте VITE_GEMINI_API_KEY в ваш .env файл.");
            appDispatch({ type: 'ADD_TOAST', payload: { message: "API ключ не найден.", type: 'error' } });
            return;
        }
        setIsLoading(true);
        setError('');

        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const selectedGoal = GOALS.find(g => g.id === goal)?.title || 'Не указана';

        const systemInstruction = `Ты - эксперт SMM-менеджер. Твоя задача - создать серию постов для социальных сетей на основе запроса пользователя.
        - Проанализируй цель кампании, описание, а также общие настройки бренда (Tone of Voice, ключевые слова, целевая аудитория).
        - Создай ровно ${postCount} постов.
        - Каждый пост должен быть уникальным и соответствовать общей цели.
        - Выбери подходящую платформу для каждого поста из списка доступных: ${dataState.settings.platforms.join(', ')}.
        - Ответь СТРОГО в формате JSON-массива объектов. Не добавляй никаких других слов или форматирования вроде \`\`\`json.
        - Каждый объект в массиве должен содержать два поля: "platform" (string) и "content" (string).`;
        
        const prompt = `
        **Цель кампании:** ${selectedGoal}
        **Описание идеи от пользователя:** ${description}
        ---
        **Настройки бренда:**
        - **Tone of Voice:** ${dataState.settings.toneOfVoice}
        - **Ключевые слова:** ${dataState.settings.keywords}
        - **Целевая аудитория:** ${dataState.settings.targetAudience}
        `;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                platform: { type: Type.STRING },
                                content: { type: Type.STRING },
                            },
                            required: ["platform", "content"],
                        },
                    },
                },
            });
            
            const jsonStr = response.text.trim();
            const generatedPosts = JSON.parse(jsonStr);

            const highestId = dataState.posts.reduce((maxId, post) => Math.max(post.id, maxId), 0);

            const newPosts: Post[] = generatedPosts.map((p: any, index: number) => ({
                id: highestId + index + 1,
                platform: p.platform,
                content: p.content,
                media: [],
                status: 'idea',
                tags: [],
                comments_count: 0,
                likes_count: 0,
                views_count: 0,
            }));

            dataDispatch({ type: 'ADD_MANY_POSTS', payload: newPosts });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Посты успешно сгенерированы!', type: 'success' } });
            handleClose();

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка при генерации.";
            setError(`Ошибка: ${errorMessage}`);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка генерации: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsLoading(false);
        }
    };

    const renderStepContent = () => {
        if (isLoading) {
            return (
                <div style={styles.wizardLoadingContainer}>
                    <div style={styles.spinner}></div>
                    <p>Магия AI в действии... Генерируем посты.</p>
                </div>
            );
        }

        switch (step) {
            case 1:
                return (
                    <>
                        <h4 style={{ textAlign: 'center', marginBottom: '24px', fontWeight: 500 }}>Какова главная цель вашей кампании?</h4>
                        <div style={styles.wizardOptionGrid}>
                            {GOALS.map(({ id, icon, title }) => (
                                <div
                                    key={id}
                                    style={goal === id ? { ...styles.wizardOptionCard, ...styles.wizardOptionCardSelected } : styles.wizardOptionCard}
                                    onClick={() => setGoal(id)}
                                >
                                    <div style={styles.wizardOptionIcon}>{icon}</div>
                                    <div>{title}</div>
                                </div>
                            ))}
                        </div>
                    </>
                );
            case 2:
                return (
                    <>
                        <h4 style={{ marginBottom: '16px', fontWeight: 500 }}>Опишите вашу идею</h4>
                        <textarea
                            style={styles.wizardTextarea}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Например: 'Запустить акцию 'Осеннее обновление' для нашей новой коллекции вязаных свитеров...'"
                        />
                    </>
                );
            case 3:
                return (
                    <div style={styles.wizardSliderContainer}>
                        <h4 style={styles.wizardSliderLabel}>Сколько постов сгенерировать? <span style={{ color: '#007bff', fontWeight: 600 }}>{postCount}</span></h4>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={postCount}
                            onChange={(e) => setPostCount(Number(e.target.value))}
                            style={styles.wizardSlider}
                        />
                    </div>
                );
            default: return null;
        }
    };
    
    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <header style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>Мастер создания кампании</h3>
                    <button style={styles.modalCloseButton} onClick={handleClose}>&times;</button>
                </header>
                <div style={styles.modalBody}>
                    {!isLoading && (
                         <div style={styles.wizardStepIndicator}>
                            {[1, 2, 3].map(s => (
                                <div key={s} style={step === s ? {...styles.wizardStepDot, ...styles.wizardStepDotActive} : styles.wizardStepDot} />
                            ))}
                        </div>
                    )}
                    {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '1rem' }}>{error}</p>}
                    {renderStepContent()}
                </div>
                {!isLoading && (
                    <footer style={styles.modalFooter}>
                        {step > 1 && (
                            <button
                                style={{ ...styles.button, ...styles.buttonSecondary, marginRight: 'auto' }}
                                onClick={() => setStep(s => s - 1)}
                            >
                                Назад
                            </button>
                        )}
                        {step < 3 && (
                            <button
                                style={{ ...styles.button, ...styles.buttonPrimary }}
                                disabled={ (step === 1 && !goal) || (step === 2 && !description) }
                                onClick={() => setStep(s => s + 1)}
                            >
                                Далее
                            </button>
                        )}
                        {step === 3 && (
                            <button
                                style={{ ...styles.button, ...styles.buttonPrimary }}
                                className="newCampaignButton"
                                onClick={handleGenerate}
                            >
                                ✨ Сгенерировать
                            </button>
                        )}
                    </footer>
                )}
            </div>
        </div>
    );
};
