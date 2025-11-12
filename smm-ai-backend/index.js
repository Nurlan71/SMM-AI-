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
app.use(express.json());

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

// --- CRITICAL FIX: Direct Route Registration for /generate-campaign ---
app.post('/api/generate-campaign', authMiddleware, async (req, res) => {
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

        const systemInstruction = `Ты - эксперт SMM-менеджер. Твоя задача - создать серию постов для социальных сетей на основе запроса пользователя.
        - Проанализируй цель кампании, описание, а также общие настройки бренда (Tone of Voice, ключевые слова, целевая аудитория).
        - Создай ровно ${postCount} постов.
        - Каждый пост должен быть уникальным и соответствовать общей цели.
        - Выбери подходящую платформу для каждого поста из списка доступных: ${settings.platforms.join(', ')}.
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


// --- OTHER SECURE API ROUTES ---
const apiRouter = express.Router();
apiRouter.use(authMiddleware);

apiRouter.get('/posts', (req, res) => res.json(posts));
apiRouter.get('/files', (req, res) => res.json(files));
apiRouter.post('/files/upload', upload.array('files'), (req, res) => {
    const uploadedFiles = req.files.map(file => {
        const newFile = {
            id: nextFileId++,
            name: file.originalname,
            url: `/uploads/${file.filename}`,
            mimeType: file.mimetype,
            tags: [],
            isAnalyzing: false,
        };
        files.push(newFile);
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

apiRouter.get('/settings', (req, res) => res.json({}));
apiRouter.get('/comments', (req, res) => res.json([]));

// Register the router for other API calls
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
