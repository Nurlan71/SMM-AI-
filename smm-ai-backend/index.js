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
authRouter.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email и пароль обязательны.' });
    }
    try {
        const existingUser = await db.findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: 'Пользователь с таким email уже существует.' });
        }
        await db.addUser({ email, password });
        res.status(201).json({ message: 'Пользователь успешно зарегистрирован.' });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера.' });
    }
});

authRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.findUserByEmail(email);
        if (!user || user.password !== password) { // In a real app, use bcrypt to compare passwords
            return res.status(401).json({ message: 'Неверный email или пароль.' });
        }
        const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера.' });
    }
});

// Mount the public router
app.use('/api/auth', authRouter);


// --- SECURE API ROUTES ---
// Apply auth middleware to all routes in this router
apiRouter.use(authMiddleware);

apiRouter.post('/generate-campaign', async (req, res) => {
    const { goal, description, postCount } = req.body;
    
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const settings = await db.getSettings();
        const GOALS = [
            { id: 'awareness', title: 'Повысить узнаваемость' },
            { id: 'followers', title: 'Привлечь подписчиков' },
            { id: 'sales', title: 'Увеличить продажи' },
            { id: 'launch', title: 'Анонсировать событие' },
            { id: 'content', title: 'Просто создать контент' },
        ];
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const selectedGoal = GOALS.find(g => g.id === goal)?.title || 'Не указана';

        const availablePlatforms = (settings && settings.platforms && settings.platforms.length > 0)
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
        - **Tone of Voice:** ${settings.tone_of_voice}
        - **Ключевые слова:** ${settings.keywords}
        - **Целевая аудитория:** ${settings.target_audience}
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
        res.json(generatedPosts);

    } catch (error) {
        console.error('Error in /api/generate-campaign:', error);
        res.status(500).json({ message: `Ошибка при обращении к AI: ${error.message}` });
    }
});

