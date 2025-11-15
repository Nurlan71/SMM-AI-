const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');
const { PassThrough } = require('stream');
const axios = require('axios');
const FormData = require('form-data');
const db = require('./db');


const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-super-secret-key-for-dev';

// Initialize the database on startup
db.initializeDb();


app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images

// --- DEBUG: Logging Middleware ---
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Received request: ${req.method} ${req.originalUrl}`);
    next();
});


// --- File Upload Setup ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// --- Authentication Middleware ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// --- ROUTER SETUP ---
const authRouter = express.Router();
const apiRouter = express.Router();


// --- PUBLIC AUTH ROUTES ---
authRouter.post('/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email и пароль обязательны.' });
    }
    if (db.findUserByEmail(email)) {
        return res.status(409).json({ message: 'Пользователь с таким email уже существует.' });
    }
    db.addUser({ email, password });
    res.status(201).json({ message: 'Пользователь успешно зарегистрирован.' });
});

authRouter.post('/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.findUserByEmail(email);
    if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Неверный email или пароль.' });
    }
    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

// Mount the public router
app.use('/api/auth', authRouter);


// --- SECURE API ROUTES ---
// Apply auth middleware to all routes in this router
apiRouter.use(authMiddleware);

apiRouter.post('/generate-campaign', async (req, res) => {
    console.log('[/api/generate-campaign] route handler reached.');
    const { goal, description, postCount } = req.body;
    const settings = db.getSettings(); // Get settings from DB
    const GOALS = [
        { id: 'awareness', title: 'Повысить узнаваемость' },
        { id: 'followers', title: 'Привлечь подписчиков' },
        { id: 'sales', title: 'Увеличить продажи' },
        { id: 'launch', title: 'Анонсировать событие' },
        { id: 'content', title: 'Просто создать контент' },
    ];
    
    if (!process.env.API_KEY) {
        console.error("Gemini API key is not set in the environment.");
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const selectedGoal = GOALS.find(g => g.id === goal)?.title || 'Не указана';

        // Fix: Add a fallback for platforms to prevent crash if settings are incomplete
        const availablePlatforms = (settings && Array.isArray(settings.platforms) && settings.platforms.length > 0)
            ? settings.platforms.join(', ')
            : 'instagram, telegram, vk';

        const systemInstruction = `Ты - эксперт SMM-менеджер. Твоя задача - создать серию постов для социальных сетей на основе запроса пользователя.
        - Проанализируй цель кампании, описание, а также общие настройки бренда (Tone of Voice, ключевые слова, целевая аудитория).
        - Создай ровно ${postCount} постов.
        - Каждый пост должен быть уникальным и соответствовать общей цели.
        - Выбери подходящую платформу для каждого поста из списка доступных: ${availablePlatforms}.
        - Ответь СТРОГО в формате JSON-массива объектов. Не добавляй никаких других слов или форматирования вроде \`\`\`json.
        - Каждый объект в массиве должен содержать два поля: "platform" (string) и "content" (string).`;
        
        const prompt = `
        **Цель кампании:** ${selectedGoal}
        **Описание идеи от пользователя:** ${description}
        ---
        **Настройки бренда:**
        - **Tone of Voice:** ${settings.toneOfVoice}
        - **Ключевые слова:** ${settings.keywords}
        - **Целевая аудитория:** ${settings.targetAudience}
        `;

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
        console.log('[/api/generate-campaign] Successfully generated posts from Gemini.');
        res.json(generatedPosts);

    } catch (error) {
        console.error('Error in /api/generate-campaign:', error);
        res.status(500).json({ message: `Ошибка при обращении к AI: ${error.message}` });
    }
});

apiRouter.post('/generate-post', async (req, res) => {
    const { topic, postType, keywords, toneOfVoice, variantCount, model, useMemory } = req.body;
    const brandSettings = db.getSettings();

    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        let systemInstruction = `Ты - эксперт SMM-копирайтер. Твоя задача - написать ${variantCount} ${variantCount > 1 ? 'вариантов' : 'вариант'} поста для социальных сетей на основе запроса пользователя.
        - Проанализируй тему, тип поста и тон общения.
        - Естественно впиши в текст ключевые слова, если они предоставлены.
        - Каждый вариант должен быть уникальным.
        - Пост должен быть увлекательным, хорошо структурированным, с подходящими эмодзи и хэштегами.
        - Ответь СТРОГО в формате JSON-массива строк. Каждая строка - это один вариант поста. Не добавляй никакого текста до или после JSON.`;

        let prompt = `
        **Основная тема поста:** ${topic}
        **Тип поста:** ${postType}
        **Тон общения:** ${toneOfVoice}
        `;

        if (keywords) {
            prompt += `\n**Ключевые слова для включения:** ${keywords}`;
        }
        
        if (useMemory && brandSettings) {
            prompt += `
            ---
            **Обязательно следуй этим правилам голоса бренда:**
            - **Стиль общения (Tone of Voice):** ${brandSettings.toneOfVoice}
            - **Целевая аудитория:** ${brandSettings.targetAudience}
            - **Ключевые слова бренда:** ${brandSettings.keywords}
            `;
        }

        const response = await ai.models.generateContent({
            model: model || 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                },
            },
        });
        
        const jsonStr = response.text.trim();
        const variants = JSON.parse(jsonStr);
        res.json({ variants });

    } catch (error) {
        console.error('Error in /api/generate-post:', error);
        res.status(500).json({ message: `Ошибка при генерации поста: ${error.message}` });
    }
});

