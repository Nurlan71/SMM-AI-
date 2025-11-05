import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { styles } from '../styles';
import type { Post, PostStatus } from '../types';

// Helper function to clean markdown-like syntax
const cleanMarkdown = (text: string) => {
    return text
        .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
        .replace(/(\*|_)(.*?)\1/g, '$2')   // Italic
        .replace(/^(#+\s*)/gm, '')         // Headers
        .replace(/`([^`]+)`/g, '$1');      // Inline code
};


// A simple type for the post ideas we expect from the AI
type PostIdea = Omit<Post, 'id' | 'status' | 'date'>;

export const StrategyGeneratorScreen = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();

    const [objective, setObjective] = useState('');
    const [duration, setDuration] = useState('1 месяц');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [strategyResult, setStrategyResult] = useState('');
    const [postIdeas, setPostIdeas] = useState<PostIdea[]>([]);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const handleGenerate = async () => {
        if (!objective) return;
        setIsLoading(true);
        setError('');
        setStrategyResult('');
        setPostIdeas([]);

        try {
            const { settings } = dataState;

            // This is a complex prompt that instructs the AI to generate a structured markdown document
            // and also embed a JSON block that we can easily parse.
            const prompt = `
Ты — гениальный SMM-стратег. Тебе нужно создать полноценную SMM-стратегию.

**Гайдлайны бренда:**
- Тон голоса: ${settings.toneOfVoice}
- Ключевые слова/стоп-слова: ${settings.keywords}
- Целевая аудитория: ${settings.targetAudience}
- Активные платформы: ${settings.platforms.join(', ')}

**Задача:**
- Основная цель: ${objective}
- Длительность кампании: ${duration}

**Твоя задача:**
Сгенерируй детальный SMM-план. План должен включать следующие разделы:
1.  **Креативная идея кампании**: Главный концепт, который объединит все активности.
2.  **Ключевые сообщения**: 2-3 основных тезиса, которые мы доносим до аудитории.
3.  **Рубрики контента**: 3-4 постоянных рубрики с описанием (например, "Закулисье", "Полезные советы").
4.  **Тактика по платформам**: Конкретные рекомендации для каждой из активных платформ.
5.  **Примеры постов**: 2-3 готовых примера постов, которые иллюстрируют стратегию.

Не используй Markdown-разметку (звездочки, решетки). Используй простые заголовки и абзацы.

После основного текста, ОБЯЗАТЕЛЬНО добавь специальный блок с JSON-данными, содержащий 3-5 идей для постов из стратегии. Этот блок должен быть обернут в теги [POST_IDEAS_JSON]...[/POST_IDEAS_JSON].
Формат JSON: массив объектов, где каждый объект имеет поля "topic", "postType", "description".

Пример JSON-блока:
[POST_IDEAS_JSON]
[
  {"topic": "5 способов носить наш новый льняной шарф", "postType": "Полезный совет", "description": "Видео-инструкция или карусель с фотографиями..."},
  {"topic": "Прямой эфир с дизайнером коллекции", "postType": "Анонс", "description": "Анонсируем встречу, где дизайнер ответит на вопросы..."}
]
[/POST_IDEAS_JSON]
`.trim();

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            // Using a more powerful model for this complex task
            const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
            const rawText = response.text;

            const jsonRegex = /\[POST_IDEAS_JSON\]([\s\S]*?)\[\/POST_IDEAS_JSON\]/;
            const jsonMatch = rawText.match(jsonRegex);
            
            if (jsonMatch && jsonMatch[1]) {
                const jsonString = jsonMatch[1];
                const parsedIdeas: PostIdea[] = JSON.parse(jsonString);
                setPostIdeas(parsedIdeas);
                
                // Remove the JSON block from the display text
                const markdownText = rawText.replace(jsonRegex, '').trim();
                setStrategyResult(markdownText);
            } else {
                // If the JSON block is missing, just show the whole text and log a warning
                setStrategyResult(rawText);
                console.warn("Could not find the JSON block for post ideas in the AI response.");
            }

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Ошибка генерации стратегии: ${message}`);
            addToast(`Ошибка генерации: ${message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAddToBacklog = async () => {
        if (postIdeas.length === 0) return;
        
        const ideasWithStatus = postIdeas.map(idea => ({ ...idea, status: 'draft' as PostStatus }));
        try {
            const savedPostsPromises = ideasWithStatus.map(idea => 
                fetchWithAuth(`${API_BASE_URL}/api/posts`, {
                    method: 'POST',
                    body: JSON.stringify(idea),
                }).then(res => res.json())
            );
            const savedPosts = await Promise.all(savedPostsPromises);
            dataDispatch({ type: 'ADD_MANY_POSTS', payload: savedPosts });
            addToast(`${postIdeas.length} идей добавлено в бэклог!`, 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Не удалось сохранить идеи.", 'error');
        }
    };
    
    // For now, just a placeholder function
    const handleSaveToPdf = () => {
        addToast('Функция сохранения в PDF будет добавлена в будущем.', 'success');
    }

    return (
        <div style={styles.strategyLayout}>
            <div style={styles.strategyControls}>
                <h2 style={styles.cardTitle}>🔮 Генератор SMM-стратегий</h2>
                <p style={styles.cardSubtitle}>Опишите вашу главную цель, а AI создаст детальный план, основанный на гайдлайнах вашего бренда из Настроек.</p>
                <div style={styles.formGroup}>
                    <label htmlFor="objective" style={styles.label}>Основная цель кампании</label>
                    <textarea
                        id="objective"
                        style={{...styles.textarea, minHeight: '100px'}}
                        placeholder="Например: 'Увеличить продажи новой осенней коллекции пальто на 20% в следующем квартале'"
                        value={objective}
                        onChange={e => setObjective(e.target.value)}
                    />
                </div>
                 <div style={styles.formGroup}>
                    <label htmlFor="duration" style={styles.label}>Длительность кампании</label>
                    <select id="duration" style={styles.input} value={duration} onChange={e => setDuration(e.target.value)}>
                        <option>1 месяц</option>
                        <option>3 месяца</option>
                        <option>6 месяцев</option>
                    </select>
                </div>
                 <button style={objective ? styles.button : styles.buttonDisabled} onClick={handleGenerate} disabled={!objective || isLoading}>
                    {isLoading ? <div style={styles.miniLoader}></div> : 'Создать стратегию'}
                </button>
            </div>
            
            <div style={styles.strategyResult}>
                <h2 style={styles.cardTitle}>Ваша новая SMM-стратегия</h2>
                <div style={styles.strategyResultContent}>
                    {isLoading && <div style={styles.loader}></div>}
                    {error && <p style={styles.errorText}>{error}</p>}
                    {!isLoading && !strategyResult && <p style={styles.placeholderText}>Здесь появится готовая стратегия...</p>}
                    {strategyResult && <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '1rem'}}>{cleanMarkdown(strategyResult)}</pre>}
                </div>
                 {strategyResult && (
                    <div style={styles.strategyActions}>
                        <button style={{...styles.button, backgroundColor: '#6c757d'}} onClick={handleSaveToPdf}>💾 Сохранить в PDF</button>
                        <button style={styles.button} onClick={handleAddToBacklog} disabled={postIdeas.length === 0}>➕ Добавить идеи в бэклог</button>
                    </div>
                )}
            </div>
        </div>
    );
};