apiRouter.post('/generate-post', async (req, res) => {
    const { topic, postType, keywords, toneOfVoice, variantCount, model, useMemory } = req.body;

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
        
        if (useMemory) {
            const brandSettings = await db.getSettings();
            prompt += `
            ---
            **Обязательно следуй этим правилам голоса бренда:**
            - **Стиль общения (Tone of Voice):** ${brandSettings.tone_of_voice}
            - **Целевая аудитория:** ${brandSettings.target_audience}
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
     if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const brandSettings = await db.getSettings();
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `Ты - эксперт комьюнити-менеджер. Твоя задача - написать дружелюбный и полезный ответ на комментарий пользователя, строго следуя голосу бренда. Ответ должен быть по существу, позитивным и вовлекающим. Не используй приветствия вроде "Здравствуйте" или "Привет", а сразу переходи к сути ответа.`;

        const prompt = `
        **Контекст (оригинальный пост):**
        ${postContent}

        **Комментарий пользователя, на который нужно ответить:**
        ${commentText}

        ---
        **Правила "Голоса бренда", которым нужно следовать:**
        - **Стиль общения (Tone of Voice):** ${brandSettings.tone_of_voice}
        - **Целевая аудитория:** ${brandSettings.target_audience}
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
                responseModalities: ['IMAGE'],
            },
        });

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
            const brandSettings = await db.getSettings();
             prompt += `
            ---
            **Контекст "Голоса Бренда" для учета:**
            - **Стиль общения (Tone of Voice):** ${brandSettings.tone_of_voice}
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
    const { topic, model } = req.body;
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
            .map(chunk => ({ uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri }))
            .filter((source, index, self) => index === self.findIndex((s) => s.uri === source.uri));
        res.json({ trends: trendData, sources });

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
            .filter((source, index, self) => index === self.findIndex((s) => s.uri === source.uri));
        res.json({ analysis: analysisData, sources });

    } catch (error) {
        console.error('Error in /api/analyze-competitors:', error);
        res.status(500).json({ message: `Ошибка при анализе конкурентов: ${error.message}` });
    }
});


apiRouter.post('/adapt-content', async (req, res) => {
    const { sourceText, targetPlatform, model, useMemory } = req.body;
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
            const brandSettings = await db.getSettings();
             prompt += `
            ---
            **Контекст "Голоса Бренда" для учета:**
            - **Стиль общения (Tone of Voice):** ${brandSettings.tone_of_voice}
            - **Целевая аудитория:** ${brandSettings.target_audience}
            `;
        }

        const response = await ai.models.generateContent({
            model: model || 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction },
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
            config: { systemInstruction },
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
        - Проанализируй JSON-массив постов, обращая внимание на 'publish_date' (время публикации), 'likes_count' (лайки) и 'comments_count' (комментарии).
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

apiRouter.get('/analytics', async (req, res) => {
    try {
        const { period = '30d', compare = 'false' } = req.query;
        const posts = await db.getPosts();
        const days = period === '7d' ? 7 : 30;
        const now = new Date();

        const getStatsForPeriod = (startDate, endDate) => {
            const filteredPosts = posts.filter(p => {
                if (p.status !== 'published' || !p.publishDate) return false;
                const publishDate = new Date(p.publishDate);
                return publishDate >= startDate && publishDate < endDate;
            });

            const totalStats = filteredPosts.reduce((acc, post) => {
                acc.likes += post.likesCount || 0;
                acc.comments += post.commentsCount || 0;
                acc.views += post.viewsCount || 0;
                return acc;
            }, { likes: 0, comments: 0, views: 0 });

            const platformPerformance = filteredPosts.reduce((acc, post) => {
                if (!acc[post.platform]) {
                    acc[post.platform] = { posts: 0, likes: 0, comments: 0 };
                }
                acc[post.platform].posts += 1;
                acc[post.platform].likes += post.likesCount || 0;
                acc[post.platform].comments += post.commentsCount || 0;
                return acc;
            }, {});
            
            const sortedPlatforms = Object.entries(platformPerformance)
                .sort(([, a], [, b]) => b.likes - a.likes)
                .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

            const topPosts = [...filteredPosts]
                .sort((a, b) => (b.likesCount + b.commentsCount) - (a.likesCount + a.commentsCount))
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
    } catch(err) {
        console.error('Error fetching analytics:', err);
        res.status(500).json({ message: 'Ошибка получения данных аналитики' });
    }
});

apiRouter.get('/posts', async (req, res) => res.json(await db.getPosts()));

apiRouter.post('/posts', async (req, res) => {
    const { content, platform, status } = req.body;
    if (!content) return res.status(400).json({ message: 'Требуется контент поста.' });
    
    const newPostData = {
        platform: platform || 'instagram',
        content: content,
        status: status || 'idea',
    };
    const newPost = await db.addPost(newPostData);
    res.status(201).json(newPost);
});

apiRouter.post('/posts/ab-test', async (req, res) => {
    const { variants } = req.body;
    if (!variants || !Array.isArray(variants) || variants.length < 2) {
        return res.status(400).json({ message: 'Для A/B теста требуется как минимум 2 варианта.' });
    }

    const variantsWithStats = variants.map(text => ({
        text,
        likes_count: Math.floor(Math.random() * 100) + 10,
        comments_count: Math.floor(Math.random() * 20) + 2,
    }));

    const newPostData = {
        content: `A/B Тест: ${variants[0].substring(0, 50)}...`,
        isAbTest: true,
        variants: variantsWithStats,
    };
    const newPost = await db.addPost(newPostData);
    res.status(201).json(newPost);
});


apiRouter.put('/posts/:id', async (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const post = await db.getPostById(postId);
    if (!post) return res.status(404).json({ message: 'Пост не найден.' });
    
    const updatedPost = await db.updatePost(postId, req.body);
    res.json(updatedPost);
});

apiRouter.put('/posts/:id/end-ab-test', async (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const { winnerVariantText } = req.body;
    const post = await db.getPostById(postId);

    if (!post) return res.status(404).json({ message: 'Пост не найден.' });
    if (!post.isAbTest) return res.status(400).json({ message: 'Это не A/B-тест.' });
    if (!winnerVariantText) return res.status(400).json({ message: 'Необходимо указать текст победившего варианта.' });

    const updatedData = {
        content: winnerVariantText,
        isAbTest: false,
        variants: null,
    };
    const updatedPost = await db.updatePost(postId, updatedData);
    res.json(updatedPost);
});

apiRouter.post('/posts/:id/publish', async (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const post = await db.getPostById(postId);
    if (!post) return res.status(404).json({ message: 'Пост не найден.' });

    if (post.platform !== 'telegram') return res.status(400).json({ message: 'Публикация доступна только для Telegram.' });

    const { telegram } = await db.getSettings();
    if (!telegram || !telegram.token || !telegram.chatId) {
        return res.status(400).json({ message: 'Данные для Telegram не настроены.' });
    }

    try {
        if (post.media && post.media.length > 0) {
            const imagePath = path.join(__dirname, path.basename(post.media[0]));
            if (!fs.existsSync(imagePath)) throw new Error(`Файл не найден: ${imagePath}`);
            const formData = new FormData();
            formData.append('chat_id', telegram.chatId);
            formData.append('photo', fs.createReadStream(imagePath));
            formData.append('caption', post.content);
            await axios.post(`https://api.telegram.org/bot${telegram.token}/sendPhoto`, formData, { headers: formData.getHeaders() });
        } else {
            await axios.post(`https://api.telegram.org/bot${telegram.token}/sendMessage`, { chat_id: telegram.chatId, text: post.content });
        }
        
        const updatedPost = await db.updatePost(postId, { status: 'published', publishDate: new Date() });
        res.json(updatedPost);
    } catch (error) {
        console.error('Telegram API Error:', error.response?.data || error.message);
        res.status(500).json({ message: `Ошибка публикации: ${error.response?.data?.description || error.message}` });
    }
});