apiRouter.post('/generate-comment-reply', async (req, res) => {
    const { postContent, commentText } = req.body;
    const brandSettings = db.getSettings();
     if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `Ты - эксперт комьюнити-менеджер. Твоя задача - написать дружелюбный и полезный ответ на комментарий пользователя, строго следуя голосу бренда. Ответ должен быть по существу, позитивным и вовлекающим. Не используй приветствия вроде "Здравствуйте" или "Привет", а сразу переходи к сути ответа.`;

        const prompt = `
        **Контекст (оригинальный пост):**
        ${postContent}

        **Комментарий пользователя, на который нужно ответить:**
        ${commentText}

        ---
        **Правила "Голоса бренда", которым нужно следовать:**
        - **Стиль общения (Tone of Voice):** ${brandSettings.toneOfVoice}
        - **Целевая аудитория:** ${brandSettings.targetAudience}
        ---

        Напиши подходящий ответ на комментарий.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
            },
        });
        
        const replyText = response.text;
        res.json({ reply: replyText });

    } catch (error) {
        console.error('Error in /api/generate-comment-reply:', error);
        res.status(500).json({ message: `Ошибка при генерации ответа: ${error.message}` });
    }
});

apiRouter.post('/generate-image', async (req, res) => {
    const { prompt, aspectRatio } = req.body;
    if (!prompt) {
        return res.status(400).json({ message: 'Требуется текстовое описание (prompt).' });
    }
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio || '1:1',
            },
        });
        
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        res.json({ image: base64ImageBytes });
    } catch (error) {
        console.error('Error in /api/generate-image:', error);
        res.status(500).json({ message: `Ошибка при генерации изображения: ${error.message}` });
    }
});

apiRouter.post('/edit-image', async (req, res) => {
    const { image, prompt } = req.body;
    if (!image || !image.data || !image.mimeType) {
        return res.status(400).json({ message: 'Требуется изображение (image).' });
    }
    if (!prompt) {
        return res.status(400).json({ message: 'Требуется текстовое описание (prompt).' });
    }
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: image.data, mimeType: image.mimeType } },
                    { text: prompt },
                ],
            },
            config: {
                responseModalities: ['IMAGE'], // Using string literal as Modality enum might not be available in CJS
            },
        });

        // Extract the first image part from the response
        let editedImageBytes = null;
        if (response.candidates && response.candidates.length > 0) {
            const parts = response.candidates[0].content.parts;
            for (const part of parts) {
                if (part.inlineData) {
                    editedImageBytes = part.inlineData.data;
                    break;
                }
            }
        }
        
        if (editedImageBytes) {
            res.json({ image: editedImageBytes });
        } else {
            throw new Error('AI не вернул отредактированное изображение.');
        }
    } catch (error) {
        console.error('Error in /api/edit-image:', error);
        res.status(500).json({ message: `Ошибка при редактировании изображения: ${error.message}` });
    }
});

apiRouter.post('/generate-video', async (req, res) => {
    const { prompt, image, aspectRatio, resolution } = req.body;

    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const payload = {
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config: {
                numberOfVideos: 1,
                resolution: resolution || '720p',
                aspectRatio: aspectRatio || '9:16'
            }
        };

        if (image) {
            const { data, mimeType } = image;
            payload.image = {
                imageBytes: data,
                mimeType: mimeType,
            };
        }

        const operation = await ai.models.generateVideos(payload);
        console.log('[/api/generate-video] Video generation started, operation:', operation.name);
        res.json({ name: operation.name });

    } catch (error) {
        console.error('Error in /api/generate-video:', error);
        const errorMessage = error.message || 'Unknown error';

        if (errorMessage.includes("User location is not supported")) {
            return res.status(403).json({ message: 'Генерация видео недоступна в вашем регионе. Это ограничение API от Google.' });
        }
        if (errorMessage.includes("API key not valid") || errorMessage.includes("Requested entity was not found")) {
             return res.status(403).json({ message: 'API ключ недействителен или не имеет доступа к Veo API. Пожалуйста, попробуйте сгенерировать видео еще раз, чтобы выбрать другой ключ.' });
        }
        if (errorMessage.includes("API is only accessible to billed users")) {
            return res.status(403).json({ message: 'Для использования Veo API ваш Google Cloud проект должен быть привязан к платежному аккаунту.' });
        }

        res.status(500).json({ message: `Ошибка при запуске генерации видео: ${errorMessage}` });
    }
});

apiRouter.get('/video-operation/:operationId', async (req, res) => {
    const { operationId } = req.params;
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const operation = await ai.operations.getVideosOperation({
            operation: { name: `operations/${operationId}` }
        });
        res.json(operation);
    } catch (error) {
        console.error(`Error fetching operation ${operationId}:`, error);
        res.status(500).json({ message: `Ошибка при проверке статуса задачи: ${error.message}` });
    }
});

apiRouter.get('/get-video', async (req, res) => {
    const { uri } = req.query;
    if (!uri) {
        return res.status(400).json({ message: 'Требуется URI видео.' });
    }
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const videoUrl = `${uri}&key=${process.env.API_KEY}`;
        const videoResponse = await fetch(videoUrl);

        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
        }
        
        res.setHeader('Content-Type', 'video/mp4');
        const passThrough = new PassThrough();
        videoResponse.body.pipe(passThrough);
        passThrough.pipe(res);

    } catch (error) {
        console.error('Error proxying video:', error);
        res.status(500).json({ message: `Ошибка при загрузке видео: ${error.message}` });
    }
});

apiRouter.post('/generate-strategy', async (req, res) => {
    const { projectName, projectDescription, mainGoal, targetAudience, competitors, model, useMemory } = req.body;
    const brandSettings = db.getSettings();
     if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const systemInstruction = `Ты - SMM-стратег высшего класса. Твоя задача - создать подробную и практическую SMM-стратегию на основе данных от пользователя. Стратегия должна быть четкой, структурированной и профессиональной. Ответь СТРОГО в формате JSON-объекта согласно предоставленной схеме. Не добавляй никакого текста до или после JSON-объекта.`;
        
        let prompt = `
        **Название проекта:** ${projectName}
        **Описание проекта:** ${projectDescription}
        **Главная цель:** ${mainGoal}
        **Целевая аудитория:** ${targetAudience}
        **Конкуренты:** ${competitors || 'Не указаны'}
        `;

        if (useMemory) {
             prompt += `
            ---
            **Контекст "Голоса Бренда" для учета:**
            - **Стиль общения (Tone of Voice):** ${brandSettings.toneOfVoice}
            - **Ключевые слова бренда:** ${brandSettings.keywords}
            `;
        }

        const response = await ai.models.generateContent({
            model: model || 'gemini-2.5-pro',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        projectName: { type: Type.STRING },
                        analysis: {
                            type: Type.OBJECT,
                            properties: {
                                audience: { type: Type.STRING, description: "Детальный анализ целевой аудитории, их болей и потребностей в контексте SMM." },
                                competitors: { type: Type.STRING, description: "Краткий анализ сильных и слабых сторон конкурентов в социальных сетях." },
                                swot: { type: Type.STRING, description: "Простой SWOT-анализ (Сильные стороны, Слабые стороны, Возможности, Угрозы) для проекта в SMM." }
                            },
                             required: ["audience", "competitors", "swot"]
                        },
                        strategy: {
                            type: Type.OBJECT,
                            properties: {
                                contentPillars: { 
                                    type: Type.ARRAY, 
                                    items: { type: Type.STRING },
                                    description: "3-5 основных контентных рубрик (столпов), на которых будет строиться контент-план."
                                },
                                platformRecommendations: { 
                                    type: Type.ARRAY, 
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            platform: { type: Type.STRING, description: "Название социальной сети (например, Instagram, Telegram)." },
                                            reasoning: { type: Type.STRING, description: "Обоснование, почему эта платформа подходит для данного проекта." }
                                        },
                                         required: ["platform", "reasoning"]
                                    },
                                    description: "Рекомендации по 2-3 наиболее подходящим платформам."
                                },
                                postingSchedule: { type: Type.STRING, description: "Рекомендуемая частота и лучшее время для публикаций." }
                            },
                            required: ["contentPillars", "platformRecommendations", "postingSchedule"]
                        },
                        kpis: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: "Список из 3-4 ключевых показателей эффективности (KPI) для отслеживания успеха стратегии."
                        }
                    },
                    required: ["projectName", "analysis", "strategy", "kpis"]
                },
            },
        });
        
        const jsonStr = response.text.trim();
        const generatedStrategy = JSON.parse(jsonStr);
        res.json(generatedStrategy);

    } catch (error) {
        console.error('Error in /api/generate-strategy:', error);
        res.status(500).json({ message: `Ошибка при генерации стратегии: ${error.message}` });
    }
});

apiRouter.post('/find-trends', async (req, res) => {
    const { topic, model, useMemory } = req.body;
    if (!topic) {
        return res.status(400).json({ message: 'Требуется тема для поиска трендов.' });
    }
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const systemInstruction = `Ты - AI-аналитик SMM-трендов. Твоя задача - найти и проанализировать самые свежие тренды в интернете по заданной теме, используя Google Search.
        - **Запрет:** Не используй и не запрашивай данные о местоположении пользователя. Анализ должен быть глобальным или сфокусированным на русскоязычном сегменте интернета.
        - Сгенерируй ответ СТРОГО в формате JSON согласно предоставленной схеме. Не добавляй текст до или после JSON.
        - Все текстовые поля должны быть на русском языке.`;

        let prompt = `Найди 3-4 актуальных глобальных или русскоязычных SMM-тренда по теме: "${topic}". Не используй мое местоположение для поиска.`;
        
        const response = await ai.models.generateContent({
            model: model || 'gemini-2.5-pro',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        mainTrend: {
                            type: Type.OBJECT,
                            description: "Самый главный и влиятельный тренд.",
                            properties: {
                                title: { type: Type.STRING },
                                description: { type: Type.STRING, description: "Подробное объяснение сути тренда." }
                            },
                            required: ["title", "description"]
                        },
                        relatedTopics: {
                            type: Type.ARRAY,
                            description: "Список из 2-3 связанных тем или под-трендов.",
                            items: { type: Type.STRING }
                        },
                        keyHashtags: {
                            type: Type.ARRAY,
                            description: "Список из 5-7 релевантных хэштегов.",
                            items: { type: Type.STRING }
                        },
                        contentIdeas: {
                            type: Type.ARRAY,
                            description: "Список из 3 конкретных идей для контента, основанных на трендах.",
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["mainTrend", "relatedTopics", "keyHashtags", "contentIdeas"]
                }
            },
        });

        const jsonStr = response.text.trim();
        const trendData = JSON.parse(jsonStr);

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        const sources = groundingChunks
            .filter(chunk => chunk.web && chunk.web.uri)
            .map(chunk => ({
                uri: chunk.web.uri,
                title: chunk.web.title || chunk.web.uri,
            }));
        const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());

        res.json({ trends: trendData, sources: uniqueSources });

    } catch (error) {
        console.error('Error in /api/find-trends:', error);
        res.status(500).json({ message: `Ошибка при поиске трендов: ${error.message}` });
    }
});

apiRouter.post('/analyze-competitors', async (req, res) => {
    const { competitors, model } = req.body;
    if (!competitors || !Array.isArray(competitors) || competitors.length === 0) {
        return res.status(400).json({ message: 'Требуется список URL конкурентов.' });
    }
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const systemInstruction = `Ты - ведущий SMM-стратег. Твоя задача - провести глубокий анализ SMM-активности конкурентов по предоставленным ссылкам, используя Google Search.
        - Для каждого конкурента определи общую стратегию, 2-3 сильные стороны, 2-3 слабые стороны и приведи пример самого успешного контента с объяснением, почему он работает.
        - В конце, на основе всего анализа, дай 3-4 конкретных, действенных рекомендации для пользователя.
        - Твой анализ должен быть объективным, основанным на данных из поиска.
        - Ответь СТРОГО в формате JSON согласно предоставленной схеме. Весь текст должен быть на русском языке.`;

        const prompt = `Проанализируй SMM-стратегии следующих конкурентов: ${competitors.join(', ')}`;

        const response = await ai.models.generateContent({
            model: model || 'gemini-2.5-pro',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        analysis: {
                            type: Type.ARRAY,
                            description: "Анализ по каждому конкуренту.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    url: { type: Type.STRING, description: "URL проанализированного конкурента." },
                                    summary: { type: Type.STRING, description: "Общая SMM-стратегия конкурента." },
                                    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Сильные стороны (2-3 пункта)." },
                                    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Слабые стороны (2-3 пункта)." },
                                    topContentExample: { type: Type.STRING, description: "Пример самого успешного контента и почему он работает." }
                                },
                                required: ["url", "summary", "strengths", "weaknesses", "topContentExample"]
                            }
                        },
                        recommendations: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "Список из 3-4 конкретных, действенных рекомендаций для пользователя на основе общего анализа."
                        }
                    },
                    required: ["analysis", "recommendations"]
                }
            },
        });

        const jsonStr = response.text.trim();
        const analysisData = JSON.parse(jsonStr);

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = groundingChunks
            .filter(chunk => chunk.web && chunk.web.uri)
            .map(chunk => ({ uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri }))
            .filter((source, index, self) => index === self.findIndex((s) => s.uri === source.uri)); // Deduplicate

        res.json({ analysis: analysisData, sources });

    } catch (error) {
        console.error('Error in /api/analyze-competitors:', error);
        res.status(500).json({ message: `Ошибка при анализе конкурентов: ${error.message}` });
    }
});


apiRouter.post('/adapt-content', async (req, res) => {
    const { sourceText, targetPlatform, model, useMemory } = req.body;
    const brandSettings = db.getSettings();
    if (!sourceText || !targetPlatform) {
        return res.status(400).json({ message: 'Требуется исходный текст и целевая платформа.' });
    }
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const systemInstruction = `Ты - эксперт по SMM и копирайтингу. Твоя задача - адаптировать предоставленный текст под формат и стиль конкретной социальной сети.
        - Сохрани основную идею и смысл исходного текста.
        - Скорректируй тон, длину, форматирование (абзацы, списки, эмодзи), хэштеги и призыв к действию в соответствии с лучшими практиками выбранной платформы.
        - Ответ должен содержать только адаптированный текст, без лишних комментариев.`;

        let prompt = `Адаптируй следующий текст для формата "${targetPlatform}":\n\n--- ИСХОДНЫЙ ТЕКСТ ---\n${sourceText}\n--- КОНЕЦ ТЕКСТА ---`;
        
        if (useMemory) {
             prompt += `
            ---
            **Контекст "Голоса Бренда" для учета:**
            - **Стиль общения (Tone of Voice):** ${brandSettings.toneOfVoice}
            - **Целевая аудитория:** ${brandSettings.targetAudience}
            `;
        }


        const response = await ai.models.generateContent({
            model: model || 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
            },
        });

        const adaptedText = response.text;
        res.json({ adaptedText });

    } catch (error) {
        console.error('Error in /api/adapt-content:', error);
        res.status(500).json({ message: `Ошибка при адаптации контента: ${error.message}` });
    }
});

apiRouter.post('/generate-report', async (req, res) => {
    const { analyticsData } = req.body;
     if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `Ты - ведущий SMM-аналитик. Твоя задача - проанализировать предоставленные данные по статистике социальных сетей за неделю и составить краткий, понятный отчет для руководителя.
        - Отчет должен быть в формате Markdown.
        - **Структура отчета:**
          1.  **Общие результаты:** Краткое резюме по ключевым метрикам (посты, лайки, комментарии, просмотры).
          2.  **Ключевые достижения:** Выдели 1-2 самых позитивных момента (например, самый успешный пост или самая вовлеченная платформа).
          3.  **Точки роста:** Определи 1-2 области, где результаты были ниже ожидаемых или есть потенциал для улучшения.
          4.  **Рекомендация на следующую неделю:** Дай одну конкретную, выполнимую рекомендацию.
        - Стиль отчета: деловой, но ясный и лаконичный.`;

        const prompt = `Вот данные для анализа: ${JSON.stringify(analyticsData, null, 2)}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
            },
        });
        
        const reportText = response.text;
        res.json({ report: reportText });

    } catch (error) {
        console.error('Error in /api/generate-report:', error);
        res.status(500).json({ message: `Ошибка при генерации отчета: ${error.message}` });
    }
});

