const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');

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
    { id: 1, platform: 'instagram', content: 'Пост о преимуществах нашего сервиса.', media: [], status: 'scheduled', publishDate: getFutureDate(2), tags: ['сервис', 'преимущества'], comments_count: 0, likes_count: 0, views_count: 0 },
    { id: 2, platform: 'vk', content: 'Завтра выходит наш новый продукт! Следите за анонсами.', media: [], status: 'scheduled', publishDate: getFutureDate(1), tags: ['анонс', 'продукт'], comments_count: 0, likes_count: 0, views_count: 0 },
    { id: 3, platform: 'telegram', content: 'Еженедельный дайджест новостей SMM.', media: [], status: 'published', publishDate: getPastDate(3), tags: ['дайджест', 'smm'], comments_count: 12, likes_count: 58, views_count: 1200 },
    { id: 4, platform: 'instagram', content: 'Фотография из офиса. Как мы работаем.', media: [], status: 'published', publishDate: getPastDate(1), tags: ['команда', 'офис'], comments_count: 25, likes_count: 150, views_count: 2500 },
];
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

// --- AUTH ROUTES ---
app.post('/api/auth/register', (req, res) => {
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

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Неверный email или пароль.' });
    }
    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});


// --- SECURE API ROUTES ---
const apiRouter = express.Router();
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
apiRouter.get('/comments', (req, res) => res.json([]));

// Register the router for all API calls
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