apiRouter.delete('/posts/:id', async (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const deleted = await db.deletePost(postId);
    if (!deleted) return res.status(404).json({ message: 'Пост не найден.' });
    res.status(200).json({ message: 'Пост успешно удален.' });
});

apiRouter.get('/files', async (req, res) => res.json(await db.getFiles()));

apiRouter.post('/files/upload-generated', async (req, res) => {
    const { base64Image, originalPrompt } = req.body;
    if (!base64Image) return res.status(400).json({ message: 'Требуются данные изображения.' });

    try {
        const fileContents = Buffer.from(base64Image, 'base64');
        const fileName = `${Date.now()}-ai-generated.jpeg`;
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, fileName), fileContents);
        
        const newFile = await db.addFile({
            name: originalPrompt ? `${originalPrompt.substring(0, 30).trim()}.jpeg` : fileName,
            url: `/uploads/${fileName}`,
            mime_type: 'image/jpeg',
            tags: ['ai-generated'],
        });
        res.status(201).json(newFile);
    } catch (error) {
        res.status(500).json({ message: `Ошибка при сохранении файла: ${error.message}` });
    }
});

apiRouter.post('/files/upload', upload.array('files'), async (req, res) => {
    const addedFiles = [];
    for (const file of req.files.reverse()) {
        const newFile = await db.addFile({
            name: file.originalname,
            url: `/uploads/${file.filename}`,
            mime_type: file.mimetype,
        }, true);
        addedFiles.push(newFile);
    }
    res.status(201).json(addedFiles);
});

