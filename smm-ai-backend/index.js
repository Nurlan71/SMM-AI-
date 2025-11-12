const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');
const { PassThrough } = require('stream');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-super-secret-key-for-dev';

// In-memory user store for simplicity
const users = [
    { email: 'dev@smm.ai', password: 'password' }
];
let files = [];
let nextFileId = 1;

// --- MOCK DATA ---
let nextPostId = 5;
const today = new Date();
const getFutureDate = (days) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
const getPastDate = (days) => new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

let posts = [
    { id: 1, platform: 'instagram', content: 'Пост о преимуществах нашего сервиса.', media: [], status: 'scheduled', publishDate: getFutureDate(2), tags: ['сервис', 'преимущества'], comments_count: 15, likes_count: 120, views_count: 1500 },
    { id: 2, platform: 'vk', content: 'Завтра выходит наш новый продукт! Следите за анонсами.', media: [], status: 'scheduled', publishDate: getFutureDate(1), tags: ['анонс', 'продукт'], comments_count: 25, likes_count: 80, views_count: 2200 },
    { id: 3, platform: 'telegram', content: 'Еженедельный дайджест новостей SMM.', media: [], status: 'published', publishDate: getPastDate(3), tags: ['дайджест', 'smm'], comments_count: 12, likes_count: 58, views_count: 1200 },
    { id: 4, platform: 'instagram', content: 'Фотография из офиса. Как мы работаем.', media: [], status: 'published', publishDate: getPastDate(1), tags: ['команда', 'офис'], comments_count: 40, likes_count: 150, views_count: 2500 },
];

let nextCommentId = 6;
let comments = [
    { id: 1, postId: 4, author: 'Елена_Стиль', text: 'Очень уютная атмосфера у вас в офисе! Сразу видно, что работа кипит.', timestamp: getPastDate(0.5), status: 'unanswered' },
    { id: 2, postId: 4, author: 'Маркетолог_Иван', text: 'Круто! А можете рассказать подробнее про ваш стек технологий?', timestamp: getPastDate(0.4), status: 'unanswered' },
    { id: 3, postId: 1, author: 'Anna_Creative', text: 'Отличный пост! Как раз думала о ваших преимуществах. Спасибо, что рассказали.', timestamp: getFutureDate(0), status: 'answered' },
    { id: 4, postId: 3, author: 'SMM_Profi', text: 'Хороший дайджест. Все по делу.', timestamp: getPastDate(2), status: 'archived' },
    { id: 5, postId: 4, author: 'Дизайнер_Ольга', text: 'Мне нравится ваш минималистичный интерьер.', timestamp: getPastDate(0.2), status: 'unanswered' },
]
// --- END MOCK DATA ---

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
    if (users.find(u => u.email === email)) {
        return res.status(409).json({ message: 'Пользователь с таким email уже существует.' });
    }
    users.push({ email, password });
    res.status(201).json({ message: 'Пользователь успешно зарегистрирован.' });
});