apiRouter.post('/analytics/suggestion', async (req, res) => {
    const { posts: publishedPosts } = req.body;

    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }
    if (!publishedPosts || publishedPosts.length === 0) {
        return res.status(400).json({ message: "Нет данных для анализа." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `Ты - ведущий SMM-аналитик. Твоя задача - проанализировать предоставленные данные по опубликованным постам и предложить лучшее время для следующей публикации.
        - Проанализируй JSON-массив постов, обращая внимание на 'publishDate' (время публикации), 'likes_count' (лайки) и 'comments_count' (комментарии).
        - Выяви закономерности: в какие дни недели и в какое время суток посты получают наибольший отклик (сумму лайков и комментариев).
        - Определи **следующий** наилучший временной слот для публикации, который наступит после ${new Date().toISOString()}.
        - Сформулируй краткий текстовый совет на русском языке (1-2 предложения).
        - Ответь СТРОГО в формате JSON согласно схеме. Не добавляй текст до или после JSON.`;

        const prompt = `Вот данные для анализа:\n${JSON.stringify(publishedPosts, null, 2)}`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestionText: { 
                            type: Type.STRING,
                            description: "Краткий текстовый совет на русском языке. Например: 'Ваши посты лучше всего работают по будням около 11:00.'"
                        },
                        suggestedDateISO: {
                            type: Type.STRING,
                            description: "Следующее лучшее время для публикации в формате ISO 8601. Например: '2025-11-18T11:00:00.000Z'"
                        }
                    },
                    required: ["suggestionText", "suggestedDateISO"]
                },
            },
        });

        const jsonStr = response.text.trim();
        const suggestion = JSON.parse(jsonStr);
        res.json(suggestion);

    } catch (error) {
        console.error('Error in /api/analytics/suggestion:', error);
        res.status(500).json({ message: `Ошибка при генерации совета: ${error.message}` });
    }
});

