import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { useAppContext } from '../../contexts/AppContext';
import { useDataContext } from '../../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../../api';
import { styles } from '../../styles';
import type { Post, PostStatus, BrandComplianceResult, PerformanceForecastResult, AppFile } from '../../types';

const statusOptions: { value: PostStatus; label: string }[] = [
    { value: 'draft', label: 'Черновик' },
    { value: 'scheduled', label: 'Запланировано' },
    { value: 'published', label: 'Опубликовано' },
    { value: 'needs-approval', label: 'Требует утверждения' },
    { value: 'needs-revision', label: 'Нужна доработка' },
    { value: 'approved', label: 'Утверждено' },
];

const platformIcons: { [key: string]: string } = {
    instagram: '📸',
    vk: '👥',
    telegram: '✈️',
    tiktok: '🎵',
    youtube: '📺',
    dzen: '🧘',
    pinterest: '📌',
    odnoklassniki: '🧑‍🤝‍🧑',
    rutube: '▶️',
};

export const PostDetailModal = () => {
    const { state: appState, dispatch: appDispatch } = useAppContext();
    const { state: dataState, dispatch: dataDispatch } = useDataContext();

    const [post, setPost] = useState<Post | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    
    // State for Details Tab
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [complianceResult, setComplianceResult] = useState<BrandComplianceResult | null>(null);
    const [forecastResult, setForecastResult] = useState<PerformanceForecastResult | null>(null);
    const [analysisError, setAnalysisError] = useState('');
    
    // State for Visuals Tab
    const [activeTab, setActiveTab] = useState<'details' | 'visual'>('details');
    const [isVisualsLoading, setIsVisualsLoading] = useState(false);
    const [kbSuggestions, setKbSuggestions] = useState<AppFile[]>([]);
    const [genIdeas, setGenIdeas] = useState<string[]>([]);
    const [generatedImage, setGeneratedImage] = useState<{url: string; base64: string} | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    
    // State for Adaptation
    const [isAdapting, setIsAdapting] = useState(false);
    const [adaptedContent, setAdaptedContent] = useState<{ platform: string; content: string }[]>([]);

    const imageFiles = useMemo(() => dataState.files.filter(f => f.mimeType.startsWith('image/')), [dataState.files]);

    useEffect(() => {
        if (appState.activePostId) {
            const activePost = dataState.posts.find(p => p.id === appState.activePostId);
            setPost(activePost ? { ...activePost } : null);
            // Reset all states
            setIsEditing(false);
            setActiveTab('details');
            setComplianceResult(null);
            setForecastResult(null);
            setKbSuggestions([]);
            setGenIdeas([]);
            setGeneratedImage(null);
            setAdaptedContent([]);
        }
    }, [appState.activePostId, dataState.posts]);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const onClose = () => appDispatch({ type: 'CLOSE_POST_DETAIL_MODAL' });

    const handleFieldChange = (field: keyof Post, value: any) => {
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
            const compliancePrompt = `Ты — AI-ассистент, который проверяет контент на соответствие гайдлайнам бренда. **Гайдлайны бренда:** - Тон голоса: ${settings.toneOfVoice} - Ключевые/стоп-слова: ${settings.keywords} - Целевая аудитория: ${settings.targetAudience} **Текст поста для анализа:** "${post.content}" **Твоя задача:** Оцени пост по 100-балльной шкале и дай краткий, конструктивный фидбэк (не более 2-3 предложений). Верни ответ СТРОГО в формате JSON.`;
            const complianceResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash', contents: compliancePrompt, config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING } }, required: ["score", "feedback"] } }
            });
            setComplianceResult(JSON.parse(complianceResponse.text as string));
    
            const forecastPrompt = `Ты — AI-маркетолог, прогнозирующий эффективность SMM-постов. **Информация о бренде:** - Целевая аудитория: ${settings.targetAudience} **Текст поста для анализа:** "${post.content}" **Твоя задача:** Спрогнозируй показатели: engagement_score (0-100), potential_reach ('Низкий'/'Средний'/'Высокий'), virality_chance ('Низкий'/'Средний'/'Высокий') и дай 1-2 кратких совета по улучшению. Верни ответ СТРОГО в формате JSON.`;
            const forecastResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash', contents: forecastPrompt, config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { engagement_score: { type: Type.NUMBER }, potential_reach: { type: Type.STRING }, virality_chance: { type: Type.STRING }, recommendations: { type: Type.STRING } }, required: ["engagement_score", "potential_reach", "virality_chance", "recommendations"] } }
            });
            setForecastResult(JSON.parse(forecastResponse.text as string));
    
        } catch (err) {
            setAnalysisError('Не удалось выполнить анализ. Попробуйте позже.');
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    const handleFindVisuals = async () => {
        if (!post?.content) return;
        setIsVisualsLoading(true);
        setKbSuggestions([]);
        setGenIdeas([]);
        setGeneratedImage(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // 1. Get keywords for KB search
            const keywordPrompt = `Извлеки 3-5 релевантных ключевых слов или коротких фраз из текста поста. Ключевые слова должны быть полезны для поиска изображений. Верни JSON-массив строк. Текст: "${post.content}"`;
            const keywordResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash', contents: keywordPrompt, config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: {type: Type.STRING} } }
            });
            const keywords: string[] = JSON.parse(keywordResponse.text as string);
            
            // Simple filtering logic based on keywords
            const suggestions = imageFiles.filter(file => 
                keywords.some(kw => file.name.toLowerCase().includes(kw.toLowerCase()))
            ).slice(0, 4);
            setKbSuggestions(suggestions);

            // 2. Get new image generation ideas
            const imagePromptGenPrompt = `Основываясь на тексте поста, создай 2 креативных, визуально описательных промпта для AI-генератора изображений. Промпты должны быть короткими. Верни JSON-массив строк. Текст: "${post.content}"`;
            const imagePromptResponse = await ai.models.generateContent({
                 model: 'gemini-2.5-flash', contents: imagePromptGenPrompt, config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: {type: Type.STRING} } }
            });
            setGenIdeas(JSON.parse(imagePromptResponse.text as string));

        } catch (err) {
             addToast(err instanceof Error ? err.message : 'Не удалось подобрать визуал.', 'error');
        } finally {
            setIsVisualsLoading(false);
        }
    };

    const handleGenerateImageInModal = async (prompt: string) => {
        setIsGeneratingImage(true);
        setGeneratedImage(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001', prompt: `${prompt}, фотореализм`, config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
            });
            if (!response.generatedImages || response.generatedImages.length === 0) {
                throw new Error('API не вернуло изображение.');
            }
            const base64 = response.generatedImages[0].image.imageBytes;
            const url = `data:image/jpeg;base64,${base64}`;
            setGeneratedImage({ base64, url });
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Ошибка генерации изображения.', 'error');
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleAdaptContent = async () => {
        if (!post?.content || dataState.settings.platforms.length === 0) return;
        setIsAdapting(true);
        setAdaptedContent([]);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const { settings } = dataState;
            const prompt = `
    Ты — эксперт по SMM, который мастерски адаптирует контент под разные соцсети.
    **Гайдлайны бренда:**
    - Тон голоса: ${settings.toneOfVoice}
    - Ключевые слова/стоп-слова: ${settings.keywords}
    - Целевая аудитория: ${settings.targetAudience}
    **Исходный текст для адаптации:**
    "${post.content}"
    **Задача:**
    Перепиши этот текст для следующих платформ: ${settings.platforms.join(', ')}.
    Учитывай уникальный формат, стиль и аудиторию каждой из них.
    Например, для Instagram добавь больше эмодзи и раздели текст на абзацы для легкости чтения. Для Telegram сделай текст более лаконичным и прямым. Для VK можно оставить его более детальным и информативным.
    Верни результат СТРОГО в формате JSON-массива объектов.
            `.trim();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
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
            setAdaptedContent(JSON.parse(response.text as string));
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Ошибка адаптации контента.', 'error');
        } finally {
            setIsAdapting(false);
        }
    };
    
    const handleCopyAdapted = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast('Текст скопирован!', 'success');
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
            <div style={{...styles.modalContent, maxWidth: '900px'}} onClick={(e) => e.stopPropagation()}>
                <button style={styles.modalCloseButton} onClick={onClose}>&times;</button>
                <div style={styles.modalHeader}>
                     <input 
                        type="text"
                        value={post.topic}
                        onChange={(e) => handleFieldChange('topic', e.target.value)}
                        style={{...styles.input, fontSize: '1.5rem', fontWeight: 600, border: 'none', padding: '0'}}
                     />
                </div>
                <div style={{...styles.modalBody, display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', flex: 1}}>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                        {post.attachedImageUrl && (
                            <div style={styles.postPreviewImageContainer}>
                                <img src={post.attachedImageUrl} alt="Прикрепленное изображение" style={styles.postPreviewImage} />
                                <button style={styles.postPreviewImageRemoveBtn} onClick={() => handleFieldChange('attachedImageUrl', null)}>×</button>
                            </div>
                        )}
                        <textarea
                            value={post.content || ''}
                            onChange={(e) => handleFieldChange('content', e.target.value)}
                            style={{...styles.textarea, minHeight: '300px', flex: 1}}
                            placeholder="Начните писать текст вашего поста здесь..."
                        />
                        <div style={styles.postDetailAdaptationSection}>
                            <button 
                                style={{...styles.button, width: '100%'}} 
                                onClick={handleAdaptContent} 
                                disabled={isAdapting || !post.content || dataState.settings.platforms.length === 0}
                            >
                                {isAdapting ? <div style={styles.miniLoader}></div> : '🚀 Адаптировать для всех платформ'}
                            </button>
                            {adaptedContent.length > 0 && (
                                <div style={{display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', maxHeight: '250px', overflowY: 'auto', paddingRight: '8px'}}>
                                    {adaptedContent.map((result) => (
                                        <div key={result.platform} style={styles.postDetailAdaptationResultCard}>
                                            <div style={styles.adapterResultHeader}>
                                                <span style={{fontSize: '1.5rem'}}>{platformIcons[result.platform.toLowerCase()] || '🌐'}</span>
                                                <h3 style={styles.adapterResultTitle}>{result.platform}</h3>
                                            </div>
                                            <button style={{...styles.button, ...styles.adapterCopyButton}} onClick={() => handleCopyAdapted(result.content)}>Копировать</button>
                                            <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem'}}>{result.content}</pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <div style={styles.modalTabs}>
                            <button style={activeTab === 'details' ? styles.modalTabActive : styles.modalTab} onClick={() => setActiveTab('details')}>Детали</button>
                            <button style={activeTab === 'visual' ? styles.modalTabActive : styles.modalTab} onClick={() => setActiveTab('visual')}>🎨 Визуал</button>
                        </div>
                        {activeTab === 'details' && (
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
                                    {complianceResult && <div style={{...styles.analysisSection, marginTop: '12px'}}>
                                        <div style={{...styles.analysisScoreCircle, backgroundColor: scoreColor}}>{complianceResult.score}</div>
                                        <div style={styles.analysisFeedback}><p style={styles.analysisTitle}>✅ Соответствие бренду</p><p style={styles.analysisText}>{complianceResult.feedback}</p></div>
                                    </div>}
                                    {forecastResult && <div style={{...styles.analysisSection, marginTop: '12px', display: 'block'}}>
                                        <p style={styles.analysisTitle}>📈 Прогноз эффективности</p>
                                        <div style={styles.forecastMetrics}>
                                            <div style={styles.forecastMetricItem}><span style={styles.forecastMetricValue}>{forecastResult.engagement_score}</span><span style={styles.forecastMetricLabel}>Вовлеченность</span></div>
                                            <div style={styles.forecastMetricItem}><span style={styles.forecastMetricValue}>{forecastResult.potential_reach}</span><span style={styles.forecastMetricLabel}>Охват</span></div>
                                            <div style={styles.forecastMetricItem}><span style={styles.forecastMetricValue}>{forecastResult.virality_chance}</span><span style={styles.forecastMetricLabel}>Виральность</span></div>
                                        </div>
                                        <div style={{...styles.forecastRecommendations, marginTop: '12px'}}><p style={styles.analysisText}><strong>Совет:</strong> {forecastResult.recommendations}</p></div>
                                    </div>}
                                </div>
                            </div>
                        )}
                        {activeTab === 'visual' && (
                            <div style={styles.visualAssistantContainer}>
                                <button style={styles.button} onClick={handleFindVisuals} disabled={isVisualsLoading || !post.content}>
                                    {isVisualsLoading ? <div style={styles.miniLoader}></div> : '🤖 Подобрать визуал с AI'}
                                </button>
                                {(kbSuggestions.length > 0 || genIdeas.length > 0 || generatedImage) && !isVisualsLoading && (
                                    <>
                                        <div style={styles.visualAssistantSection}>
                                            <p style={styles.visualAssistantTitle}>Из Базы Знаний</p>
                                            <div style={styles.kbSuggestionGrid}>
                                                {kbSuggestions.map(file => <div key={file.id} style={{...styles.kbSuggestionThumb, backgroundImage: `url(${file.url})`}} onClick={() => handleFieldChange('attachedImageUrl', file.url)} />)}
                                            </div>
                                             {kbSuggestions.length === 0 && <p style={{fontSize: '0.9rem', color: '#6c757d'}}>Ничего не найдено. Попробуйте загрузить больше файлов в Базу.</p>}
                                        </div>
                                        <div style={styles.visualAssistantSection}>
                                             <p style={styles.visualAssistantTitle}>Сгенерировать новое</p>
                                             <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                                 {genIdeas.map((idea, i) => <button key={i} style={styles.genIdeaButton} onClick={() => handleGenerateImageInModal(idea)}>✨ {idea}</button>)}
                                             </div>
                                             {isGeneratingImage && <div style={{display: 'flex', justifyContent: 'center', padding: '20px'}}><div style={styles.loader}></div></div>}
                                             {generatedImage && <div style={{marginTop: '12px'}}><img src={generatedImage.url} style={{width: '100%', borderRadius: '8px'}} alt="Сгенерированное изображение"/> <button style={{...styles.button, width: '100%', marginTop: '8px'}} onClick={() => handleFieldChange('attachedImageUrl', generatedImage.url)}>Прикрепить это</button> </div>}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
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