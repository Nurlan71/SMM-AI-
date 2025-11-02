
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// ВАЖНО: Запросы к серверу временно отключены. Используются моковые данные.
// const API_BASE_URL = 'http://193.168.196.68:3001';

// --- MOCK DATA ---
const MOCK_FILES: AppFile[] = [
    { id: 1, name: 'autumn_coat.jpg', url: 'https://images.unsplash.com/photo-1571513722275-4b41940f54b8?q=80&w=1887&auto=format&fit=crop', mimeType: 'image/jpeg' },
    { id: 2, name: 'team_photo.png', url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop', mimeType: 'image/png' },
    { id: 3, name: 'product_video.mp4', url: 'https://placehold.co/600x400/a2d2ff/333333?text=Video', mimeType: 'video/mp4' },
    { id: 4, name: 'brand_guide.pdf', url: 'https://placehold.co/600x400/ffafcc/333333?text=PDF', mimeType: 'application/pdf' },
    { id: 5, name: 'new_collection.jpg', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop', mimeType: 'image/jpeg' },
];

const MOCK_UNSCHEDULED_POSTS = [
    { id: 101, topic: "Анонс осенней коллекции", postType: "Пост с фото", description: "Показать новые свитера и пальто. Сделать акцент на уюте и натуральных материалах." },
    { id: 102, topic: "Закулисье фотосессии", postType: "Видео Reels", description: "Смешные моменты и процесс съемки новой коллекции. Показать команду в действии." },
    { id: 103, topic: "Как выбрать идеальное пальто?", postType: "Статья", description: "Полезные советы по выбору пальто по типу фигуры и стилю. Продемонстрировать модели из нашего ассортимента." },
    { id: 104, topic: "5 способов носить шарф", postType: "Карусель", description: "Показать 5 разных образов с одним и тем же шарфом, чтобы вдохновить подписчиков." },
];

const MOCK_SCHEDULED_POSTS: Record<string, any[]> = {
    [`2025-11-${new Date().getDate()}`]: [{ id: 201, topic: "Прямой эфир с дизайнером", postType: "Live", description: "Ответы на вопросы о новой коллекции.", isPublished: false }],
    '2025-11-15': [{ id: 202, topic: "Розыгрыш сертификата", postType: "Конкурс", description: "Условия участия: лайк, подписка, комментарий.", isPublished: true }],
    '2025-11-22': [
        { id: 203, topic: "Отзыв клиента", postType: "Пост с фото", description: "Поделиться положительным отзывом от довольного клиента с его фотографией.", isPublished: false },
        { id: 204, topic: "Скидка на трикотаж", postType: "Промо", description: "Объявить о недельной скидке на все трикотажные изделия.", isPublished: false }
    ],
};

const MOCK_TEAM: TeamMember[] = [
    { id: 1, email: 'owner@smm.ai', role: 'Владелец' },
    { id: 2, email: 'manager@smm.ai', role: 'SMM-менеджер' },
    { id: 3, email: 'guest@smm.ai', role: 'Гость' },
];
// --- END MOCK DATA ---


// Helper для аутентифицированных запросов (оставлен для будущей интеграции)
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    console.warn("fetchWithAuth is mocked. No real request is being sent.");
    // Имитируем успешный ответ для операций, которые не возвращают данные
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
};

const AuthScreen = ({ onLoginSuccess }: { onLoginSuccess: (token: string) => void }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      setIsLoading(false);
      return;
    }
    // Симуляция регистрации
    setTimeout(() => {
        setSuccess('Регистрация прошла успешно! Теперь вы можете войти.');
        setActiveTab('login');
        setPassword('');
        setConfirmPassword('');
        setIsLoading(false);
    }, 1000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // Вход для разработки
    if (email === 'dev@smm.ai' && password === 'password') {
        setTimeout(() => {
            onLoginSuccess('fake-dev-token');
            setIsLoading(false);
        }, 500);
        return;
    }

    // Симуляция входа для любого другого пользователя
    if (email && password) {
         setTimeout(() => {
            onLoginSuccess(`fake-token-for-${email}`);
            setIsLoading(false);
        }, 1000);
    } else {
        setError('Введите email и пароль');
        setIsLoading(false);
    }
  };

  return (
    <div style={styles.authPage}>
      <div style={styles.authPanelLeft}>
        <div style={{...styles.authBlob, ...styles.authBlob1}}></div>
        <div style={{...styles.authBlob, ...styles.authBlob2}}></div>
        <div style={{...styles.authBlob, ...styles.authBlob3}}></div>
        <div style={styles.authPanelContent}>
          <h1 style={styles.authTitle}>SMM AI</h1>
          <p style={styles.authSubtitle}>Ваш интеллектуальный ассистент в мире социальных сетей.</p>
        </div>
      </div>
      <div style={styles.authPanelRight}>
        <div style={styles.authFormContainer}>
          <div style={styles.authTabs}>
            <button
              style={activeTab === 'login' ? styles.authTabActive : styles.authTab}
              onClick={() => setActiveTab('login')}
            >
              Вход
            </button>
            <button
              style={activeTab === 'register' ? styles.authTabActive : styles.authTab}
              onClick={() => setActiveTab('register')}
            >
              Регистрация
            </button>
          </div>
          
          {error && <p style={{...styles.authMessage, ...styles.authMessageError}}>{error}</p>}
          {success && <p style={{...styles.authMessage, ...styles.authMessageSuccess}}>{success}</p>}

          {activeTab === 'login' ? (
            <form style={styles.authForm} onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email (dev@smm.ai)"
                style={styles.authInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Пароль (password)"
                style={styles.authInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" style={isLoading ? styles.buttonDisabled : styles.authButton} className="authButton" disabled={isLoading}>{isLoading ? 'Вход...' : 'Войти'}</button>
            </form>
          ) : (
            <form style={styles.authForm} onSubmit={handleRegister}>
              <input
                type="email"
                placeholder="Email"
                style={styles.authInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Пароль"
                style={styles.authInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Подтвердите пароль"
                style={styles.authInput}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button type="submit" style={isLoading ? styles.buttonDisabled : styles.authButton} className="authButton" disabled={isLoading}>{isLoading ? 'Регистрация...' : 'Зарегистрироваться'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const socialPlatforms = [
  { id: 'instagram', name: 'Instagram', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png' },
  { id: 'vk', name: 'ВКонтакте', icon: 'https://upload.wikimedia.org/wikipedia/commons/2/21/VK.com-logo.svg' },
  { id: 'telegram', name: 'Telegram', icon: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg' },
  { id: 'dzen', name: 'Дзен', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSJibGFjayIgZD0iTTIxLjMzIDI0VjBoLTUuMjhMMTAuMDkgMTQuNzZWMEg0Ljh2MjRoNS40NEwxNi4yIDkuMjRWMjR6Ii8+PC9zdmc+' },
  { id: 'rutube', name: 'Rutube', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiNkZTAwMTEiLz48cGF0aCBkPSJNMTYuNTcgMTIuNDIyTDEwLjI4NCAxNi40MTZjLS41NDQuMzQ4LTEuMjQyLS4wNDItMS4yNDItLjY3NVY4LjI1OWMwLS42MzMuNjk4LTEuMDIzIDEuMjQyLS42NzVsNi4yODYgMy45OTJjLjU0NS4zNDguNTQ1IDEuMDAyIDAgMS4zNXoiIGZpbGw9IndoaXRlIi8+PC9zdmc+' },
  { id: 'ok', name: 'Одноклассники', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjRUU3NjAwIiBkPSJNMTIgMEM1LjM3MyAwIDAgNS4zNzMgMCAxMnM1LjM3MyAxMiAxMiAxMiAxMi01LjM3MyAxMi0xMlMxOC42MjcgMCAxMiAwem0uMDQyIDE3LjQxN2MtMy4wMzYgMC01LjYyNS0xLjg0OC02LjY3OC00LjQ4OGEzLjE4MiAzLjE4MiAwIDAgMSA1LjU4LTMuMzc0YzEuMDg3LS4zMDQgMi4yMDQtLjQ2MiAzLjMzLS40NjIgMS45MSAwIDMuNzMuNTggNS4yMjcgMS42Mi0xLjQxMyAyLjk3NC00LjQ2MyA2LjcxLTcuNDU5IDYuNzF6bS4yMDMtOC40NDhjLTEuNDkgMC0yLjcwMi0xLjIxMy0yLjcwMi0yLjcwMyAwLTEuNDg4IDEuMjEyLTIuNzAyIDIuNzAyLTIuNzAyIDEuNDg4IDAgMi43IDEuMjE0IDIuNyAyLjcwMiAwIDEuNDktMS4yMTMgMi43MDItMi43IDIuNzAyeiIvPjwvc3ZnPg==' },
  { id: 'tiktok', name: 'TikTok', icon: 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg' },
  { id: 'pinterest', name: 'Pinterest', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png' },
  { id: 'youtube', name: 'YouTube', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg' },
];

const getFileType = (fileNameOrMimeType: string) => {
    const mimeType = fileNameOrMimeType.includes('/') ? fileNameOrMimeType : '';
    const extension = !mimeType ? fileNameOrMimeType.split('.').pop()?.toLowerCase() || '' : '';
    
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) return { type: 'Изображение', icon: '🖼️', isImage: true };
    if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm'].includes(extension)) return { type: 'Видео', icon: '🎬', isImage: false };
    if (mimeType.startsWith('text/') || mimeType.includes('pdf') || mimeType.includes('document') || ['txt', 'md', 'pdf', 'doc', 'docx'].includes(extension)) return { type: 'Текст', icon: '📄', isImage: false };
    return { type: 'Файл', icon: '📁', isImage: false };
};

interface AppFile {
    id: number;
    name: string;
    url: string;
    mimeType: string;
}

const KnowledgeBaseScreen = ({ files, isLoading, onUpload, onDelete }: { 
    files: AppFile[], 
    isLoading: boolean,
    onUpload: (files: File[]) => void, 
    onDelete: (id: number) => void
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        onUpload(Array.from(event.target.files));
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files) {
        onUpload(Array.from(event.dataTransfer.files));
    }
  }, [onUpload]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const dropzoneStyle = useMemo(() => ({
    ...styles.dropzone,
    ...(isDragging ? styles.dropzoneActive : {}),
  }), [isDragging]);

  return (
    <div>
        <header style={styles.mainHeader}>
            <h1>База знаний</h1>
            <p>Загрузите сюда ваши материалы: фото, видео, описания продуктов и темы для постов.</p>
        </header>
        <div style={styles.knowledgeBaseContent}>
            <div 
              style={dropzoneStyle} 
              onDrop={handleDrop} 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
                <input type="file" id="file-upload" multiple style={{display: 'none'}} onChange={handleFileChange} />
                <span style={styles.uploadIcon}>☁️</span>
                <p>Перетащите файлы сюда или <strong>нажмите для выбора</strong></p>
            </div>

            <div style={styles.fileGrid}>
                {isLoading && <div style={{...styles.loader, position: 'relative', margin: '20px auto', gridColumn: '1 / -1'}}></div>}
                {!isLoading && files.length > 0 && <h3 style={{ gridColumn: '1 / -1' }}>Загруженные файлы:</h3>}
                {!isLoading && files.map((file) => {
                  const { icon, isImage } = getFileType(file.mimeType);
                  const cardStyle = isImage ? { ...styles.fileCard, backgroundImage: `url(${file.url})` } : styles.fileCard;
                  return (
                    <div key={file.id} style={cardStyle}>
                       {!isImage && <div style={styles.fileCardIcon}>{icon}</div>}
                        <div style={styles.fileCardOverlay}>
                           <span style={styles.fileName}>{file.name}</span>
                        </div>
                        <button style={styles.deleteButton} className="deleteButton" onClick={() => onDelete(file.id)}>
                           🗑️
                        </button>
                    </div>
                  );
                })}
            </div>
        </div>
    </div>
  );
};

const PostGeneratorScreen = ({ files, toneOfVoice, keywords, prefilledTopic, setPrefilledTopic }: { files: AppFile[], toneOfVoice: string, keywords: string, prefilledTopic: string, setPrefilledTopic: (topic: string) => void }) => {
    const [topic, setTopic] = useState('');
    const [selectedFile, setSelectedFile] = useState<AppFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    
    useEffect(() => {
        if (prefilledTopic) {
            setTopic(prefilledTopic);
            setPrefilledTopic(''); // Clear it after use
        }
    }, [prefilledTopic, setPrefilledTopic]);

    const handleFileSelect = (file: AppFile) => {
        setSelectedFile(prev => prev?.id === file.id ? null : file);
    }
    
    const urlToGenerativePart = async (url: string, mimeType: string) => {
        // As we are using external URLs (unsplash), we might face CORS issues.
        // A real implementation would use a server-side proxy to fetch the image.
        // For this demo, we assume direct fetching works. If not, this part will fail.
        try {
            const response = await fetch(url);
            if (!response.ok) { throw new Error(`Failed to fetch image from ${url}`); }
            const blob = await response.blob();
            const base64EncodedData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return {
                inlineData: { data: base64EncodedData, mimeType: mimeType, },
            };
        } catch (e) {
            console.error("CORS or network error fetching image:", e);
            alert("Не удалось загрузить изображение для анализа из-за ограничений браузера (CORS). Эта функция требует серверного прокси.");
            return null;
        }
    };

    const handleGenerate = async () => {
        if (!topic && !selectedFile) return;
        setIsLoading(true);
        setResult('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const tonePrompt = toneOfVoice ? `\n\nПридерживайся следующего тона голоса: "${toneOfVoice}"` : '';
            const keywordsPrompt = keywords ? `\n\nУчитывай следующие ключевые и стоп-слова: "${keywords}"` : '';

            const textPrompt = `Ты — профессиональный SMM-менеджер. Напиши яркий и вовлекающий пост для социальных сетей на русском языке.
                          \n\nТема: "${topic}"${tonePrompt}${keywordsPrompt}
                          \n\nЕсли предоставлено изображение, обязательно основывай текст поста на том, что изображено на картинке.
                          Твой пост должен быть структурированным, содержать призыв к действию и релевантные хэштеги.`;
            
            const parts: ({ text: string } | { inlineData: { data: string; mimeType: string; } })[] = [];
            
            if (selectedFile && getFileType(selectedFile.mimeType).isImage) {
              const imagePart = await urlToGenerativePart(selectedFile.url, selectedFile.mimeType);
              if (imagePart) parts.push(imagePart);
            }
            parts.push({ text: textPrompt });
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts },
            });
            
            setResult(response.text);

        } catch (error) {
            console.error("Ошибка при генерации поста:", error);
            setResult("К сожалению, произошла ошибка. Пожалуйста, попробуйте еще раз.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const canGenerate = topic || selectedFile;

    return (
        <div>
            <header style={styles.mainHeader}>
                <h1>Генератор постов</h1>
                <p>Опишите тему, выберите фото из Базы знаний, и AI создаст пост, анализируя изображение.</p>
            </header>
            <div style={styles.generatorLayout}>
                <div style={styles.generatorControls}>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="topic">1. Тема поста (необязательно, если выбрано фото)</label>
                        <input 
                            type="text" 
                            id="topic"
                            style={styles.input}
                            placeholder="Например: Анонс новой летней коллекции"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>2. Выберите файл (особенно фото)</label>
                        {files.length === 0 ? (
                            <p style={styles.noFilesText}>Сначала загрузите файлы в разделе "База знаний".</p>
                        ) : (
                            <div style={styles.fileSelectionGrid}>
                                {files.map(appFile => {
                                    const { icon, isImage } = getFileType(appFile.mimeType);
                                    const isSelected = selectedFile?.id === appFile.id;
                                    const cardStyle = isImage 
                                      ? { ...styles.fileSelectItem, backgroundImage: `url(${appFile.url})` } 
                                      : styles.fileSelectItem;
                                    const finalStyle = isSelected ? { ...cardStyle, ...styles.fileSelectItemActive } : cardStyle;

                                    return (
                                        <div 
                                            key={appFile.id} 
                                            style={finalStyle}
                                            onClick={() => handleFileSelect(appFile)}
                                        >
                                           {!isImage && <div style={styles.fileSelectIcon}>{icon}</div>}
                                            <div style={styles.fileSelectOverlay}>
                                                <div style={styles.fileSelectName}>{appFile.name}</div>
                                            </div>
                                            {isSelected && <div style={styles.fileSelectCheck}>✔</div>}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    <button 
                        style={canGenerate ? styles.button : styles.buttonDisabled}
                        disabled={!canGenerate || isLoading}
                        onClick={handleGenerate}
                    >
                        {isLoading ? 'Генерация...' : '✨ Сгенерировать'}
                    </button>
                </div>
                <div style={styles.generatorResult}>
                    <label style={styles.label}>3. Результат</label>
                    <div style={styles.resultBox}>
                        {isLoading && <div style={styles.loader}></div>}
                        {!isLoading && result === '' && <p style={styles.placeholderText}>Здесь появится сгенерированный текст...</p>}
                        {!isLoading && result && <p style={{whiteSpace: 'pre-wrap'}}>{result}</p>}
                    </div>
                </div>
            </div>
        </div>
    )
}

const ImageGeneratorScreen = ({ onUploadSuccess }: { onUploadSuccess: (file: AppFile) => void }) => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const handleGenerate = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setError('');
        setGeneratedImage(null);
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: {
                  numberOfImages: 1,
                  outputMimeType: 'image/png',
                  aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
                },
            });
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            setGeneratedImage(`data:image/png;base64,${base64ImageBytes}`);

        } catch (err) {
            console.error("Ошибка при генерации изображения:", err);
            setError("Не удалось сгенерировать изображение. Попробуйте изменить запрос.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSaveToKB = async () => {
        if (!generatedImage) return;
        setIsSaving(true);
        // Симуляция сохранения
        setTimeout(() => {
            const fileName = prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_') + '.png';
            const newFile: AppFile = {
                id: Date.now(), // Unique ID for mock
                name: fileName,
                url: generatedImage,
                mimeType: 'image/png'
            };
            onUploadSuccess(newFile);
            setIsSaving(false);
            alert('Изображение успешно сохранено в Базу знаний!');
        }, 1000);
    };

    return (
        <div>
            <header style={styles.mainHeader}>
                <h1>Генератор изображений</h1>
                <p>Опишите идею, и AI создаст для вас уникальное изображение.</p>
            </header>
            <div style={styles.generatorLayout}>
                <div style={styles.generatorControls}>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="img-prompt">1. Описание (промпт)</label>
                        <textarea
                            id="img-prompt"
                            style={styles.textarea}
                            rows={6}
                            placeholder="Например: Кот-космонавт в стиле стимпанк летит на ракете через кольца Сатурна, фотореализм"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>2. Соотношение сторон</label>
                        <div style={styles.aspectRatioSelector}>
                            {['1:1', '16:9', '9:16'].map(ratio => (
                                <button
                                    key={ratio}
                                    style={aspectRatio === ratio ? styles.aspectRatioButtonActive : styles.aspectRatioButton}
                                    onClick={() => setAspectRatio(ratio)}
                                >
                                    {ratio}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        style={prompt ? styles.button : styles.buttonDisabled}
                        disabled={!prompt || isLoading}
                        onClick={handleGenerate}
                    >
                        {isLoading ? 'Генерация...' : '✨ Сгенерировать'}
                    </button>
                </div>
                <div style={styles.generatorResult}>
                    <label style={styles.label}>3. Результат</label>
                    <div style={styles.imageResultBox}>
                        {isLoading && (
                            <div style={styles.loaderContainer}>
                                <div style={styles.loader}></div>
                                <p style={{marginTop: '16px', color: '#666'}}>AI рисует ваш шедевр...</p>
                            </div>
                        )}
                        {error && <p style={styles.errorText}>{error}</p>}
                        {!isLoading && !error && !generatedImage && <p style={styles.placeholderText}>Здесь появится сгенерированное изображение...</p>}
                        {generatedImage && (
                            <div style={styles.imageContainer}>
                                <img src={generatedImage} alt="Сгенерированное изображение" style={styles.generatedImage} />
                                <div style={styles.imageActions}>
                                    <button
                                      style={isSaving ? styles.buttonDisabled : styles.button}
                                      onClick={handleSaveToKB}
                                      disabled={isSaving}
                                    >
                                        {isSaving ? 'Сохранение...' : '💾 Сохранить в Базу знаний'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


const getPlatformSpecificPrompt = (platformName: string, topic: string, description: string, toneOfVoice: string, keywords: string): string => {
    const tonePrompt = toneOfVoice ? `\nТон голоса: "${toneOfVoice}".` : '';
    const keywordsPrompt = keywords ? `\nКлючевые слова/стоп-слова: "${keywords}".` : '';
    const basePrompt = `Тема поста: "${topic}". \nОписание: "${description}". ${tonePrompt}${keywordsPrompt}\nСгенерируй на русском языке текст поста для социальной сети ${platformName}.`;
    
    const specifics: Record<string, string> = {
        'Instagram': "Сделай акцент на визуальном описании. Используй релевантные эмодзи и популярные хэштеги. Абзацы должны быть короткими. Закончи пост вопросом для вовлечения аудитории.",
        'Telegram': "Напиши краткий, информативный пост. Используй markdown для форматирования (*жирный*, _курсив_). Будь лаконичен и по делу. Умеренное использование эмодзи приветствуется.",
        'ВКонтакте': "Напиши дружелюбный и неформальный пост. Можно использовать стикеры (в виде эмодзи). Структурируй текст, чтобы его было легко читать. Добавь пару релевантных хэштегов.",
        'Одноклассники': "Напиши пост в душевном, доверительном стиле. Используй восклицательные знаки, смайлики. Обратись к аудитории как к старым друзьям. Закончи пост призывом 'Ставьте КЛАСС!'.",
        'TikTok': "Напиши сценарий для короткого вирусного видео. Должен быть трендовый звук (укажи плейсхолдером [трек]), динамичная смена кадров и вовлекающая подпись с хэштегами.",
        'Pinterest': "Создай описание для пина. Оно должно быть кратким, вдохновляющим и содержать ключевые слова, по которым его могут найти. Сделай акцент на визуальной составляющей.",
        'YouTube': "Создай сценарий для короткого вертикального видео (Shorts). Включи привлекательное название и описание с ключевыми словами для поиска.",
        'Дзен': "Напиши полноценную статью. Придумай кликбейтный заголовок. Разбей текст на логические абзацы с подзаголовками (используя **markdown**). Статья должна быть подробной и экспертной.",
        'Rutube': "Придумай броское название для видео. Напиши подробное описание для видео, включив в него ключевые слова для поиска. В конце добавь список релевантных тегов (5-7 штук).",
        'default': "Напиши стандартный пост для социальных сетей, который будет информативным и интересным для широкой аудитории."
    };

    const instruction = specifics[platformName] || specifics['default'];
    return `${basePrompt}\n\nИнструкции: ${instruction}`;
};

const PostAdaptationModal = ({ item, onClose, toneOfVoice, keywords }: { item: any, onClose: () => void, toneOfVoice: string, keywords: string }) => {
    const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [generatedPosts, setGeneratedPosts] = useState<Record<string, string>>({});
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('');
    const [copySuccess, setCopySuccess] = useState('');

    const handleCheckboxChange = (platformId: string) => {
        setSelectedPlatforms(prev => ({ ...prev, [platformId]: !prev[platformId] }));
    };
    
    const handlePostChange = (platformId: string, newText: string) => {
        setGeneratedPosts(prev => ({ ...prev, [platformId]: newText }));
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopySuccess(activeTab);
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setError('');
        setGeneratedPosts({});
        setActiveTab('');
        
        const platformsToGenerate = Object.entries(selectedPlatforms)
            .filter(([, isSelected]) => isSelected)
            .map(([id]) => socialPlatforms.find(p => p.id === id));

        if (platformsToGenerate.length === 0) {
            setIsLoading(false);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const promises = platformsToGenerate.map(platform => {
                if (!platform) return Promise.resolve(null);
                const prompt = getPlatformSpecificPrompt(platform.name, item.topic, item.description, toneOfVoice, keywords);
                return ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ text: prompt }] })
                    .then(response => ({ id: platform.id, text: response.text }));
            });

            const results = await Promise.all(promises);
            const posts: Record<string, string> = {};
            results.forEach(result => {
                if (result) {
                    posts[result.id] = result.text;
                }
            });

            setGeneratedPosts(posts);
            setActiveTab(platformsToGenerate[0]?.id || '');
        } catch (err) {
            console.error("Ошибка при адаптации постов:", err);
            setError("Не удалось сгенерировать посты. Попробуйте снова.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const selectedCount = Object.values(selectedPlatforms).filter(Boolean).length;
    const generatedPlatformIds = Object.keys(generatedPosts);

    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <div style={styles.modalHeader}>
                    <h3>Адаптация поста: "{item.topic}"</h3>
                    <button style={styles.closeButton} onClick={onClose}>×</button>
                </div>
                <div style={styles.modalBody}>
                    <div style={styles.adaptationControls}>
                        <p style={styles.label}>1. Выберите соцсети для генерации</p>
                        <div style={styles.platformGrid}>
                            {socialPlatforms.map(platform => (
                                <label key={platform.id} style={selectedPlatforms[platform.id] ? styles.platformSelectItemActive : styles.platformSelectItem}>
                                    <input type="checkbox" style={styles.checkbox} onChange={() => handleCheckboxChange(platform.id)} checked={!!selectedPlatforms[platform.id]} />
                                    <img src={platform.icon} alt={platform.name} style={styles.platformSelectIconImg} />
                                    <span>{platform.name}</span>
                                </label>
                            ))}
                        </div>
                        <button style={selectedCount > 0 ? styles.button : styles.buttonDisabled} disabled={selectedCount === 0 || isLoading} onClick={handleGenerate}>
                            {isLoading ? 'Генерация...' : `✨ Сгенерировать посты (${selectedCount})`}
                        </button>
                    </div>
                    <div style={styles.adaptationResult}>
                        <p style={styles.label}>2. Результат</p>
                        <div style={styles.resultBox}>
                           {isLoading && <div style={styles.loader}></div>}
                           {error && <p style={styles.errorText}>{error}</p>}
                           {!isLoading && !error && generatedPlatformIds.length === 0 && <p style={styles.placeholderText}>Здесь появятся адаптированные посты...</p>}
                           {generatedPlatformIds.length > 0 && (
                               <div>
                                   <div style={styles.tabsContainer}>
                                       {generatedPlatformIds.map(id => {
                                           const platform = socialPlatforms.find(p => p.id === id);
                                           return (
                                               <button key={id} onClick={() => setActiveTab(id)} style={activeTab === id ? styles.tabItemActive : styles.tabItem}>
                                                   {platform?.name}
                                               </button>
                                           )
                                       })}
                                   </div>
                                   <div style={styles.tabContent}>
                                       <textarea
                                          style={styles.editableTextarea}
                                          value={generatedPosts[activeTab]}
                                          onChange={(e) => handlePostChange(activeTab, e.target.value)}
                                        />
                                        <button 
                                            style={styles.copyButton}
                                            className="copyButton"
                                            onClick={() => handleCopy(generatedPosts[activeTab])}>
                                            {copySuccess === activeTab ? '✅ Скопировано!' : '📄 Копировать'}
                                        </button>
                                   </div>
                               </div>
                           )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PublishModal = ({ item, onClose, onPublishSuccess, toneOfVoice, keywords, connectedAccounts }: { item: any, onClose: () => void, onPublishSuccess: (id: number) => void, toneOfVoice: string, keywords: string, connectedAccounts: Record<string, boolean> }) => {
    const connectedPlatformIds = useMemo(() => Object.entries(connectedAccounts).filter(([, isConnected]) => isConnected).map(([id]) => id), [connectedAccounts]);
    const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, boolean>>(() => {
        const initialSelection: Record<string, boolean> = {};
        connectedPlatformIds.forEach(id => { initialSelection[id] = true });
        return initialSelection;
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isPublishing, setIsPublishing] = useState(false);
    const [generatedPosts, setGeneratedPosts] = useState<Record<string, string>>({});
    const [publishStatus, setPublishStatus] = useState<Record<string, 'pending' | 'success' | 'error'>>({});
    
    useEffect(() => {
        const generateInitialPosts = async () => {
            setIsLoading(true);
            const platformsToGenerate = socialPlatforms.filter(p => connectedPlatformIds.includes(p.id));
            if (platformsToGenerate.length === 0) {
                setIsLoading(false);
                return;
            }

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const promises = platformsToGenerate.map(platform => {
                    const prompt = getPlatformSpecificPrompt(platform.name, item.topic, item.description, toneOfVoice, keywords);
                    return ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ text: prompt }] })
                        .then(response => ({ id: platform.id, text: response.text }));
                });
                const results = await Promise.all(promises);
                const posts: Record<string, string> = {};
                results.forEach(result => { if (result) { posts[result.id] = result.text; } });
                setGeneratedPosts(posts);
            } catch (err) {
                console.error("Error generating initial posts for publishing:", err);
            } finally {
                setIsLoading(false);
            }
        };
        generateInitialPosts();
    }, [item, toneOfVoice, keywords, connectedPlatformIds]);

    const handleCheckboxChange = (platformId: string) => {
        setSelectedPlatforms(prev => ({ ...prev, [platformId]: !prev[platformId] }));
    };

    const handlePostChange = (platformId: string, newText: string) => {
        setGeneratedPosts(prev => ({ ...prev, [platformId]: newText }));
    };
    
    const handlePublish = async () => {
        setIsPublishing(true);
        setPublishStatus({});
        const platformsToPublish = Object.entries(selectedPlatforms).filter(([,isSelected])=>isSelected).map(([id])=>id);

        for (const platformId of platformsToPublish) {
            try {
                // Имитация отправки запроса на публикацию
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
                setPublishStatus(prev => ({ ...prev, [platformId]: 'success' }));
            } catch (e) {
                setPublishStatus(prev => ({ ...prev, [platformId]: 'error' }));
            }
        }
        setIsPublishing(false);
        onPublishSuccess(item.id);
    };
    
    const allPublished = Object.keys(publishStatus).length > 0 && Object.values(publishStatus).every(s => s === 'success');

    return (
        <div style={styles.modalOverlay}>
            <div style={{...styles.modalContent, maxWidth: '600px'}}>
                <div style={styles.modalHeader}>
                    <h3>Публикация поста: "{item.topic}"</h3>
                    <button style={styles.closeButton} onClick={onClose}>×</button>
                </div>
                <div style={styles.modalBodySingleColumn}>
                    <p style={styles.label}>1. Выберите, куда опубликовать</p>
                    <div style={styles.publishPlatformList}>
                        {isLoading && <div style={styles.loader}></div>}
                        {!isLoading && connectedPlatformIds.length === 0 && <p style={styles.placeholderText}>Нет подключенных аккаунтов. Зайдите в Настройки.</p>}
                        {!isLoading && connectedPlatformIds.map(id => {
                            const platform = socialPlatforms.find(p => p.id === id);
                            if (!platform) return null;
                            const status = publishStatus[id];
                            return (
                                <div key={id} style={styles.publishPlatformRow}>
                                    <label style={styles.platformSelectItem}>
                                        <input type="checkbox" style={styles.checkbox} checked={!!selectedPlatforms[id]} onChange={() => handleCheckboxChange(id)} disabled={isPublishing || allPublished} />
                                        <img src={platform.icon} alt={platform.name} style={styles.platformSelectIconImg} />
                                        <span>{platform.name}</span>
                                    </label>
                                    {status && (
                                        <span style={status === 'success' ? styles.statusSuccess : styles.statusError}>
                                            {status === 'success' ? '✅ Опубликовано' : '❌ Ошибка'}
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    {Object.entries(selectedPlatforms).map(([id, isSelected]) => {
                        if (!isSelected || !generatedPosts[id]) return null;
                        const platform = socialPlatforms.find(p => p.id === id);
                        return (
                            <div key={id} style={{...styles.formGroup, marginTop: '16px'}}>
                                <label style={styles.label}>Текст для {platform?.name}</label>
                                <textarea 
                                    style={styles.editableTextarea}
                                    value={generatedPosts[id]}
                                    onChange={(e) => handlePostChange(id, e.target.value)}
                                    rows={8}
                                    disabled={isPublishing || allPublished}
                                />
                            </div>
                        )
                    })}
                </div>
                <div style={styles.modalFooter}>
                    {allPublished ? (
                        <button style={styles.button} onClick={onClose}>Закрыть</button>
                    ) : (
                        <button style={(isPublishing || Object.values(selectedPlatforms).filter(Boolean).length === 0) ? styles.buttonDisabled : styles.button} onClick={handlePublish} disabled={isPublishing || Object.values(selectedPlatforms).filter(Boolean).length === 0}>
                            {isPublishing ? 'Публикация...' : '🚀 Опубликовать сейчас'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}


const ContentPlanScreen = ({ toneOfVoice, keywords, connectedAccounts }: { toneOfVoice: string, keywords: string, connectedAccounts: Record<string, boolean> }) => {
    const [goal, setGoal] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPlanLoading, setIsPlanLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedPlanItem, setSelectedPlanItem] = useState<any | null>(null);
    const [publishingItem, setPublishingItem] = useState<any | null>(null);
    const [viewDate, setViewDate] = useState(new Date(2025, 10, 1)); // November 2025
    const [hoveredPostId, setHoveredPostId] = useState<number | null>(null);

    const [unscheduledPosts, setUnscheduledPosts] = useState<any[]>([]);
    const [scheduledPosts, setScheduledPosts] = useState<Record<string, any[]>>({});
    
    const fetchContentPlan = useCallback(async () => {
        setIsPlanLoading(true);
        setError('');
        // Симуляция загрузки данных
        setTimeout(() => {
            const initialScheduled: Record<string, any[]> = {};
            const initialUnscheduled = [...MOCK_UNSCHEDULED_POSTS];
            const initialPublishedIds = new Set<number>();
            
            Object.entries(MOCK_SCHEDULED_POSTS).forEach(([date, posts]) => {
                initialScheduled[date] = posts;
                posts.forEach(p => {
                    if (p.isPublished) initialPublishedIds.add(p.id);
                });
            });

            setScheduledPosts(initialScheduled);
            setUnscheduledPosts(initialUnscheduled);
            setIsPlanLoading(false);
        }, 1000);
    }, []);

    useEffect(() => {
        fetchContentPlan();
    }, [fetchContentPlan]);


    const handleGeneratePlan = async () => {
        if (!goal) return;
        setIsGenerating(true);
        setError('');
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    plan: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                topic: { type: Type.STRING, description: 'Тема поста' },
                                postType: { type: Type.STRING, description: 'Тип контента (напр. Пост с фото, Видео Reels, Статья)' },
                                description: { type: Type.STRING, description: 'Краткое описание содержания поста' },
                            },
                            required: ['topic', 'postType', 'description']
                        }
                    }
                },
                required: ['plan']
            };
            
            const prompt = `Выступи в роли эксперта SMM-стратега. Создай контент-план на русском языке.
            Главная цель: "${goal}".
            План должен включать разнообразные типы постов для вовлечения аудитории.
            Придумай 5-7 идей.
            Предоставь ответ в виде JSON объекта, соответствующего предоставленной схеме.`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ text: prompt }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });

            let jsonString = response.text.trim();
             if (jsonString.startsWith('```json')) {
                jsonString = jsonString.substring(7, jsonString.length - 3).trim();
            } else if (jsonString.startsWith('```')) {
                jsonString = jsonString.substring(3, jsonString.length - 3).trim();
            }
            
            const resultObject = JSON.parse(jsonString);

            if (resultObject.plan) {
                // Симуляция сохранения: добавляем в локальное состояние
                const newIdeas = resultObject.plan.map((idea: any) => ({
                    ...idea,
                    id: Date.now() + Math.random(), // Unique ID for mock
                }));
                setUnscheduledPosts(prev => [...prev, ...newIdeas]);
            } else {
                setError("AI сгенерировал ответ в неправильном формате. Попробуйте снова.");
            }
        } catch (err: any) {
            console.error("Ошибка при генерации контент-плана:", err);
            setError("Не удалось сгенерировать план. Попробуйте изменить запрос или повторите попытку позже.");
        } finally {
            setIsGenerating(false);
        }
    };

    const changeMonth = (offset: number) => {
        setViewDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, post: any, origin: 'unscheduled' | 'scheduled', date?: string) => {
        const payload = { ...post, origin, originDate: date };
        e.dataTransfer.setData("post", JSON.stringify(payload));
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };
    
    const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetDate: string) => {
        e.preventDefault();
        const postPayload = JSON.parse(e.dataTransfer.getData("post"));
        const { id, origin, originDate } = postPayload;
        
        // Оптимистичное обновление UI
        const post = { ...postPayload };
        delete post.origin;
        delete post.originDate;

        if (origin === 'unscheduled') {
            setUnscheduledPosts(prev => prev.filter(p => p.id !== id));
        } else if (origin === 'scheduled' && originDate) {
            setScheduledPosts(prev => {
                const newScheduled = {...prev};
                newScheduled[originDate] = newScheduled[originDate]?.filter(p => p.id !== id);
                if (newScheduled[originDate]?.length === 0) {
                    delete newScheduled[originDate];
                }
                return newScheduled;
            });
        }
        
        setScheduledPosts(prev => {
            const newScheduled = {...prev};
            if (!newScheduled[targetDate]) {
                newScheduled[targetDate] = [];
            }
            // Add to the end of the list for the target date
            newScheduled[targetDate] = [...newScheduled[targetDate], post];
            return newScheduled;
        });

        // Запрос к API (закомментирован, т.к. работаем с моками)
        /*
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/content-plan/schedule`, {
                method: 'PUT',
                body: JSON.stringify({ postId: id, date: targetDate }),
            });
            if (!response.ok) throw new Error("Не удалось обновить пост.");
        } catch (err) {
            console.error("Ошибка при планировании поста:", err);
            fetchContentPlan(); 
            alert('Не удалось переместить пост. Данные будут обновлены.');
        }
        */
    };
    
    const handlePublishSuccess = (postId: number) => {
        setScheduledPosts(prev => {
            const newScheduled = {...prev};
            for (const date in newScheduled) {
                newScheduled[date] = newScheduled[date].map(post => 
                    post.id === postId ? { ...post, isPublished: true } : post
                );
            }
            return newScheduled;
        });
        setPublishingItem(null);
    }

    const renderCalendar = () => {
        const month = viewDate.getMonth();
        const year = viewDate.getFullYear();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const dayOfWeekOffset = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;

        const cells = [];
        // empty cells for placeholder days
        for (let i = 0; i < dayOfWeekOffset; i++) {
            cells.push(<div key={`empty-${i}`} style={{...styles.calendarCell, ...styles.calendarCellEmpty}}></div>);
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const postsForDay = scheduledPosts[dateStr] || [];
            
            cells.push(
                <div key={day} style={styles.calendarCell} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, dateStr)}>
                    <div style={styles.calendarDayHeader}>{day}</div>
                    <div style={styles.calendarCellContent}>
                    {postsForDay.map((post) => {
                        const postItemStyle = post.isPublished ? {...styles.scheduledPostItem, ...styles.scheduledPostItemPublished} : styles.scheduledPostItem;
                        return (
                            <div 
                               key={post.id} 
                               style={postItemStyle}
                               className="scheduledPostItem" 
                               draggable={!post.isPublished}
                               onDragStart={(e) => !post.isPublished && handleDragStart(e, post, 'scheduled', dateStr)}
                               onMouseEnter={() => setHoveredPostId(post.id)}
                               onMouseLeave={() => setHoveredPostId(null)}
                            >
                                <span style={{...styles.planCardType, fontSize: '10px'}}>{post.postType}</span>
                                <p style={styles.scheduledPostTopic} onClick={() => setSelectedPlanItem(post)}>{post.isPublished && '✅ '}{post.topic}</p>
                                {!post.isPublished && (
                                    <button 
                                      style={{
                                        display: hoveredPostId === post.id ? 'block' : 'none',
                                        position: 'absolute',
                                        top: '50%',
                                        right: '4px',
                                        transform: 'translateY(-50%)',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                      }}
                                      className="publishButton" 
                                      onClick={() => setPublishingItem(post)}
                                    >
                                        🚀
                                    </button>
                                )}
                            </div>
                        )
                    })}
                    </div>
                </div>
            );
        }

        return cells;
    };

    const canGenerate = goal && !isGenerating;

    return (
        <div>
            <header style={styles.mainHeader}>
                <h1>Контент-план</h1>
                <p>Задайте главную цель, а AI предложит идеи. Затем перетащите их на календарь, чтобы спланировать публикации.</p>
            </header>
            <div style={styles.contentPlanLayout}>
                <div style={styles.contentPlanControls}>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="goal">1. Главная цель на месяц</label>
                        <textarea
                            id="goal"
                            style={styles.textarea}
                            rows={5}
                            placeholder="Например: Прогрев аудитории перед запуском нового продукта..."
                            value={goal}
                            onChange={e => setGoal(e.target.value)}
                        />
                    </div>
                    <button
                        style={canGenerate ? styles.button : styles.buttonDisabled}
                        disabled={!canGenerate}
                        onClick={handleGeneratePlan}
                    >
                        {isGenerating ? 'Создание идей...' : '💡 Сгенерировать идеи'}
                    </button>
                    <div style={styles.unscheduledPostsContainer}>
                        <label style={styles.label}>2. Нераспределенные посты</label>
                        <div style={styles.unscheduledPostsList}>
                           {isPlanLoading && <div style={styles.loader}></div>}
                           {isGenerating && <p style={styles.placeholderText}>AI генерирует идеи...</p>}
                           {error && !isPlanLoading && <p style={styles.errorText}>{error}</p>}
                           {!isPlanLoading && !error && unscheduledPosts.length === 0 && !isGenerating && <p style={styles.placeholderText}>Сгенерированные идеи появятся здесь...</p>}
                           {unscheduledPosts.map((item) => (
                               <div 
                                 key={item.id} 
                                 style={styles.planCardClickable} 
                                 className="planCardClickable"
                                 draggable 
                                 onDragStart={(e) => handleDragStart(e, item, 'unscheduled')}
                                 onClick={() => setSelectedPlanItem(item)}
                               >
                                   <div style={styles.planCardHeader}>
                                       <span style={styles.planCardType}>{item.postType}</span>
                                   </div>
                                   <h4 style={styles.planCardTopic}>{item.topic}</h4>
                                   <p style={styles.planCardDescription}>{item.description}</p>
                               </div>
                           ))}
                        </div>
                    </div>
                </div>
                <div style={styles.contentPlanResult}>
                    <div style={styles.calendarHeader}>
                        <button style={styles.calendarNavButton} className="calendarNavButton" onClick={() => changeMonth(-1)}>‹</button>
                        <h3 style={styles.calendarMonthLabel}>
                            {viewDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '')}
                        </h3>
                        <button style={styles.calendarNavButton} className="calendarNavButton" onClick={() => changeMonth(1)}>›</button>
                    </div>
                     <div style={styles.calendarWeekdays}>
                        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <div key={day}>{day}</div>)}
                    </div>
                    <div style={styles.calendarGrid}>
                        {isPlanLoading ? <div style={{ ...styles.loader, gridColumn: '1 / -1' }}></div> : renderCalendar()}
                    </div>
                </div>
            </div>
            {selectedPlanItem && <PostAdaptationModal item={selectedPlanItem} onClose={() => setSelectedPlanItem(null)} toneOfVoice={toneOfVoice} keywords={keywords} />}
            {publishingItem && <PublishModal item={publishingItem} onClose={() => setPublishingItem(null)} onPublishSuccess={handlePublishSuccess} toneOfVoice={toneOfVoice} keywords={keywords} connectedAccounts={connectedAccounts}/>}
        </div>
    );
};

interface TeamMember {
    id: number;
    email: string;
    role: 'Владелец' | 'SMM-менеджер' | 'Гость';
}

const SettingsScreen = ({ toneOfVoice, setToneOfVoice, keywords, setKeywords, connectedAccounts, setConnectedAccounts }: {
    toneOfVoice: string;
    setToneOfVoice: (value: string) => void;
    keywords: string;
    setKeywords: (value: string) => void;
    connectedAccounts: Record<string, boolean>;
    setConnectedAccounts: (accounts: Record<string, boolean>) => void;
}) => {
    const [localTone, setLocalTone] = useState(toneOfVoice);
    const [localKeywords, setLocalKeywords] = useState(keywords);
    const [saved, setSaved] = useState(false);
    
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [isTeamLoading, setIsTeamLoading] = useState(true);
    const [teamError, setTeamError] = useState('');
    
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'SMM-менеджер' | 'Гость'>('SMM-менеджер');
    const [isInviting, setIsInviting] = useState(false);
    const [inviteMessage, setInviteMessage] = useState({ type: '', text: '' });

    const toggleConnection = (platformId: string) => {
        const newAccounts = {
            ...connectedAccounts,
            [platformId]: !connectedAccounts[platformId]
        };
        setConnectedAccounts(newAccounts);
    };


    useEffect(() => {
        const fetchTeam = async () => {
            setIsTeamLoading(true);
            setTeamError('');
            // Симуляция загрузки
            setTimeout(() => {
                setTeam(MOCK_TEAM);
                setIsTeamLoading(false);
            }, 1000);
        };
        fetchTeam();
    }, []);

    const handleSaveSettings = () => {
        setToneOfVoice(localTone);
        setKeywords(localKeywords);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };
    
    const handleInvite = async () => {
        if (!inviteEmail || isInviting) return;
        
        setIsInviting(true);
        setInviteMessage({ type: '', text: '' });
        
        // Симуляция приглашения
        setTimeout(() => {
             if (team.some(m => m.email === inviteEmail)) {
                setInviteMessage({ type: 'error', text: 'Пользователь с таким email уже в команде.' });
             } else {
                const newUser: TeamMember = {
                    id: Date.now(),
                    email: inviteEmail,
                    role: inviteRole,
                };
                setTeam(prev => [...prev, newUser]);
                setInviteMessage({ type: 'success', text: 'Приглашение успешно отправлено!' });
                setInviteEmail('');
            }
            setIsInviting(false);
            setTimeout(() => setInviteMessage({ type: '', text: '' }), 3000);
        }, 1500);
    };
    
    const handleRemove = async (id: number) => {
        if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
        setTeam(prev => prev.filter(m => m.id !== id));
    };

    const roleIcons: Record<string, string> = {
        'Владелец': '👑',
        'SMM-менеджер': '✍️',
        'Гость': '👀',
    };
    
    const permissionsDescription: Record<string, { allowed: string[], denied: string[] }> = {
        'SMM-менеджер': {
            allowed: [
                'Создание и редактирование контент-планов',
                'Генерация и адаптация постов',
                'Работа с Базой знаний',
                'Просмотр Аналитики'
            ],
            denied: [
                'Изменение настроек бренда (Tone of Voice)',
                'Управление командой'
            ]
        },
        'Гость': {
            allowed: [
                'Просмотр Контент-плана',
                'Просмотр Аналитики'
            ],
            denied: [
                'Любые изменения в проекте',
                'Просмотр Базы знаний и Настроек'
            ]
        }
    };

    return (
        <div>
            <header style={styles.mainHeader}>
                <h1>Настройки и Команда</h1>
                <p>Настройте личность AI, а также управляйте доступом для вашей команды.</p>
            </header>
            <div style={styles.settingsLayout}>
                <div style={styles.settingsColumn}>
                    <div style={styles.settingsSection}>
                        <h3 style={styles.settingsSectionTitle}>Голос бренда</h3>
                        <div style={styles.formGroup}>
                            <label style={styles.label} htmlFor="tone-of-voice">Тон голоса (Tone of Voice)</label>
                            <p style={styles.settingsDescription}>Опишите стиль общения, который должен использовать AI. Например: "Дружелюбный и остроумный, используй эмодзи, обращайся на 'ты'".</p>
                            <textarea
                                id="tone-of-voice"
                                style={styles.textarea}
                                rows={4}
                                placeholder="Опишите желаемый тон голоса..."
                                value={localTone}
                                onChange={(e) => setLocalTone(e.target.value)}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label} htmlFor="keywords">Ключевые слова и стоп-слова</label>
                            <p style={styles.settingsDescription}>Укажите слова, которые AI должен всегда использовать (например, название компании) или избегать (например, "дешевый").</p>
                            <textarea
                                id="keywords"
                                style={styles.textarea}
                                rows={4}
                                placeholder="Например: Всегда упоминай 'SMM AI'. Никогда не используй слово 'дешевый'."
                                value={localKeywords}
                                onChange={(e) => setLocalKeywords(e.target.value)}
                            />
                        </div>
                        <button
                            style={saved ? styles.buttonSaved : styles.button}
                            onClick={handleSaveSettings}
                        >
                            {saved ? '✅ Сохранено!' : '💾 Сохранить настройки'}
                        </button>
                    </div>
                     <div style={styles.settingsSection}>
                        <h3 style={styles.settingsSectionTitle}>🔗 Интеграции с соцсетями</h3>
                        <p style={styles.settingsDescription}>Подключите ваши аккаунты, чтобы в будущем включить автоматический постинг и аналитику комментариев.</p>
                         <div style={styles.integrationsList}>
                            {socialPlatforms.map(platform => (
                                <div key={platform.id} style={styles.integrationRow}>
                                    <div style={styles.integrationInfo}>
                                        <img src={platform.icon} alt={platform.name} style={styles.platformSelectIconImg} />
                                        <span style={styles.teamMemberEmail}>{platform.name}</span>
                                    </div>
                                    {connectedAccounts[platform.id] ? (
                                        <div style={styles.integrationActions}>
                                            <span style={styles.connectedStatus}>✅ Подключено</span>
                                            <button style={styles.disconnectButton} className="disconnectButton" onClick={() => toggleConnection(platform.id)}>Отключить</button>
                                        </div>
                                    ) : (
                                        <button style={styles.connectButton} className="connectButton" onClick={() => toggleConnection(platform.id)}>Подключить</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div style={styles.settingsColumn}>
                    <div style={styles.settingsSection}>
                        <h3 style={styles.settingsSectionTitle}>Управление командой</h3>
                        <div style={styles.teamInviteContainer}>
                            <div style={styles.teamInviteForm}>
                                <input
                                  type="email"
                                  style={{...styles.input, flex: 1}}
                                  placeholder="Email нового участника"
                                  value={inviteEmail}
                                  onChange={e => setInviteEmail(e.target.value)}
                                  disabled={isInviting}
                                />
                                <select style={styles.select} value={inviteRole} onChange={e => setInviteRole(e.target.value as 'SMM-менеджер' | 'Гость')} disabled={isInviting}>
                                    <option>SMM-менеджер</option>
                                    <option>Гость</option>
                                </select>
                                <button style={isInviting ? styles.buttonDisabled : styles.inviteButton} className="inviteButton" onClick={handleInvite} disabled={isInviting}>
                                    {isInviting ? 'Отправка...' : 'Пригласить'}
                                </button>
                            </div>
                            {inviteMessage.text && (
                                <p style={inviteMessage.type === 'success' ? styles.authMessageSuccess : styles.authMessageError}>
                                    {inviteMessage.text}
                                </p>
                            )}
                            <div style={styles.permissionsInfoBox}>
                                <h4>Права для роли "{inviteRole}":</h4>
                                <ul style={styles.permissionsList}>
                                    {permissionsDescription[inviteRole]?.allowed.map(text => (
                                        <li key={text} style={{...styles.permissionItem, ...styles.permissionAllowed}}>✅ {text}</li>
                                    ))}
                                    {permissionsDescription[inviteRole]?.denied.map(text => (
                                        <li key={text} style={{...styles.permissionItem, ...styles.permissionDenied}}>❌ {text}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div style={styles.teamList}>
                            {isTeamLoading && <div style={{...styles.loader, position: 'relative', margin: '20px auto'}}></div>}
                            {teamError && <p style={styles.errorText}>{teamError}</p>}
                            {!isTeamLoading && !teamError && team.map(member => (
                                <div key={member.id} style={styles.teamMemberRow}>
                                    <div style={styles.teamMemberInfo}>
                                        <span style={styles.teamMemberRoleIcon}>{roleIcons[member.role] || '👤'}</span>
                                        <span style={styles.teamMemberEmail}>{member.email}</span>
                                    </div>
                                    <div style={styles.teamMemberRole}>{member.role}</div>
                                    {member.role !== 'Владелец' && (
                                      <button style={styles.teamRemoveButton} className="teamRemoveButton" onClick={() => handleRemove(member.id)}>Удалить</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AnalyticsScreen = ({ onSelectIdea }: { onSelectIdea: (topic: string) => void }) => {
    const [topic, setTopic] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<{ text: string; sources: any[] } | null>(null);

    const handleAnalyze = async () => {
        if (!topic) return;
        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Ты — ведущий SMM-стратег. Проанализируй актуальные тренды по теме "${topic}", используя свежие данные из интернета.
Предоставь ответ на русском языке в формате Markdown.
Сначала выдели 2-3 ключевых тренда.
Затем предложи 3-5 конкретных и креативных идей для постов, основанных на этих трендах. Для каждой идеи четко укажи название и рекомендуемый формат в формате: "* **Название идеи** (Формат: Reels)".`;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ text: prompt }],
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });

            const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            setResult({ text: response.text, sources: sources.filter(s => s.web) });

        } catch (err) {
            console.error("Ошибка при анализе трендов:", err);
            setError("Не удалось выполнить анализ. Пожалуйста, попробуйте изменить запрос или повторите попытку позже.");
        } finally {
            setIsLoading(false);
        }
    };

    const parseAndRenderText = (text: string) => {
        const lines = text.split('\n');
        const ideas: { title: string; fullLine: string }[] = [];
        let otherContent = '';

        const ideaRegex = /^\s*[\*\-]\s*\*\*(.*?)\*\*/;

        // Separate ideas from the rest of the text
        const otherLines = lines.filter(line => {
            const match = line.match(ideaRegex);
            if (match && match[1]) {
                ideas.push({ title: match[1].trim(), fullLine: line });
                return false; // Don't include idea lines in otherContent
            }
            return true;
        });
        otherContent = otherLines.join('\n');

        // Simple markdown to HTML renderer
        const renderMarkdown = (md: string) => {
            let html = md
                .replace(/^##\s*(.*)/gm, '<h3>$1</h3>')
                .replace(/^#\s*(.*)/gm, '<h2>$1</h2>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>');

            // Process lists correctly
            const listRegex = /((?:^\s*[\*\-]\s+.*\n?)+)/gm;
            html = html.replace(listRegex, (match) => {
                const items = match.trim().split('\n').map(item => `<li>${item.replace(/^\s*[\*\-]\s+/, '')}</li>`).join('');
                return `<ul>${items}</ul>`;
            });

            // Handle newlines, but be careful not to add <br> inside list structures
            return html.replace(/\n/g, '<br />').replace(/<br \/>(\s*<ul>)/g, '$1').replace(/(<\/ul>)<br \/>/g, '$1');
        }


        return (
            <div>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(otherContent) }} />
                {ideas.length > 0 && <h3 style={{marginTop: '20px'}}>Идеи для постов</h3>}
                <div style={styles.ideasGrid}>
                    {ideas.map((idea, index) => (
                        <div key={index} style={styles.ideaCard}>
                             <p dangerouslySetInnerHTML={{ __html: 
                                idea.fullLine
                                    .replace(/^\s*[\*\-]\s*/, '') // remove list marker
                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                             }} />
                            <button style={styles.createPostButton} className="createPostButton" onClick={() => onSelectIdea(idea.title)}>
                                ✨ Создать пост
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div>
            <header style={styles.mainHeader}>
                <h1>AI-Аналитика</h1>
                <p>Введите тему, чтобы проанализировать тренды и получить свежие идеи для контента.</p>
            </header>
            <div style={styles.analyticsLayout}>
                <div style={styles.formGroup}>
                    <label htmlFor="analytics-topic" style={styles.label}>Тема для анализа</label>
                    <input
                        id="analytics-topic"
                        type="text"
                        style={styles.input}
                        placeholder="Например: Эко-косметика в 2025"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                    />
                </div>
                <button
                    style={topic ? styles.button : styles.buttonDisabled}
                    disabled={!topic || isLoading}
                    onClick={handleAnalyze}
                >
                    {isLoading ? 'Анализ...' : '📈 Проанализировать тренды'}
                </button>
            </div>

            <div style={styles.analyticsResultBox}>
                {isLoading && <div style={styles.loader}></div>}
                {error && <p style={styles.errorText}>{error}</p>}
                {!isLoading && !result && !error && <p style={styles.placeholderText}>Здесь появятся результаты анализа...</p>}
                {result && (
                    <div>
                        {parseAndRenderText(result.text)}
                        {result.sources.length > 0 && (
                            <>
                                <h3 style={{ marginTop: '30px' }}>Источники</h3>
                                <ul style={styles.sourcesList}>
                                    {result.sources.map((source, index) => (
                                        <li key={index}>
                                            <a href={source.web.uri} target="_blank" rel="noopener noreferrer">
                                                {source.web.title || source.web.uri}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


const DashboardScreen = ({ onLogout }: { onLogout: () => void }) => {
  const [activeMenu, setActiveMenu] = useState('content-plan');
  const [files, setFiles] = useState<AppFile[]>([]);
  const [isFilesLoading, setIsFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState('');
  
  // Загружаем значения из localStorage при инициализации.
  const [toneOfVoice, setToneOfVoice] = useState(() => localStorage.getItem('smm_ai_tone') || '');
  const [keywords, setKeywords] = useState(() => localStorage.getItem('smm_ai_keywords') || '');
  const [prefilledTopic, setPrefilledTopic] = useState('');
  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('smm_ai_connected_accounts');
        return saved ? JSON.parse(saved) : {};
    });
  
  // Сохраняем значения в localStorage при их изменении.
  useEffect(() => {
    localStorage.setItem('smm_ai_tone', toneOfVoice);
  }, [toneOfVoice]);

  useEffect(() => {
    localStorage.setItem('smm_ai_keywords', keywords);
  }, [keywords]);

  useEffect(() => {
    localStorage.setItem('smm_ai_connected_accounts', JSON.stringify(connectedAccounts));
  }, [connectedAccounts]);


  const fetchFiles = useCallback(async () => {
    setIsFilesLoading(true);
    setFilesError('');
    // Симуляция загрузки
    setTimeout(() => {
        setFiles(MOCK_FILES);
        setIsFilesLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (newFiles: File[]) => {
    // Симуляция загрузки
    newFiles.forEach(file => {
        const newFile: AppFile = {
            id: Date.now() + Math.random(),
            name: file.name,
            url: URL.createObjectURL(file), // Create a temporary local URL
            mimeType: file.type
        };
        setFiles(prev => [...prev, newFile]);
    });
    alert(`${newFiles.length} файл(ов) успешно загружено!`);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот файл?')) return;
    setFiles(prev => prev.filter(file => file.id !== id));
  };
  
  const handleGeneratedImageSave = (newFile: AppFile) => {
      setFiles(prev => [newFile, ...prev]);
  };

  const menuItems = [
    {id: 'content-plan', name: 'Контент-план', icon: '🗓️'},
    {id: 'knowledge-base', name: 'База знаний', icon: '📚'},
    {id: 'post-generator', name: 'Генератор постов', icon: '✨'},
    {id: 'image-generator', name: 'Генератор изображений', icon: '🎨'},
    {id: 'analytics', name: 'Аналитика', icon: '📊'},
    {id: 'settings', name: 'Настройки', icon: '⚙️'},
  ];
  
  const handleSelectIdea = (topic: string) => {
    setPrefilledTopic(topic);
    setActiveMenu('post-generator');
  };

  const renderContent = () => {
    switch(activeMenu) {
      case 'content-plan':
        return <ContentPlanScreen toneOfVoice={toneOfVoice} keywords={keywords} connectedAccounts={connectedAccounts} />;
      case 'knowledge-base':
        return <KnowledgeBaseScreen files={files} isLoading={isFilesLoading} onUpload={handleUpload} onDelete={handleDelete} />;
      case 'post-generator':
        return <PostGeneratorScreen files={files} toneOfVoice={toneOfVoice} keywords={keywords} prefilledTopic={prefilledTopic} setPrefilledTopic={setPrefilledTopic} />;
      case 'image-generator':
        return <ImageGeneratorScreen onUploadSuccess={handleGeneratedImageSave} />;
      case 'analytics':
        return <AnalyticsScreen onSelectIdea={handleSelectIdea} />;
      case 'settings':
        return <SettingsScreen 
                  toneOfVoice={toneOfVoice} setToneOfVoice={setToneOfVoice}
                  keywords={keywords} setKeywords={setKeywords}
                  connectedAccounts={connectedAccounts} setConnectedAccounts={setConnectedAccounts} 
                />;
      default:
        return (
          <header style={styles.mainHeader}>
              <h1>{menuItems.find(i => i.id === activeMenu)?.name}</h1>
              <p>Этот раздел находится в разработке.</p>
          </header>
        );
    }
  }

  return (
    <div style={styles.dashboardContainer}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>SMM AI</h2>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <ul>
            {menuItems.map(item => (
              <li key={item.id} 
                  style={activeMenu === item.id ? styles.menuItemActive : styles.menuItem}
                  onClick={() => setActiveMenu(item.id)}>
                <span style={styles.menuIcon}>{item.icon}</span> {item.name}
              </li>
            ))}
          </ul>
          <ul>
             <li style={styles.menuItem} onClick={onLogout}>
                <span style={styles.menuIcon}>🚪</span> Выход
             </li>
          </ul>
        </nav>
      </aside>
      <main style={styles.mainContent}>
        {renderContent()}
      </main>
    </div>
  )
}


const App = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('smm_ai_token'));

  const handleLogin = (newToken: string) => {
      localStorage.setItem('smm_ai_token', newToken);
      setToken(newToken);
  };

  const handleLogout = () => {
      localStorage.removeItem('smm_ai_token');
      // Также очистим другие данные из localStorage при выходе
      localStorage.removeItem('smm_ai_tone');
      localStorage.removeItem('smm_ai_keywords');
      localStorage.removeItem('smm_ai_connected_accounts');
      setToken(null);
  };

  if (!token) {
    return <AuthScreen onLoginSuccess={handleLogin} />;
  }

  return <DashboardScreen onLogout={handleLogout} />;
};

const styles: { [key: string]: React.CSSProperties } = {
  // Auth Screen Styles
  authPage: {
    display: 'flex',
    width: '100%',
    height: '100%',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
  },
  authPanelLeft: {
    width: '40%',
    background: 'linear-gradient(135deg, #007bff, #0056b3)',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  authPanelContent: {
    position: 'relative',
    zIndex: 2,
  },
  authTitle: {
    fontSize: '48px',
    fontWeight: 700,
    margin: '0 0 16px 0',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  authSubtitle: {
    fontSize: '18px',
    lineHeight: 1.5,
    textShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  authPanelRight: {
    width: '60%',
    backgroundColor: '#ffffff',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authFormContainer: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  authTabs: {
    display: 'flex',
    borderBottom: '1px solid #eee',
  },
  authTab: {
    flex: 1,
    padding: '16px',
    fontSize: '16px',
    fontWeight: 500,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#666',
    borderBottom: '3px solid transparent',
  },
  authTabActive: {
    flex: 1,
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#007bff',
    borderBottom: '3px solid #007bff',
  },
  authForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  authInput: {
    padding: '14px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
  },
  authButton: {
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#007bff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  authMessage: {
    padding: '12px',
    borderRadius: '8px',
    textAlign: 'center',
    margin: '0',
    border: '1px solid transparent',
  },
  authMessageError: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderColor: '#f5c6cb',
  },
  authMessageSuccess: {
    backgroundColor: '#d4edda',
    color: '#155724',
    borderColor: '#c3e6cb',
  },
  authBlob: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(40px)',
    opacity: 0.3,
  },
  authBlob1: {
    top: '-20%',
    left: '-20%',
    width: '300px',
    height: '300px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    animation: 'moveBlob1 15s alternate infinite ease-in-out',
  },
  authBlob2: {
    bottom: '-10%',
    right: '10%',
    width: '400px',
    height: '400px',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    animation: 'moveBlob2 18s alternate-reverse infinite ease-in-out',
  },
  authBlob3: {
    top: '30%',
    right: '-20%',
    width: '350px',
    height: '350px',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    animation: 'moveBlob3 12s alternate infinite ease-in-out',
  },

  // Dashboard & Layout
  dashboardContainer: {
    display: 'flex',
    height: '100%',
    width: '100%',
    backgroundColor: '#f7f9fc',
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    padding: '24px',
    borderBottom: '1px solid #e0e0e0',
  },
  sidebarTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#007bff',
    textAlign: 'center',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 24px',
    cursor: 'pointer',
    listStyleType: 'none',
    color: '#333',
    fontWeight: 500,
    borderLeft: '4px solid transparent',
  },
  menuItemActive: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 24px',
    cursor: 'pointer',
    listStyleType: 'none',
    backgroundColor: '#e9f4ff',
    color: '#007bff',
    fontWeight: 600,
    borderLeft: '4px solid #007bff',
  },
  menuIcon: {
    marginRight: '12px',
    fontSize: '20px',
  },
  mainContent: {
    flex: 1,
    padding: '32px',
    overflowY: 'auto',
  },
  mainHeader: {
    marginBottom: '32px',
    paddingBottom: '16px',
    borderBottom: '1px solid #ddd',
  },

  // General Components
  input: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#007bff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  buttonDisabled: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#999',
    backgroundColor: '#e0e0e0',
    border: 'none',
    borderRadius: '8px',
    cursor: 'not-allowed',
  },
  buttonSaved: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#28a745',
    border: 'none',
    borderRadius: '8px',
  },
  label: {
    display: 'block',
    fontWeight: 600,
    marginBottom: '8px',
    fontSize: '14px',
  },
  formGroup: {
    marginBottom: '24px',
  },
  resultBox: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '24px',
    minHeight: '200px',
    position: 'relative',
  },
  loader: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #007bff',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    margin: 'auto',
    position: 'absolute',
    top: 'calc(50% - 20px)',
    left: 'calc(50% - 20px)',
  },
   loaderContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  placeholderText: {
    color: '#888',
    textAlign: 'center',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
  },
  errorText: {
    color: '#d9534f',
    textAlign: 'center',
  },

  // Knowledge Base
  knowledgeBaseContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  dropzone: {
    border: '2px dashed #ccc',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: '#fafafa',
  },
  dropzoneActive: {
    borderColor: '#007bff',
    backgroundColor: '#e9f4ff',
  },
  uploadIcon: {
    fontSize: '48px',
  },
  fileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
  },
  fileCard: {
    position: 'relative',
    height: '180px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#f0f2f5',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileCardIcon: {
    fontSize: '48px',
  },
  fileCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: 'white',
    padding: '8px',
  },
  fileName: {
    fontSize: '12px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  deleteButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'rgba(255, 0, 0, 0.5)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '30px',
    height: '30px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Post & Image Generator
  generatorLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '32px',
  },
  generatorControls: {},
  generatorResult: {},
  noFilesText: {
    color: '#888',
    padding: '16px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    textAlign: 'center',
  },
  fileSelectionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '12px',
    maxHeight: '300px',
    overflowY: 'auto',
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '8px',
  },
  fileSelectItem: {
    position: 'relative',
    height: '100px',
    border: '2px solid #ddd',
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
    backgroundColor: '#f0f2f5',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileSelectItemActive: {
    borderColor: '#007bff',
    boxShadow: '0 0 0 3px rgba(0, 123, 255, 0.3)',
  },
  fileSelectIcon: {
    fontSize: '32px',
  },
  fileSelectOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: '4px',
    textAlign: 'center',
  },
  fileSelectName: {
    fontSize: '10px',
    color: 'white',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fileSelectCheck: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '24px',
    height: '24px',
    backgroundColor: '#007bff',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
  },
  aspectRatioSelector: {
    display: 'flex',
    gap: '12px',
  },
  aspectRatioButton: {
    flex: 1,
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  aspectRatioButtonActive: {
    flex: 1,
    padding: '12px',
    fontSize: '14px',
    border: '2px solid #007bff',
    borderRadius: '8px',
    backgroundColor: '#e9f4ff',
    cursor: 'pointer',
    color: '#007bff',
    fontWeight: 600,
  },
  imageResultBox: {
    backgroundColor: '#f0f2f5',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '16px',
    minHeight: '400px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
  },
  generatedImage: {
    maxWidth: '100%',
    maxHeight: '450px',
    objectFit: 'contain',
    borderRadius: '8px',
  },
  imageActions: {},
  
  // Content Plan
  contentPlanLayout: {
    display: 'grid',
    gridTemplateColumns: '350px 1fr',
    gap: '32px',
    height: 'calc(100vh - 150px)', // Adjust based on header height
  },
  contentPlanControls: {
    display: 'flex',
    flexDirection: 'column',
  },
  unscheduledPostsContainer: {
    marginTop: '24px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  unscheduledPostsList: {
    flex: 1,
    overflowY: 'auto',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '12px',
    backgroundColor: '#fff',
    position: 'relative',
  },
  planCardClickable: {
      backgroundColor: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
      cursor: 'grab',
      transition: 'box-shadow 0.2s, transform 0.2s',
  },
  planCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  planCardType: {
    backgroundColor: '#e9f4ff',
    color: '#007bff',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  },
  planCardTopic: {
    fontWeight: 600,
    marginBottom: '8px',
  },
  planCardDescription: {
    fontSize: '14px',
    color: '#666',
    lineHeight: 1.4,
  },
  contentPlanResult: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #ddd',
    padding: '16px',
  },
  calendarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    padding: '0 8px',
  },
  calendarMonthLabel: {
    fontSize: '20px',
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  calendarNavButton: {
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
    fontSize: '20px',
  },
  calendarGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gridAutoRows: 'minmax(100px, 1fr)',
    gap: '4px',
    position: 'relative',
  },
  calendarWeekdays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    textAlign: 'center',
    marginBottom: '8px',
    color: '#666',
    fontWeight: 600,
    fontSize: '12px',
  },
  calendarCell: {
    border: '1px solid #eee',
    borderRadius: '4px',
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
  },
  calendarCellEmpty: {
      backgroundColor: '#f9f9f9',
  },
  calendarDayHeader: {
    fontWeight: 600,
    fontSize: '12px',
    marginBottom: '4px',
  },
  calendarCellContent: {
      flex: 1,
      overflowY: 'auto',
  },
  scheduledPostItem: {
    backgroundColor: '#e9f4ff',
    borderRadius: '4px',
    padding: '4px 8px',
    marginBottom: '4px',
    cursor: 'pointer',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  scheduledPostItemPublished: {
      backgroundColor: '#d4edda',
      color: '#155724',
      cursor: 'default',
  },
  scheduledPostTopic: {
    fontSize: '12px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    paddingRight: '20px', // space for button
  },

  // Modal
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
  },
  modalHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: '40% 60%',
    gap: '24px',
  },
  modalBodySingleColumn: {
      padding: '24px',
      overflowY: 'auto',
  },
  modalFooter: {
      padding: '16px 24px',
      borderTop: '1px solid #eee',
      display: 'flex',
      justifyContent: 'flex-end',
  },
  adaptationControls: {},
  adaptationResult: {},
  platformGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  },
  platformSelectItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  platformSelectItemActive: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    border: '2px solid #007bff',
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: '#e9f4ff',
  },
  checkbox: {
    marginRight: '12px',
    width: '18px',
    height: '18px',
  },
  platformSelectIconImg: {
    width: '24px',
    height: '24px',
    marginRight: '8px',
    objectFit: 'contain',
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: '1px solid #ccc',
    marginBottom: '16px',
  },
  tabItem: {
    padding: '10px 16px',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    borderBottom: '2px solid transparent',
  },
  tabItemActive: {
    padding: '10px 16px',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    borderBottom: '2px solid #007bff',
    fontWeight: 600,
    color: '#007bff',
  },
  tabContent: {
    position: 'relative',
  },
  editableTextarea: {
    width: '100%',
    minHeight: '150px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '12px',
    fontSize: '15px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  copyButton: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    cursor: 'pointer',
  },
  publishPlatformList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  publishPlatformRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusSuccess: {
      color: '#28a745',
      fontWeight: 600,
  },
  statusError: {
      color: '#dc3545',
      fontWeight: 600,
  },


  // Settings
  settingsLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '32px',
    alignItems: 'start',
  },
  settingsColumn: {
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
  },
  settingsSection: {
    backgroundColor: '#fff',
    padding: '24px',
    borderRadius: '8px',
    border: '1px solid #ddd',
  },
  settingsSectionTitle: {
    marginBottom: '24px',
    borderBottom: '1px solid #eee',
    paddingBottom: '12px',
  },
  settingsDescription: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '12px',
    lineHeight: 1.5,
  },
  teamInviteContainer: {
    marginBottom: '24px',
  },
  teamInviteForm: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  select: {
    padding: '0 12px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    backgroundColor: 'white',
  },
  inviteButton: {
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#007bff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  permissionsInfoBox: {
      backgroundColor: '#f9f9f9',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #eee',
  },
  permissionsList: {
      listStyleType: 'none',
      paddingLeft: 0,
  },
  permissionItem: {
      marginBottom: '8px',
  },
  permissionAllowed: {
      color: '#28a745',
  },
  permissionDenied: {
      color: '#dc3545',
  },
  teamList: {
      marginTop: '16px',
  },
  teamMemberRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #eee',
  },
  teamMemberInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
  },
  teamMemberRoleIcon: {
      fontSize: '20px',
  },
  teamMemberEmail: {
      fontWeight: 500,
  },
  teamMemberRole: {
      color: '#666',
  },
  teamRemoveButton: {
      background: 'none',
      border: 'none',
      color: '#dc3545',
      cursor: 'pointer',
      fontSize: '14px',
  },
  integrationsList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
  },
  integrationRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px',
      border: '1px solid #eee',
      borderRadius: '8px',
  },
  integrationInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
  },
  integrationActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
  },
  connectButton: {
      padding: '8px 16px',
      fontSize: '14px',
      fontWeight: 600,
      color: '#fff',
      backgroundColor: '#007bff',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
  },
  disconnectButton: {
      padding: '8px 16px',
      fontSize: '14px',
      fontWeight: 500,
      color: '#dc3545',
      backgroundColor: 'transparent',
      border: '1px solid #dc3545',
      borderRadius: '8px',
      cursor: 'pointer',
  },
  connectedStatus: {
      color: '#28a745',
      fontWeight: 600,
      fontSize: '14px',
  },

  // Analytics
  analyticsLayout: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-end',
    marginBottom: '32px',
  },
  analyticsResultBox: {
    backgroundColor: '#fff',
    padding: '32px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    minHeight: '300px',
    position: 'relative',
  },
  ideasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
    marginTop: '16px',
  },
  ideaCard: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #eee',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  createPostButton: {
    marginTop: '16px',
    backgroundColor: 'transparent',
    border: '1px solid #007bff',
    color: '#007bff',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  sourcesList: {
    listStyleType: 'decimal',
    paddingLeft: '20px',
  },
};


const root = createRoot(document.getElementById('root')!);
root.render(<App />);