apiRouter.get('/analytics', (req, res) => {
    const { period = '30d', compare = 'false' } = req.query;
    const posts = db.getPosts();
    const days = period === '7d' ? 7 : 30;
    const now = new Date();

    const getStatsForPeriod = (startDate, endDate) => {
        const filteredPosts = posts.filter(p => {
            if (p.status !== 'published' || !p.publishDate) return false;
            const publishDate = new Date(p.publishDate);
            return publishDate >= startDate && publishDate < endDate;
        });

        const totalStats = filteredPosts.reduce((acc, post) => {
            acc.likes += post.likes_count || 0;
            acc.comments += post.comments_count || 0;
            acc.views += post.views_count || 0;
            return acc;
        }, { likes: 0, comments: 0, views: 0 });

        const platformPerformance = filteredPosts.reduce((acc, post) => {
            if (!acc[post.platform]) {
                acc[post.platform] = { posts: 0, likes: 0, comments: 0 };
            }
            acc[post.platform].posts += 1;
            acc[post.platform].likes += post.likes_count || 0;
            acc[post.platform].comments += post.comments_count || 0;
            return acc;
        }, {});
        
        const sortedPlatforms = Object.entries(platformPerformance)
            .sort(([, a], [, b]) => b.likes - a.likes)
            .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

        const topPosts = [...filteredPosts]
            .sort((a, b) => (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count))
            .slice(0, 5);

        return {
            totalPosts: filteredPosts.length,
            totalLikes: totalStats.likes,
            totalComments: totalStats.comments,
            totalViews: totalStats.views,
            platformPerformance: sortedPlatforms,
            topPosts,
        };
    };

    const currentPeriodEnd = new Date(now);
    const currentPeriodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const currentData = getStatsForPeriod(currentPeriodStart, currentPeriodEnd);

    let previousData = null;
    if (compare === 'true') {
        const previousPeriodEnd = currentPeriodStart;
        const previousPeriodStart = new Date(previousPeriodEnd.getTime() - days * 24 * 60 * 60 * 1000);
        previousData = getStatsForPeriod(previousPeriodStart, previousPeriodEnd);
    }
    
    res.json({ current: currentData, previous: previousData });
});

