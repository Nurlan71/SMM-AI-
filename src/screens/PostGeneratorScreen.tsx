import React, { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { useDataContext } from '../contexts/DataContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';
import type { Post } from '../types';

// --- Types & Constants ---
type PostType = 'Анонс' | 'Полезный совет' | 'Развлекательный пост' | 'Продающий пост' | 'История';
const POST_TYPES: PostType[] = ['Анонс', 'Полезный совет', 'Развлекательный пост', 'Продающий пост', 'История'];

type ToneOfVoice = 'Использовать голос бренда' | 'Дружелюбный' | 'Официальный' | 'Юмористический' | 'Экспертный';
const TONES: ToneOfVoice[] = ['Использовать голос бренда', 'Дружелюбный', 'Официальный', 'Юмористический', 'Экспертный'];


export const PostGeneratorScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { state: dataState, dispatch: dataDispatch } = useDataContext();

    // Form state
    const [topic, setTopic] = useState('Анонс новой осенней коллекции');
    const [postType, setPostType] = useState<PostType>('Анонс');
    const [keywords, setKeywords] = useState('уют, шерсть, ручная работа');
    const [toneOfVoice, setToneOfVoice] = useState<ToneOfVoice>('Использовать голос бренда');
    const [variantCount, setVariantCount] = useState(2);
    
    // Generation state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState<string[]>([]);
    
    const handleGenerate = async () => {
        if (!topic.trim()) {
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пожалуйста, введите тему поста', type: 'error' } });
            return;
        }

        setIsLoading(true);
        setError('');
        setResults([]);

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/generate-post`, {
                method: 'POST',
                body: JSON.stringify({
                    topic,
                    postType,
                    keywords,
                    toneOfVoice,
                    brandSettings: dataState.settings,
                    variantCount
                }),
            });
            setResults(response.variants);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setError(errorMessage);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        appDispatch({ type: 'ADD_TOAST', payload: { message: 'Текст скопирован!', type: 'success' } });
    };

    const handleSaveToDrafts = async (text: string) => {
        try {
            const newPost = await fetchWithAuth(`${API_BASE_URL}/api/posts`, {
                method: 'POST',
                body: JSON.stringify({ content: text, status: 'idea' }),
            });
            dataDispatch({ type: 'ADD_POST', payload: newPost });
            appDispatch({ type: 'ADD_TOAST', payload: { message: 'Пост добавлен в черновики!', type: 'success' } });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Не удалось сохранить черновик.";
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        }
    };
    
    const renderResults = () => {
        if (isLoading) {
            return (
                <div style={styles.wizardLoadingContainer}>
                    <div style={styles.spinner}></div>
                    <p>✍️ Создаем пост... AI подбирает лучшие слова.</p>
                </div>
            );
        }
        if (error) {
            return (
                <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
                    <h4>Ошибка генерации</h4>
                    <p>{error}</p>
                </div>
            );
        }
        if (results.length === 0) {
            return (
                <EmptyState
                    icon="✍️"
                    title="Генератор постов"
                    description="Заполните информацию слева, и AI напишет для вас несколько вариантов текста для поста."
                />
            );
        }
        return (
            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                {results.map((text, index) => (
                     <div key={index} style={{...styles.card, padding: '16px'}}>
                        <pre style={{...styles.contentAdapterResult, position: 'relative', border: 'none', padding: '0', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '15px'}}>{text}</pre>
                        <div style={{borderTop: '1px solid #e9ecef', marginTop: '16px', paddingTop: '12px', display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
                             <button style={styles.commentActionButton} onClick={() => handleCopyToClipboard(text)}>
                                📋 Копировать
                            </button>
                             <button style={{...styles.commentActionButton, color: '#007bff', borderColor: '#007bff'}} onClick={() => handleSaveToDrafts(text)}>
                                ✏️ Добавить в черновики
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div style={styles.contentAdapterLayout}>
            {/* Left Panel: Controls */}
            <div style={styles.contentAdapterPanel}>
                 <h2 style={{fontWeight: 600}}>Создайте пост</h2>
                <p style={{ color: '#6c757d', marginTop: '-10px', fontSize: '14px' }}>Заполните поля, чтобы AI создал контент, который соответствует вашему стилю и целям.</p>
                
                <div>
                    <label htmlFor="topic" style={styles.generatorLabel}>Основная идея или тема поста</label>
                    <textarea id="topic" style={styles.generatorTextarea} rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} />
                </div>
                
                <div>
                    <label htmlFor="postType" style={styles.generatorLabel}>Тип поста</label>
                    <select id="postType" style={styles.generatorSelect} value={postType} onChange={(e) => setPostType(e.target.value as PostType)}>
                        {POST_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                
                <div>
                    <label htmlFor="keywords" style={styles.generatorLabel}>Ключевые слова (через запятую)</label>
                    <input id="keywords" type="text" style={styles.generatorSelect} value={keywords} onChange={e => setKeywords(e.target.value)} />
                </div>
                
                <div>
                    <label htmlFor="toneOfVoice" style={styles.generatorLabel}>Тон общения</label>
                    <select id="toneOfVoice" style={styles.generatorSelect} value={toneOfVoice} onChange={(e) => setToneOfVoice(e.target.value as ToneOfVoice)}>
                        {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div style={{ ...styles.wizardSliderContainer, alignItems: 'flex-start' }}>
                    <label style={{ ...styles.wizardSliderLabel, fontSize: '14px', fontWeight: 600, color: '#495057' }}>
                        Количество вариантов: <span style={{ color: '#007bff' }}>{variantCount}</span>
                    </label>
                    <input
                        type="range" min="1" max="3"
                        value={variantCount}
                        onChange={(e) => setVariantCount(Number(e.target.value))}
                        style={{ ...styles.wizardSlider, width: '100%' }}
                    />
                </div>

                 <button
                    style={{ ...styles.button, ...styles.buttonPrimary, marginTop: 'auto', padding: '14px' }}
                    className="newCampaignButton"
                    onClick={handleGenerate}
                    disabled={isLoading}
                >
                    {isLoading ? 'Генерация...' : '✨ Сгенерировать пост'}
                </button>
            </div>
            
            {/* Right Panel: Result */}
            <div style={styles.contentAdapterPanel}>
                <h2 style={{fontWeight: 600}}>Результаты</h2>
                {renderResults()}
            </div>
        </div>
    );
};