authRouter.post('/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
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
    const { goal, description, postCount, settings } = req.body;
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
        if (errorMessage.includes("API key not valid")) {
             return res.status(403).json({ message: 'Предоставленный API ключ недействителен. Пожалуйста, выберите другой ключ.' });
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
    const { projectName, projectDescription, mainGoal, targetAudience, competitors } = req.body;
     if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const systemInstruction = `Ты - SMM-стратег высшего класса. Твоя задача - создать подробную и практическую SMM-стратегию на основе данных от пользователя. Стратегия должна быть четкой, структурированной и профессиональной. Ответь СТРОГО в формате JSON-объекта согласно предоставленной схеме. Не добавляй никакого текста до или после JSON-объекта.`;
        
        const prompt = `
        **Название проекта:** ${projectName}
        **Описание проекта:** ${projectDescription}
        **Главная цель:** ${mainGoal}
        **Целевая аудитория:** ${targetAudience}
        **Конкуренты:** ${competitors || 'Не указаны'}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
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
    const { topic } = req.body;
    if (!topic) {
        return res.status(400).json({ message: 'Требуется тема для поиска трендов.' });
    }
    if (!process.env.API_KEY) {
        return res.status(500).json({ message: "API ключ не настроен на сервере." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const systemInstruction = `Ты - AI-аналитик SMM-трендов. Твоя задача - найти и проанализировать самые свежие тренды в интернете по заданной теме, используя Google Search.
        - Для каждого тренда предоставь краткое название, объяснение его сути и актуальности, а также 2-3 конкретные идеи для постов в социальных сетях.
        - Структурируй ответ в формате Markdown. Используй заголовки (##) для названий трендов.
        - Ответ должен быть ясным, лаконичным и ориентированным на практическое применение SMM-специалистом.`;

        const prompt = `Найди 3-5 актуальных трендов по теме: "${topic}"`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                tools: [{ googleSearch: {} }],
            },
        });

        const trendsText = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        const sources = groundingChunks
            .filter(chunk => chunk.web && chunk.web.uri)
            .map(chunk => ({
                uri: chunk.web.uri,
                title: chunk.web.title || chunk.web.uri,
            }));
        // Deduplicate sources
        const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());

        res.json({ trends: trendsText, sources: uniqueSources });

    } catch (error) {
        console.error('Error in /api/find-trends:', error);
        res.status(500).json({ message: `Ошибка при поиске трендов: ${error.message}` });
    }
});


apiRouter.get('/analytics', (req, res) => {
    const publishedPosts = posts.filter(p => p.status === 'published');

    const totalStats = publishedPosts.reduce((acc, post) => {
        acc.likes += post.likes_count || 0;
        acc.comments += post.comments_count || 0;
        acc.views += post.views_count || 0;
        return acc;
    }, { likes: 0, comments: 0, views: 0 });

    const platformPerformance = publishedPosts.reduce((acc, post) => {
        if (!acc[post.platform]) {
            acc[post.platform] = { posts: 0, likes: 0, comments: 0 };
        }
        acc[post.platform].posts += 1;
        acc[post.platform].likes += post.likes_count || 0;
        acc[post.platform].comments += post.comments_count || 0;
        return acc;
    }, {});
    
    // Sort platforms by total likes
    const sortedPlatforms = Object.entries(platformPerformance)
        .sort(([, a], [, b]) => b.likes - a.likes)
        .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

    const topPosts = [...publishedPosts]
        .sort((a, b) => (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count))
        .slice(0, 5);

    const analyticsData = {
        totalPosts: publishedPosts.length,
        totalLikes: totalStats.likes,
        totalComments: totalStats.comments,
        totalViews: totalStats.views,
        platformPerformance: sortedPlatforms,
        topPosts,
    };
    
    res.json(analyticsData);
});

apiRouter.get('/posts', (req, res) => res.json(posts));

apiRouter.put('/posts/:id', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
        return res.status(404).json({ message: 'Пост не найден.' });
    }
    // Ensure ID is not changed from the body
    const updatedPost = { ...posts[postIndex], ...req.body, id: postId };
    posts[postIndex] = updatedPost;
    console.log(`[/api/posts/:id] Post ${postId} updated.`);
    res.json(updatedPost);
});

apiRouter.delete('/posts/:id', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
        return res.status(404).json({ message: 'Пост не найден.' });
    }
    posts.splice(postIndex, 1);
    console.log(`[/api/posts/:id] Post ${postId} deleted.`);
    res.status(200).json({ message: 'Пост успешно удален.' });
});

apiRouter.get('/files', (req, res) => res.json(files));

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
        
        const newFile = {
            id: nextFileId++,
            name: originalPrompt ? `${originalPrompt.substring(0, 30).trim()}.jpeg` : fileName,
            url: `/uploads/${fileName}`,
            mimeType: 'image/jpeg',
            tags: ['ai-generated'],
            isAnalyzing: false,
        };
        files.unshift(newFile);
        console.log(`[/api/files/upload-generated] Saved file ${fileName}`);
        res.status(201).json(newFile);
    } catch (error) {
        console.error('Error saving generated file:', error);
        res.status(500).json({ message: `Ошибка при сохранении файла: ${error.message}` });
    }
});

apiRouter.post('/files/upload', upload.array('files'), (req, res) => {
    // Reverse to keep chronological order when prepending
    const uploadedFiles = req.files.reverse().map(file => {
        const newFile = {
            id: nextFileId++,
            name: file.originalname,
            url: `/uploads/${file.filename}`,
            mimeType: file.mimetype,
            tags: [],
            isAnalyzing: false,
        };
        files.unshift(newFile); // Prepend to show up first
        return newFile;
    });
    res.status(201).json(uploadedFiles);
});

apiRouter.delete('/files/:id', (req, res) => {
    const fileId = parseInt(req.params.id, 10);
    const fileIndex = files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return res.status(404).json({ message: 'Файл не найден.' });
    const [deletedFile] = files.splice(fileIndex, 1);
    try {
        const filePath = path.join(__dirname, 'uploads', path.basename(deletedFile.url));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch(err) {
        console.error("Error deleting file from disk:", err);
    }
    res.status(200).json({ message: 'Файл удален.' });
});

// Fix: Return default settings object instead of an empty one.
apiRouter.get('/settings', (req, res) => res.json({
    toneOfVoice: "Дружелюбный и экспертный. Обращаемся к клиентам на 'вы', используем эмоззи для настроения.",
    keywords: "ключевые: #одеждаручнойработы, #натуральныеткани; стоп-слова: дешевый, скидка",
    targetAudience: "Женщины 25-45 лет, ценящие уют, натуральные материалы и ручную работу. Интересуются модой, но предпочитают классику и качество.",
    brandVoiceExamples: [],
    platforms: ['instagram', 'telegram', 'vk'],
}));
apiRouter.get('/comments', (req, res) => res.json(comments));

apiRouter.put('/comments/:id', (req, res) => {
    const commentId = parseInt(req.params.id, 10);
    const { status } = req.body;
    const commentIndex = comments.findIndex(c => c.id === commentId);

    if (commentIndex === -1) {
        return res.status(404).json({ message: 'Комментарий не найден.' });
    }
    if (!['unanswered', 'answered', 'archived'].includes(status)) {
        return res.status(400).json({ message: 'Неверный статус.' });
    }
    
    comments[commentIndex].status = status;
    console.log(`[/api/comments/:id] Comment ${commentId} status updated to ${status}.`);
    res.json(comments[commentIndex]);
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
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
});