apiRouter.get('/posts', (req, res) => res.json(db.getPosts()));

apiRouter.post('/posts', (req, res) => {
    const { content, platform, status } = req.body;
    if (!content) {
        return res.status(400).json({ message: 'Требуется контент поста.' });
    }
    const newPostData = {
        platform: platform || 'instagram',
        content: content,
        media: [],
        status: status || 'idea',
        publishDate: undefined,
        tags: [],
        comments_count: 0,
        likes_count: 0,
        views_count: 0,
    };
    const newPost = db.addPost(newPostData);
    console.log(`[/api/posts] New post created with ID ${newPost.id}.`);
    res.status(201).json(newPost);
});

apiRouter.post('/posts/ab-test', (req, res) => {
    const { variants } = req.body;
    if (!variants || !Array.isArray(variants) || variants.length < 2) {
        return res.status(400).json({ message: 'Для A/B теста требуется как минимум 2 варианта.' });
    }

    // Simulate engagement stats for variants
    const variantsWithStats = variants.map(text => ({
        text,
        likes_count: Math.floor(Math.random() * 100) + 10,
        comments_count: Math.floor(Math.random() * 20) + 2,
    }));

    const newPostData = {
        platform: 'instagram', // Default platform for A/B test
        content: `A/B Тест: ${variants[0].substring(0, 50)}...`, // A placeholder content
        media: [],
        status: 'draft',
        publishDate: undefined,
        tags: ['ab-test'],
        comments_count: 0,
        likes_count: 0,
        views_count: 0,
        isABTest: true,
        variants: variantsWithStats,
    };
    const newPost = db.addPost(newPostData);
    console.log(`[/api/posts/ab-test] New A/B test created with ID ${newPost.id}.`);
    res.status(201).json(newPost);
});


