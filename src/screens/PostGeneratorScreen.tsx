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

export const PostGeneratorScreen = () => {
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();

    const [topic, setTopic] = useState('');
    const [postType, setPostType] = useState('Анонс');
    const [tone, setTone] = useState('');
    const [cta, setCta] = useState('');
    const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedContent, setGeneratedContent] = useState('');

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const handleFileSelect = (fileId: number) => {
        setSelectedFileIds(prev =>
            prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
        );
    };

    const handleGenerate = async () => {
        if (!topic) return;
        setIsLoading(true);
        setError('');
        setGeneratedContent('');

        try {
            const { settings, files } = dataState;
            const selectedFilesInfo = files
                .filter(f => selectedFileIds.includes(f.id))
                .map(f => `- Имя файла: ${f.name}, Тип: ${f.mimeType}`)
                .join('\n');

            const prompt = `
Ты — профессиональный SMM-копирайтер. Твоя задача — написать текст для поста в социальные сети.

**Информация о бренде:**
- Основной тон голоса: ${settings.toneOfVoice}
- Ключевые слова для использования / Стоп-слова: ${settings.keywords}
- Целевая аудитория: ${settings.targetAudience}

**Задача для поста:**
- Тема поста: ${topic}
- Тип поста (формат): ${postType}
${tone ? `- Желаемый тон (отличается от основного): ${tone}` : ''}
${cta ? `- Призыв к действию (CTA): ${cta}` : ''}
${selectedFilesInfo ? `\n**Контекст из прикрепленных файлов:**\n${selectedFilesInfo}` : ''}

Напиши вовлекающий и качественный текст поста, который соответствует всем указанным требованиям. Верни только готовый текст поста, без лишних заголовков и комментариев. Не используй Markdown-разметку (звездочки, решетки).
            `.trim();

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setGeneratedContent(response.text);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Ошибка генерации: ${message}`);
            addToast(`Ошибка генерации: ${message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopyToClipboard = () => {
        if (!generatedContent) return;
        navigator.clipboard.writeText(cleanMarkdown(generatedContent));
        addToast('Текст скопирован в буфер обмена!', 'success');
    };

    const handleAddToBacklog = async () => {
        if (!generatedContent) return;
        
        const cleanContent = cleanMarkdown(generatedContent);
        const newPost: Omit<Post, 'id'> = {
            topic: topic || "Сгенерированный пост",
            postType: postType,
            description: cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : ''),
            status: 'draft' as PostStatus,
            content: cleanContent,
        };

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/posts`, {
                method: 'POST',
                body: JSON.stringify(newPost),
            });
            const savedPost: Post = await response.json();
            dataDispatch({ type: 'ADD_POST', payload: savedPost });
            addToast('Пост добавлен в бэклог!', 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Не удалось сохранить пост.", 'error');
        }
    };


    return (
        <div style={styles.generatorLayout}>
            <div style={styles.generatorControls}>
                <h2 style={styles.cardTitle}>Создать пост</h2>
                <div style={styles.formGroup}>
                    <label htmlFor="topic" style={styles.label}>Тема или ключевая идея</label>
                    <textarea
                        id="topic"
                        style={{...styles.textarea, minHeight: '100px'}}
                        placeholder="Например: 'Рассказать о скидках 20% на новую коллекцию льна'"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                    />
                </div>
                 <div style={styles.formGroup}>
                    <label htmlFor="postType" style={styles.label}>Тип контента</label>
                    <select id="postType" style={styles.input} value={postType} onChange={e => setPostType(e.target.value)}>
                        <option>Анонс</option>
                        <option>Продающий пост</option>
                        <option>Полезный совет</option>
                        <option>Развлекательный</option>
                        <option>Вовлекающий (опрос, вопрос)</option>
                    </select>
                </div>
                 <div style={styles.formGroup}>
                    <label htmlFor="tone" style={styles.label}>Тон голоса (необязательно)</label>
                    <input
                        id="tone"
                        type="text"
                        style={styles.input}
                        placeholder="Например: 'Более юмористический, с эмодзи'"
                        value={tone}
                        onChange={e => setTone(e.target.value)}
                    />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="cta" style={styles.label}>Призыв к действию (необязательно)</label>
                    <input
                        id="cta"
                        type="text"
                        style={styles.input}
                        placeholder="Например: 'Переходите по ссылке в профиле'"
                        value={cta}
                        onChange={e => setCta(e.target.value)}
                    />
                </div>

                 <div style={styles.formGroup}>
                    <label style={styles.label}>Опереться на файлы из Базы знаний</label>
                    <div style={styles.fileSelectionGrid}>
                        {dataState.files.map(file => (
                            <div
                                key={file.id}
                                style={{
                                    ...styles.fileSelectItem,
                                    ...(file.mimeType.startsWith('image/') && { backgroundImage: `url(${file.url})` }),
                                    ...(selectedFileIds.includes(file.id) && styles.fileSelectItemActive)
                                }}
                                onClick={() => handleFileSelect(file.id)}
                            >
                                {!file.mimeType.startsWith('image/') && <span style={styles.fileSelectIcon}>📄</span>}
                                <div style={styles.fileSelectOverlay}>{file.name}</div>
                                {selectedFileIds.includes(file.id) && <div style={styles.fileSelectCheck}>✓</div>}
                            </div>
                        ))}
                    </div>
                </div>
                 <button style={topic ? styles.button : styles.buttonDisabled} onClick={handleGenerate} disabled={!topic || isLoading}>
                    {isLoading ? <div style={styles.miniLoader}></div> : '✍️ Сгенерировать'}
                </button>
            </div>
            <div style={styles.generatorResult}>
                <h2 style={styles.cardTitle}>Результат</h2>
                <div style={styles.resultBox}>
                    {isLoading && <div style={styles.loader}></div>}
                    {error && <p style={styles.errorText}>{error}</p>}
                    {!isLoading && !generatedContent && <p style={styles.placeholderText}>Здесь появится сгенерированный текст поста...</p>}
                    {generatedContent && <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '1rem'}}>{cleanMarkdown(generatedContent)}</pre>}
                </div>
                 {generatedContent && (
                    <div style={{...styles.modalFooter, borderTop: 'none', paddingTop: '20px', justifyContent: 'flex-end', gap: '12px' }}>
                        <button style={{...styles.button, backgroundColor: '#6c757d'}} onClick={handleCopyToClipboard}>Копировать</button>
                        <button style={styles.button} onClick={handleAddToBacklog}>Добавить в бэклог</button>
                    </div>
                )}
            </div>
        </div>
    );
};