apiRouter.delete('/files/:id', async (req, res) => {
    const fileId = parseInt(req.params.id, 10);
    const deletedFile = await db.deleteFile(fileId);
    if (!deletedFile) return res.status(404).json({ message: 'Файл не найден.' });
    
    try {
        const filePath = path.join(__dirname, 'uploads', path.basename(deletedFile.url));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch(err) { console.error("Error deleting file:", err); }
    res.status(200).json({ message: 'Файл удален.' });
});

apiRouter.post('/files/analyze/:id', async (req, res) => {
    const fileId = parseInt(req.params.id, 10);
    const file = await db.getFileById(fileId);
    if (!file) return res.status(404).json({ message: 'Файл не найден.' });

    if (!process.env.API_KEY) return res.status(500).json({ message: "API ключ не настроен." });
    if (!file.mime_type.startsWith('image/')) return res.status(400).json({ message: "Анализ возможен только для изображений." });

    try {
        await db.updateFile(fileId, { isAnalyzing: true });
        const filePath = path.join(__dirname, 'uploads', path.basename(file.url));
        const imageBytes = fs.readFileSync(filePath).toString('base64');
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `Ты - AI-ассистент. Проанализируй изображение и предложи 3-5 тегов на русском. Ответь СТРОГО в формате JSON-массива строк.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ inlineData: { data: imageBytes, mimeType: file.mime_type } }] },
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
        });

        const tags = JSON.parse(response.text.trim());
        const currentFile = await db.getFileById(fileId);
        const updatedTags = [...new Set([...(currentFile.tags || []), ...tags])];
        const updatedFile = await db.updateFile(fileId, { tags: updatedTags, isAnalyzing: false });
        res.json(updatedFile);
    } catch (error) {
        await db.updateFile(fileId, { isAnalyzing: false });
        res.status(500).json({ message: `Ошибка AI-анализа: ${error.message}` });
    }
});

apiRouter.get('/knowledge', async (req, res) => res.json(await db.getKnowledgeBaseItems()));

apiRouter.post('/knowledge/upload-doc', upload.single('document'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Файл не был загружен.' });
    
    const newItem = await db.addKnowledgeBaseItem({
        type: 'document',
        name: req.file.originalname,
        url: `/uploads/${req.file.filename}`,
    });
    res.status(201).json(newItem);
});

apiRouter.post('/knowledge/add-link', async (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith('http')) return res.status(400).json({ message: 'Требуется корректный URL.' });
    
    const newLink = await db.addKnowledgeBaseItem({ type: 'link', name: url, url });
    res.status(201).json(newLink);
});

apiRouter.delete('/knowledge/:id', async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    const deletedItem = await db.deleteKnowledgeBaseItem(itemId);
    if (!deletedItem) return res.status(404).json({ message: 'Элемент не найден.' });
    
    if (deletedItem.type === 'document') {
         try {
            const filePath = path.join(__dirname, 'uploads', path.basename(deletedItem.url));
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch(err) { console.error("Error deleting document:", err); }
    }
    res.status(200).json({ message: 'Элемент удален.' });
});

apiRouter.get('/settings', async (req, res) => res.json(await db.getSettings()));

apiRouter.post('/settings/telegram', async (req, res) => {
    const { token, chatId } = req.body;
    if (!token || !chatId) return res.status(400).json({ message: 'Требуется токен и ID чата.' });
    
    const currentSettings = await db.getSettings();
    const updatedSettings = await db.updateSettings({ ...currentSettings, telegram: { token, chatId } });
    res.status(200).json(updatedSettings);
});

apiRouter.get('/comments', async (req, res) => res.json(await db.getComments()));

apiRouter.put('/comments/:id', async (req, res) => {
    const commentId = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!await db.getCommentById(commentId)) return res.status(404).json({ message: 'Комментарий не найден.' });
    if (!['unanswered', 'answered', 'archived', 'spam', 'hidden'].includes(status)) return res.status(400).json({ message: 'Неверный статус.' });
    
    const updatedComment = await db.updateComment(commentId, { status });
    res.json(updatedComment);
});

const moderateComment = async (text) => {
     if (!process.env.API_KEY) return false;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `Ты - AI-модератор. Определи, является ли комментарий спамом. Ответь СТРОГО "true", если это спам, и "false", если нет.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Проанализируй: "${text}"`,
            config: { systemInstruction },
        });
        return response.text.trim().toLowerCase() === 'true';
    } catch (error) {
        return false;
    }
};

const generateSuggestedReply = async (commentText) => {
    if (!process.env.API_KEY) return null;
    try {
        const brandSettings = await db.getSettings();
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `Ты - AI-ассистент. Если комментарий - простой вопрос (о цене, доставке и т.д.), напиши краткий ответ, следуя голосу бренда. Если это мнение или сложный вопрос, верни СТРОГО И ТОЛЬКО строку "NO_REPLY".`;
        const prompt = `**Голос бренда:** ${JSON.stringify(brandSettings)}. **Комментарий:** "${commentText}".`;
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction } });
        const replyText = response.text.trim();
        return replyText === 'NO_REPLY' ? null : replyText;
    } catch (error) {
        return null;
    }
};

apiRouter.post('/comments/simulate-new', async (req, res) => {
    const mocks = [
        { author: 'SpeedyBot', text: 'Заработай миллион! Ссылка в профиле! #деньги' },
        { author: 'Анна К.', text: 'Очень полезно, спасибо!' },
        { author: 'Виктор_92', text: 'А когда следующий пост?' },
        { author: 'Марина_П', text: 'Какая цена и есть ли доставка в СПб?' },
    ];

    const processed = [];
    for (const mock of mocks) {
        const isSpam = await moderateComment(mock.text);
        const suggestedReply = !isSpam ? await generateSuggestedReply(mock.text) : null;
        const newComment = await db.addComment({
            postId: 4, author: mock.author, text: mock.text,
            status: isSpam ? 'spam' : 'unanswered',
            suggestedReply: suggestedReply
        });
        processed.push(newComment);
    }
    res.status(201).json(processed);
});

apiRouter.get('/notifications', async (req, res) => res.json(await db.getNotifications()));
apiRouter.post('/notifications/read', async (req, res) => {
    await db.markAllNotificationsAsRead();
    res.status(200).json({ message: 'Все уведомления помечены как прочитанные.' });
});

apiRouter.get('/ad-accounts', async (req, res) => res.json(await db.getAdAccounts()));
apiRouter.get('/ad-campaigns/:accountId', async (req, res) => {
    const accountId = parseInt(req.params.accountId, 10);
    res.json(await db.getAdCampaignsByAccountId(accountId));
});

apiRouter.post('/ads/recommendations', async (req, res) => {
    const { account, campaigns } = req.body;
     if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }
    if (!account || !campaigns || campaigns.length === 0) {
        return res.status(400).json({ message: 'Нет данных для анализа.' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `Ты - ведущий аналитик по таргетированной рекламе. Твоя задача - проанализировать данные по рекламному аккаунту и его кампаниям, составить краткий, понятный отчет для SMM-менеджера.
        - Отчет должен быть в формате Markdown.
        - **Структура отчета:**
          1.  **Общий анализ аккаунта:** Краткое резюме по ключевым метрикам (общий расход, клики, показы).
          2.  **Лучшие кампании:** Выдели 1-2 кампании, которые показывают наилучшие результаты (например, по CTR или стоимости клика). Объясни, почему они успешны.
          3.  **Зоны роста:** Определи 1-2 кампании с низкой эффективностью. Предположи, почему так происходит.
          4.  **Рекомендации:** Дай 2-3 конкретных, выполнимых рекомендации по оптимизации (например: "Перераспределить бюджет с кампании X на Y", "Приостановить кампанию Z и пересмотреть креативы").
        - Стиль отчета: деловой, но ясный и лаконичный. Используй списки и выделение жирным.`;

        const prompt = `Вот данные для анализа:
        - **Рекламный аккаунт:** ${JSON.stringify(account, null, 2)}
        - **Рекламные кампании:** ${JSON.stringify(campaigns, null, 2)}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction },
        });
        
        const reportText = response.text;
        res.json({ report: reportText });

    } catch (error) {
        console.error('Error in /api/ads/recommendations:', error);
        res.status(500).json({ message: `Ошибка при генерации рекомендаций: ${error.message}` });
    }
});