apiRouter.put('/posts/:id', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const post = db.getPostById(postId);
    if (!post) {
        return res.status(404).json({ message: 'Пост не найден.' });
    }
    const updatedPost = db.updatePost(postId, req.body);
    console.log(`[/api/posts/:id] Post ${postId} updated.`);
    res.json(updatedPost);
});

apiRouter.put('/posts/:id/end-ab-test', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const { winnerVariantText } = req.body;
    const post = db.getPostById(postId);

    if (!post) {
        return res.status(404).json({ message: 'Пост не найден.' });
    }
    if (!post.isABTest) {
        return res.status(400).json({ message: 'Это не A/B-тест.' });
    }
     if (!winnerVariantText) {
        return res.status(400).json({ message: 'Необходимо указать текст победившего варианта.' });
    }

    const updatedData = {
        content: winnerVariantText,
        isABTest: false,
        variants: undefined,
    };
    const updatedPost = db.updatePost(postId, updatedData);
    
    console.log(`[/api/posts/:id/end-ab-test] A/B test ${postId} ended.`);
    res.json(updatedPost);
});

apiRouter.post('/posts/:id/publish', async (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const post = db.getPostById(postId);
    if (!post) return res.status(404).json({ message: 'Пост не найден.' });

    if (post.platform !== 'telegram') return res.status(400).json({ message: 'Публикация доступна только для Telegram.' });

    const { telegram } = db.getSettings();
    if (!telegram || !telegram.token || !telegram.chatId) {
        return res.status(400).json({ message: 'Данные для Telegram не настроены.' });
    }

    try {
        const botToken = telegram.token;
        const chatId = telegram.chatId;
        
        if (post.media && post.media.length > 0) {
            const imageUrl = post.media[0];
            const imagePath = path.join(__dirname, path.basename(imageUrl));
            
            if (!fs.existsSync(imagePath)) {
                throw new Error(`Файл не найден по пути: ${imagePath}`);
            }

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('photo', fs.createReadStream(imagePath));
            formData.append('caption', post.content);
            
            await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, formData, {
                headers: formData.getHeaders(),
            });

        } else {
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: chatId,
                text: post.content,
            });
        }
        
        const updatedPost = db.updatePost(postId, {
            status: 'published',
            publishDate: new Date().toISOString()
        });
        
        res.json(updatedPost);

    } catch (error) {
        console.error('Telegram API Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: `Ошибка публикации в Telegram: ${error.response ? error.response.data.description : error.message}` });
    }
});

apiRouter.delete('/posts/:id', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const deleted = db.deletePost(postId);
    if (!deleted) {
        return res.status(404).json({ message: 'Пост не найден.' });
    }
    console.log(`[/api/posts/:id] Post ${postId} deleted.`);
    res.status(200).json({ message: 'Пост успешно удален.' });
});

apiRouter.get('/files', (req, res) => res.json(db.getFiles()));

apiRouter.post('/files/upload-generated', (req, res) => {
    const { base64Image, originalPrompt } = req.body;
    if (!base64Image) {
        return res.status(400).json({ message: 'Требуются данные изображения в формате base64.' });
    }

    try {
        const fileContents = Buffer.from(base64Image, 'base64');
        const fileExtension = '.jpeg';
        const fileName = `${Date.now()}-ai-generated${fileExtension}`;
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, fileContents);
        
        const newFileData = {
            name: originalPrompt ? `${originalPrompt.substring(0, 30).trim()}.jpeg` : fileName,
            url: `/uploads/${fileName}`,
            mimeType: 'image/jpeg',
            tags: ['ai-generated'],
            isAnalyzing: false,
        };
        const newFile = db.addFile(newFileData);
        console.log(`[/api/files/upload-generated] Saved file ${fileName}`);
        res.status(201).json(newFile);
    } catch (error) {
        console.error('Error saving generated file:', error);
        res.status(500).json({ message: `Ошибка при сохранении файла: ${error.message}` });
    }
});

apiRouter.post('/files/upload', upload.array('files'), (req, res) => {
    const addedFiles = [];
    // Reverse to keep chronological order when prepending
    req.files.reverse().forEach(file => {
        const newFileData = {
            name: file.originalname,
            url: `/uploads/${file.filename}`,
            mimeType: file.mimetype,
            tags: [],
            isAnalyzing: false,
        };
        const newFile = db.addFile(newFileData, true); // prepend
        addedFiles.push(newFile);
    });
    res.status(201).json(addedFiles);
});

