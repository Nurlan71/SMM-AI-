import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useAppContext } from '../contexts/AppContext';
import { styles } from '../styles';

// Helper function to clean markdown-like syntax
const cleanMarkdown = (text: string) => {
    return text
        .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
        .replace(/(\*|_)(.*?)\1/g, '$2')   // Italic
        .replace(/^(#+\s*)/gm, '')         // Headers
        .replace(/`([^`]+)`/g, '$1');      // Inline code
};

// Define a type for the source object from grounding chunks
interface GroundingSource {
    web: {
        uri: string;
        title: string;
    }
}

export const TrendSpotterScreen = () => {
    const { dispatch: appDispatch } = useAppContext();

    const [keywords, setKeywords] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [trendReport, setTrendReport] = useState('');
    const [sources, setSources] = useState<GroundingSource[]>([]);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const handleFindTrends = async () => {
        if (!keywords) return;
        setIsLoading(true);
        setError('');
        setTrendReport('');
        setSources([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
                Проанализируй самую свежую информацию в интернете по теме: "${keywords}".
                Твоя задача — выявить 3-5 главных актуальных тренда.
                Для каждого тренда предоставь:
                1. Краткое, но емкое описание сути тренда.
                2. Одну конкретную идею для контента (пост, видео, сторис), как SMM-менеджер может использовать этот тренд.
                
                Представь результат в виде структурированного отчета. Не используй Markdown-форматирование (звездочки, решетки).
            `.trim();

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });

            setTrendReport(response.text);
            
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const webSources = groundingChunks.filter((chunk): chunk is GroundingSource => !!chunk.web);
            setSources(webSources);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Ошибка поиска трендов: ${message}`);
            addToast(`Ошибка: ${message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.strategyLayout}>
            <div style={styles.strategyControls}>
                <h2 style={styles.cardTitle}>📈 Поиск трендов</h2>
                <p style={styles.cardSubtitle}>
                    AI проанализирует актуальную информацию в Google, чтобы найти свежие тренды и идеи в вашей нише.
                </p>
                <div style={styles.formGroup}>
                    <label htmlFor="keywords" style={styles.label}>Опишите вашу сферу или ключевые слова</label>
                    <textarea
                        id="keywords"
                        style={{ ...styles.textarea, minHeight: '100px' }}
                        placeholder="Например: 'мода, экологичная одежда, ручная работа' или 'кофейни в Москве'"
                        value={keywords}
                        onChange={e => setKeywords(e.target.value)}
                    />
                </div>
                <button style={keywords ? styles.button : styles.buttonDisabled} onClick={handleFindTrends} disabled={!keywords || isLoading}>
                    {isLoading ? <div style={styles.miniLoader}></div> : '🔍 Найти тренды'}
                </button>
            </div>

            <div style={styles.strategyResult}>
                <h2 style={styles.cardTitle}>Найденные тренды</h2>
                <div style={styles.strategyResultContent}>
                    {isLoading && <div style={styles.loader}></div>}
                    {error && <p style={styles.errorText}>{error}</p>}
                    {!isLoading && !trendReport && <p style={styles.placeholderText}>Здесь появится отчет о трендах...</p>}
                    {trendReport && (
                        <div style={{width: '100%', alignSelf: 'flex-start'}}>
                             <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '1rem', textAlign: 'left' }}>{cleanMarkdown(trendReport)}</pre>
                            {sources.length > 0 && (
                                <div style={styles.trendSourcesContainer}>
                                    <h3 style={styles.cardTitle}>Источники</h3>
                                    <ul style={styles.trendSourceList}>
                                        {sources.map((source, index) => (
                                            <li key={index} style={styles.trendSourceItem}>
                                                <a href={source.web.uri} target="_blank" rel="noopener noreferrer" style={styles.trendSourceLink}>
                                                    {source.web.title || source.web.uri}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};