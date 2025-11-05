
import React, { useState, useCallback, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { useDataContext } from '../contexts/DataContext';
import { useAppContext } from '../contexts/AppContext';
import { styles } from '../styles';
import { EmptyState } from '../components/EmptyState';
import type { Post } from '../types';

interface AdaptedContent {
    platform: string;
    content: string;
}

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

export const ContentAdapterScreen = () => {
    const { state: dataState } = useDataContext();
    const { dispatch: appDispatch } = useAppContext();

    const [sourceTab, setSourceTab] = useState<'manual' | 'knowledge'>('manual');
    const [manualText, setManualText] = useState('');
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [adaptedResults, setAdaptedResults] = useState<AdaptedContent[]>([]);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);

    const handlePlatformToggle = (platformId: string) => {
        setSelectedPlatforms(prev =>
            prev.includes(platformId)
                ? prev.filter(p => p !== platformId)
                : [...prev, platformId]
        );
    };

    const handleAdapt = async () => {
        const sourceText = sourceTab === 'manual' ? manualText : selectedPost?.content;
        if (!sourceText || selectedPlatforms.length === 0) {
            addToast('Пожалуйста, введите текст и выберите хотя бы одну платформу.', 'error');
            return;
        }

        setIsLoading(true);
        setError('');
        setAdaptedResults([]);

        try {
            const { settings } = dataState;
            const prompt = `
Ты — эксперт по SMM, который мастерски адаптирует контент под разные соцсети.

**Гайдлайны бренда:**
- Тон голоса: ${settings.toneOfVoice}
- Ключевые слова/стоп-слова: ${settings.keywords}
- Целевая аудитория: ${settings.targetAudience}

**Исходный текст для адаптации:**
"${sourceText}"

**Задача:**
Перепиши этот текст для следующих платформ: ${selectedPlatforms.join(', ')}.
Учитывай уникальный формат, стиль и аудиторию каждой из них.
Например, для Instagram добавь больше эмодзи и раздели текст на абзацы для легкости чтения. Для Telegram сделай текст более лаконичным и прямым. Для VK можно оставить его более детальным и информативным.

Верни результат СТРОГО в формате JSON-массива объектов.
            `.trim();

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

            const parsedResults = JSON.parse(response.text) as AdaptedContent[];
            setAdaptedResults(parsedResults);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Ошибка адаптации: ${message}`);
            addToast(`Ошибка: ${message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast('Текст скопирован!', 'success');
    };
    
    const availablePlatforms = useMemo(() => {
        return dataState.settings.platforms.map(pId => ({
            id: pId,
            name: platformOptions.find(opt => opt.id === pId)?.name || pId,
            icon: platformOptions.find(opt => opt.id === pId)?.icon || '🌐',
        }));
    }, [dataState.settings.platforms]);
    
    const platformOptions = [
        { id: 'instagram', name: 'Instagram', icon: '📸' },
        { id: 'vk', name: 'VK', icon: '👥' },
        { id: 'telegram', name: 'Telegram', icon: '✈️' },
        { id: 'tiktok', name: 'TikTok', icon: '🎵' },
        { id: 'youtube', name: 'YouTube', icon: '📺' },
        { id: 'dzen', name: 'Дзен', icon: '🧘' },
        { id: 'pinterest', name: 'Pinterest', icon: '📌' },
        { id: 'odnoklassniki', name: 'Одноклассники', icon: '🧑‍🤝‍🧑' },
        { id: 'rutube', name: 'Rutube', icon: '▶️' },
    ];


    return (
        <div style={styles.generatorLayout}>
            <div style={styles.generatorControls}>
                <h2 style={styles.cardTitle}>Адаптер контента</h2>
                <p style={styles.cardSubtitle}>Введите или выберите текст, укажите целевые платформы, и AI перепишет его под нужный формат.</p>
                
                {/* Source Selection */}
                <div style={styles.adapterSourceTabs}>
                    <button 
                        style={sourceTab === 'manual' ? styles.adapterSourceTabActive : styles.adapterSourceTab}
                        onClick={() => setSourceTab('manual')}
                    >
                        Ввести текст
                    </button>
                    <button 
                        style={sourceTab === 'knowledge' ? styles.adapterSourceTabActive : styles.adapterSourceTab}
                        onClick={() => setSourceTab('knowledge')}
                    >
                        Выбрать из Базы
                    </button>
                </div>

                {sourceTab === 'manual' ? (
                    <textarea
                        style={{ ...styles.textarea, minHeight: '150px' }}
                        placeholder="Вставьте сюда ваш исходный текст..."
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                    />
                ) : (
                    <div style={styles.adapterPostList}>
                        {dataState.posts.map(post => (
                            <div 
                                key={post.id} 
                                style={selectedPost?.id === post.id ? {...styles.adapterPostItem, ...styles.adapterPostItemActive} : styles.adapterPostItem}
                                onClick={() => setSelectedPost(post)}
                            >
                                <strong>{post.topic}</strong>
                                <p style={{fontSize: '0.9rem', color: '#6c757d'}}>{post.description}</p>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Platform Selection */}
                <div style={styles.formGroup}>
                    <label style={styles.label}>Адаптировать для:</label>
                    <div style={{...styles.platformGrid, gridTemplateColumns: '1fr 1fr'}}>
                        {availablePlatforms.map(platform => (
                             <div
                                key={platform.id}
                                style={selectedPlatforms.includes(platform.id) ? { ...styles.platformCard, ...styles.platformCardActive } : styles.platformCard}
                                onClick={() => handlePlatformToggle(platform.id)}
                            >
                                <span style={{fontSize: '1.5rem', marginRight: '12px'}}>{platform.icon}</span>
                                <span style={styles.platformName}>{platform.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button 
                    style={isLoading ? styles.buttonDisabled : styles.button} 
                    onClick={handleAdapt} 
                    disabled={isLoading}
                >
                    {isLoading ? <div style={styles.miniLoader}></div> : '🔄 Адаптировать'}
                </button>
            </div>

            <div style={styles.generatorResult}>
                <h2 style={styles.cardTitle}>Результаты</h2>
                <div style={styles.resultBox}>
                    {isLoading && <div style={styles.loader}></div>}
                    {error && <p style={styles.errorText}>{error}</p>}
                    {!isLoading && adaptedResults.length === 0 && (
                        <EmptyState 
                            icon="✨"
                            title="Готовы к магии?"
                            description="Результаты адаптации для каждой выбранной платформы появятся здесь."
                        />
                    )}
                    {adaptedResults.length > 0 && (
                        <div style={styles.adapterResultGrid}>
                            {adaptedResults.map(result => (
                                <div key={result.platform} style={styles.adapterResultCard}>
                                    <div style={styles.adapterResultHeader}>
                                         <span style={{fontSize: '1.5rem'}}>{platformIcons[result.platform.toLowerCase()] || '🌐'}</span>
                                        <h3 style={styles.adapterResultTitle}>{result.platform}</h3>
                                    </div>
                                    <button style={{...styles.button, ...styles.adapterCopyButton}} onClick={() => handleCopy(result.content)}>Копировать</button>
                                    <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '1rem'}}>{result.content}</pre>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