apiRouter.delete('/files/:id', (req, res) => {
    const fileId = parseInt(req.params.id, 10);
    const deletedFile = db.deleteFile(fileId);
    if (!deletedFile) return res.status(404).json({ message: 'Файл не найден.' });
    
    try {
        const filePath = path.join(__dirname, 'uploads', path.basename(deletedFile.url));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch(err) {
        console.error("Error deleting file from disk:", err);
    }
    res.status(200).json({ message: 'Файл удален.' });
});

apiRouter.post('/files/analyze/:id', async (req, res) => {
    const fileId = parseInt(req.params.id, 10);
    const file = db.getFileById(fileId);
    if (!file) return res.status(404).json({ message: 'Файл не найден.' });

    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен." });
    }
    if (!file.mimeType.startsWith('image/')) {
        return res.status(400).json({ message: "Анализ возможен только для изображений." });
    }

    try {
        db.updateFile(fileId, { isAnalyzing: true });
        const filePath = path.join(__dirname, 'uploads', path.basename(file.url));
        const imageBytes = fs.readFileSync(filePath).toString('base64');
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `Ты - AI-ассистент SMM-менеджера. Твоя задача - проанализировать изображение и предложить 3-5 релевантных тегов на русском языке. Теги должны быть короткими, емкими и полезными для поиска этого изображения в будущем. Ответь СТРОГО в формате JSON-массива строк. Например: ["уют", "кофе", "осень", "девушка"]. Не добавляй никакого текста до или после JSON.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{ inlineData: { data: imageBytes, mimeType: file.mimeType } }],
            },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
        });

        const jsonStr = response.text.trim();
        const tags = JSON.parse(jsonStr);
        
        const currentFile = db.getFileById(fileId);
        const updatedTags = [...new Set([...currentFile.tags, ...tags])];
        const updatedFile = db.updateFile(fileId, { tags: updatedTags, isAnalyzing: false });

        console.log(`[/api/files/analyze] Generated tags for file ${fileId}:`, tags);
        res.json(updatedFile);

    } catch (error) {
        console.error(`Error analyzing file ${fileId}:`, error);
        db.updateFile(fileId, { isAnalyzing: false });
        res.status(500).json({ message: `Ошибка AI-анализа: ${error.message}` });
    }
});

apiRouter.get('/knowledge', (req, res) => res.json(db.getKnowledgeBaseItems()));

apiRouter.post('/knowledge/upload-doc', upload.single('document'), (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: 'Файл не был загружен.' });
    }
    const newDocData = {
        type: 'document',
        name: file.originalname,
        url: `/uploads/${file.filename}`,
    };
    const newDoc = db.addKnowledgeBaseItem(newDocData);
    res.status(201).json(newDoc);
});

apiRouter.post('/knowledge/add-link', (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return res.status(400).json({ message: 'Требуется корректный URL.' });
    }
    const newLinkData = {
        type: 'link',
        name: url,
        url: url,
    };
    const newLink = db.addKnowledgeBaseItem(newLinkData);
    res.status(201).json(newLink);
});

apiRouter.delete('/knowledge/:id', (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    const deletedItem = db.deleteKnowledgeBaseItem(itemId);
    if (!deletedItem) {
        return res.status(404).json({ message: 'Элемент не найден.' });
    }
    if (deletedItem.type === 'document') {
         try {
            const filePath = path.join(__dirname, 'uploads', path.basename(deletedItem.url));
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch(err) {
            console.error("Error deleting document file from disk:", err);
        }
    }
    res.status(200).json({ message: 'Элемент удален.' });
});


apiRouter.get('/settings', (req, res) => res.json(db.getSettings()));

apiRouter.post('/settings/telegram', (req, res) => {
    const { token, chatId } = req.body;
    if (!token || !chatId) {
        return res.status(400).json({ message: 'Требуется токен и ID чата.' });
    }
    const updatedSettings = db.updateSettings({ telegram: { token, chatId } });
    console.log('[/api/settings/telegram] Telegram settings updated.');
    res.status(200).json(updatedSettings);
});


apiRouter.get('/comments', (req, res) => res.json(db.getComments()));

apiRouter.put('/comments/:id', (req, res) => {
    const commentId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!db.getCommentById(commentId)) {
        return res.status(404).json({ message: 'Комментарий не найден.' });
    }
    if (!['unanswered', 'answered', 'archived', 'spam', 'hidden'].includes(status)) {
        return res.status(400).json({ message: 'Неверный статус.' });
    }
    
    const updatedComment = db.updateComment(commentId, { status });
    console.log(`[/api/comments/:id] Comment ${commentId} status updated to ${status}.`);
    res.json(updatedComment);
});

// --- AI Comment Moderation ---
const moderateComment = async (text) => {
     if (!process.env.API_KEY) {
        console.error("Gemini API key is not set for moderation.");
        return false; // Default to not spam if AI is not available
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `Ты - AI-модератор комментариев. Твоя задача - определить, является ли комментарий спамом.
        Спам - это:
        - Прямая реклама товаров или услуг, не связанных с темой.
        - Ссылки на сторонние ресурсы с призывом перейти.
        - Бессмысленный набор символов.
        - Оскорбления или агрессивное поведение.
        Ответь СТРОГО "true", если это спам, и "false", если это не спам. Не добавляй никаких других слов или объяснений.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Проанализируй этот комментарий: "${text}"`,
            config: { systemInstruction },
        });

        const result = response.text.trim().toLowerCase();
        return result === 'true';

    } catch (error) {
        console.error("Error during comment moderation:", error);
        return false; // Default to not spam on error
    }
};

const generateSuggestedReply = async (commentText) => {
    const brandSettings = db.getSettings();
    if (!process.env.API_KEY) {
        console.error("Gemini API key is not set for auto-reply.");
        return null;
    }
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `Ты - AI-ассистент комьюнити-менеджера. Проанализируй комментарий. Если это простой, типовой вопрос (о цене, доставке, наличии, характеристиках), на который можно ответить, используя общие знания о бизнесе и предоставленный "голос бренда", то напиши краткий и вежливый ответ. Если это комплимент, сложное мнение, риторический или неуместный вопрос, верни СТРОГО И ТОЛЬКО строку "NO_REPLY".`;
        
        const prompt = `**Голос бренда:** ${JSON.stringify(brandSettings)}. **Комментарий пользователя:** "${commentText}".`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction },
        });

        const replyText = response.text.trim();
        if (replyText === 'NO_REPLY') {
            return null;
        }
        return replyText;

    } catch (error) {
        console.error("Error generating suggested reply:", error);
        return null;
    }
};

apiRouter.post('/comments/simulate-new', async (req, res) => {
    const newMockComments = [
        { author: 'SpeedyBot', text: 'Заработай миллион за 5 минут! Переходи по ссылке в моем профиле! #деньги #успех' },
        { author: 'Анна К.', text: 'Очень полезная информация, спасибо! Как раз искала что-то подобное.' },
        { author: 'Виктор_92', text: 'А когда будет следующий пост на эту тему?' },
        { author: 'Марина_П', text: 'Какая цена у этого свитера и есть ли доставка в Санкт-Петербург?' },
    ];

    const processedComments = [];

    for (const mock of newMockComments) {
        const isSpam = await moderateComment(mock.text);
        let suggestedReply = null;
        
        if (!isSpam) {
            suggestedReply = await generateSuggestedReply(mock.text);
        }

        const newCommentData = {
            postId: 4, // Attach to a known post for simplicity
            author: mock.author,
            text: mock.text,
            timestamp: new Date().toISOString(),
            status: isSpam ? 'spam' : 'unanswered',
            suggestedReply: suggestedReply
        };
        const newComment = db.addComment(newCommentData);
        processedComments.push(newComment);
    }
    
    res.status(201).json(processedComments);
});

apiRouter.get('/notifications', (req, res) => res.json(db.getNotifications()));
apiRouter.post('/notifications/read', (req, res) => {
    db.markAllNotificationsAsRead();
    res.status(200).json({ message: 'Все уведомления помечены как прочитанные.' });
});

// --- Ad Dashboard Routes ---
apiRouter.get('/ad-accounts', (req, res) => res.json(db.getAdAccounts()));
apiRouter.get('/ad-campaigns/:accountId', (req, res) => {
    const accountId = parseInt(req.params.accountId, 10);
    const campaigns = db.getAdCampaignsByAccountId(accountId);
    res.json(campaigns);
});


// --- Team Management Routes ---
apiRouter.get('/team', (req, res) => res.json(db.getTeamMembers()));

apiRouter.post('/team/invite', (req, res) => {
    const { email } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ message: 'Требуется корректный email.' });
    }
    if (db.findTeamMemberByEmail(email)) {
        return res.status(409).json({ message: 'Пользователь с таким email уже в команде.' });
    }
    const newMemberData = {
        email,
        role: 'Гость',
    };
    const newMember = db.addTeamMember(newMemberData);
    
    const notification = { 
        message: `Пользователь ${email} приглашен в команду.`, 
        timestamp: new Date().toISOString(), 
        read: false, 
        link: { screen: 'settings' } 
    };
    db.addNotification(notification);

    res.status(201).json(newMember);
});

apiRouter.put('/team/:id', (req, res) => {
    const memberId = parseInt(req.params.id, 10);
    const { role } = req.body;
    const member = db.getTeamMemberById(memberId);

    if (!member) {
        return res.status(404).json({ message: 'Участник не найден.' });
    }
    if (member.role === 'Владелец') {
        return res.status(403).json({ message: 'Нельзя изменить роль владельца.' });
    }
    if (!['SMM-менеджер', 'Гость'].includes(role)) {
        return res.status(400).json({ message: 'Некорректная роль.' });
    }
    
    const notification = { 
        message: `Роль для ${member.email} изменена на "${role}".`, 
        timestamp: new Date().toISOString(), 
        read: false, 
        link: { screen: 'settings' } 
    };
    db.addNotification(notification);

    const updatedMember = db.updateTeamMember(memberId, { role });
    res.json(updatedMember);
});

apiRouter.delete('/team/:id', (req, res) => {
    const memberId = parseInt(req.params.id, 10);
    const member = db.getTeamMemberById(memberId);
    if (!member) {
        return res.status(404).json({ message: 'Участник не найден.' });
    }
    if (member.role === 'Владелец') {
        return res.status(403).json({ message: 'Нельзя удалить владельца.' });
    }

    db.deleteTeamMember(memberId);
    
    const notification = { 
        message: `Пользователь ${member.email} удален из команды.`, 
        timestamp: new Date().toISOString(), 
        read: false, 
        link: { screen: 'settings' } 
    };
    db.addNotification(notification);

    res.status(200).json({ message: 'Участник удален.' });
});

// Register the secure router for all other API calls
app.use('/api', apiRouter);


// --- STATIC FILE SERVING (Must be after API routes) ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const frontendDistPath = path.join(__dirname, '..', 'dist');
app.use(express.static(frontendDistPath));

// --- CATCH-ALL ROUTE for SPA ---
app.get('*', (req, res) => {
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend not built yet. Run `npm run build` in the root directory.');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Backend server running on http://0.0.0.0:${PORT}`);
    console.log(`   Сервер доступен для внешних подключений.`);
    console.log(`   Если сайт не открывается, проверьте брандмауэр (firewall) на сервере.`);
    console.log(`   Для Ubuntu/Debian, выполните: sudo ufw allow ${PORT}/tcp`);
});