apiRouter.get('/team', async (req, res) => res.json(await db.getTeamMembers()));

apiRouter.post('/team/invite', async (req, res) => {
    const { email } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ message: 'Требуется корректный email.' });
    if (await db.findTeamMemberByEmail(email)) return res.status(409).json({ message: 'Пользователь уже в команде.' });
    
    const newMember = await db.addTeamMember({ email, role: 'Гость' });
    await db.addNotification({ message: `Пользователь ${email} приглашен в команду.`, link: { screen: 'settings' } });
    res.status(201).json(newMember);
});

apiRouter.put('/team/:id', async (req, res) => {
    const memberId = parseInt(req.params.id, 10);
    const { role } = req.body;
    const member = await db.getTeamMemberById(memberId);

    if (!member) return res.status(404).json({ message: 'Участник не найден.' });
    if (member.role === 'Владелец') return res.status(403).json({ message: 'Нельзя изменить роль владельца.' });
    if (!['SMM-менеджер', 'Гость'].includes(role)) return res.status(400).json({ message: 'Некорректная роль.' });
    
    const updatedMember = await db.updateTeamMember(memberId, { role });
    await db.addNotification({ message: `Роль для ${member.email} изменена на "${role}".`, link: { screen: 'settings' } });
    res.json(updatedMember);
});

apiRouter.delete('/team/:id', async (req, res) => {
    const memberId = parseInt(req.params.id, 10);
    const member = await db.getTeamMemberById(memberId);
    if (!member) return res.status(404).json({ message: 'Участник не найден.' });
    if (member.role === 'Владелец') return res.status(403).json({ message: 'Нельзя удалить владельца.' });

    await db.deleteTeamMember(memberId);
    await db.addNotification({ message: `Пользователь ${member.email} удален из команды.`, link: { screen: 'settings' } });
    res.status(200).json({ message: 'Участник удален.' });
});

app.use('/api', apiRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const frontendDistPath = path.join(__dirname, '..', 'dist');
app.use(express.static(frontendDistPath));
app.get('*', (req, res) => {
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend not built yet. Run `npm run build` in the root directory.');
    }
});

// Wrap startup in an async function to initialize DB first
const startServer = async () => {
    try {
        await db.initializeDb();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Backend server running on http://0.0.0.0:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};

startServer();