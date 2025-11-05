
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

console.log('--- Запуск новой версии SMM AI Backend ---');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-super-secret-key-for-smm-ai-app';

// --- НАСТРОЙКА ХРАНИЛИЩА ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s/g, '_'));
    }
});
const upload = multer({ storage: storage });

// --- MIDDLEWARE ЛОГИРОВАНИЯ ЗАПРОСОВ ---
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Входящий запрос: ${req.method} ${req.originalUrl}`);
    next();
});

// --- ГЛОБАЛЬНЫЕ MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// --- БАЗА ДАННЫХ В ПАМЯТИ ---
let users = [
    { id: 1, email: 'dev@smm.ai', passwordHash: bcrypt.hashSync('password', 10) }
];
let postsData = [];
let filesData = [];
let commentsData = [];
let settingsData = {
    toneOfVoice: "Дружелюбный и экспертный. Обращаемся к клиентам на 'вы', используем эмодзи для настроения.",
    keywords: "ключевые: #одеждаручнойработы, #натуральныеткани; стоп-слова: дешевый, скидка",
    targetAudience: "Женщины 25-45 лет, ценящие уют, натуральные материалы и ручную работу. Интересуются модой, но предпочитают классику и качество.",
    brandVoiceExamples: [],
    platforms: ['instagram', 'telegram', 'vk'],
};
let nextPostId = 1;
let nextFileId = 1;
let nextCommentId = 1;

// --- MIDDLEWARE АУТЕНТИФИКАЦИИ ---
const authMiddleware = (req, res, next) => {
    console.log(`-> Запущена проверка аутентификации для ${req.originalUrl}`);
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('--> Ошибка: токен не предоставлен.');
        return res.status(401).json({ message: 'Токен не предоставлен или неверный формат.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = users.find(u => u.id === decoded.id);
        if (!req.user) {
            console.log('--> Ошибка: пользователь по токену не найден.');
            return res.status(401).json({ message: 'Пользователь не найден.' });
        }
        console.log(`--> Успех: пользователь ${req.user.email} авторизован.`);
        next();
    } catch (error) {
        console.log('--> Ошибка: недействительный токен.');
        res.status(401).json({ message: 'Недействительный токен.' });
    }
};

// --- МАРШРУТЫ АУТЕНТИФИКАЦИИ (НЕЗАЩИЩЕННЫЕ) ---
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email и пароль обязательны.' });
    if (users.find(u => u.email === email)) return res.status(400).json({ message: 'Пользователь с таким email уже существует.' });
    
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = { id: users.length + 1, email, passwordHash };
    users.push(newUser);
    res.status(201).json({ message: 'Пользователь успешно зарегистрирован.' });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ message: 'Пользователь не найден.' });
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Неверный пароль.' });
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
});

// --- ПРИМЕНЕНИЕ MIDDLEWARE АУТЕНТИФИКАЦИИ КО ВСЕМ СЛЕДУЮЩИМ МАРШРУТАМ /api ---
app.use('/api', authMiddleware);

// --- МАРШРУТЫ API (ЗАЩИЩЕННЫЕ) ---

// API: ПОСТЫ
app.get('/api/posts', (req, res) => res.json(postsData));
app.post('/api/posts', (req, res) => {
    const { topic, postType, description, status, date, content, attachedImageUrl } = req.body;
    const newPost = { id: nextPostId++, topic, postType, description, status, date, content, attachedImageUrl: attachedImageUrl || null };
    postsData.push(newPost);
    res.status(201).json(newPost);
});
app.put('/api/posts/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const index = postsData.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ message: 'Пост не найден' });
    postsData[index] = { ...postsData[index], ...req.body, id: id };
    res.json(postsData[index]);
});
app.delete('/api/posts/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    postsData = postsData.filter(p => p.id !== id);
    res.status(204).send();
});

// API: ФАЙЛЫ
app.get('/api/files', (req, res) => res.json(filesData));
app.post('/api/files', upload.array('files'), (req, res) => {
    const uploadedFiles = req.files.map(file => {
        const newFile = {
            id: nextFileId++,
            name: file.originalname,
            url: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`,
            mimeType: file.mimetype, tags: [], description: '',
        };
        filesData.unshift(newFile);
        return newFile;
    });
    res.status(201).json(uploadedFiles);
});
app.delete('/api/files/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const index = filesData.findIndex(f => f.id === id);
    if (index === -1) return res.status(404).json({ message: 'Файл не найден' });
    const fileToDelete = filesData[index];
    const filename = path.basename(fileToDelete.url);
    const filePath = path.join(uploadsDir, filename);
    fs.unlink(filePath, (err) => {
        if (err) console.error('Failed to delete file from disk:', err);
        filesData.splice(index, 1);
        res.status(204).send();
    });
});

// API: КОММЕНТАРИИ
app.get('/api/comments', (req, res) => res.json(commentsData));
app.put('/api/comments/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const index = commentsData.findIndex(c => c.id === id);
    if (index === -1) return res.status(404).json({ message: 'Комментарий не найден' });
    commentsData[index] = { ...commentsData[index], ...req.body, id };
    res.json(commentsData[index]);
});
app.post('/api/comments/simulate', (req, res) => {
    const mockComments = [
        { author: 'Анна В.', text: 'Какая красота! А из какого материала сделано это платье?', platform: 'instagram' },
        { author: 'Максим Петров', text: 'Подскажите, есть ли доставка в Санкт-Петербург?', platform: 'vk' },
    ];
    const newComment = { id: nextCommentId++, status: 'new', aiTag: false, ...mockComments[Math.floor(Math.random() * mockComments.length)]};
    commentsData.unshift(newComment);
    res.status(201).json([newComment]);
});

// API: НАСТРОЙКИ
app.get('/api/settings', (req, res) => res.json(settingsData));
app.post('/api/settings', (req, res) => {
    settingsData = { ...settingsData, ...req.body };
    res.json(settingsData);
});

// API: АНАЛИТИКА
app.get('/api/analytics', (req, res) => {
    const period = parseInt(req.query.period, 10) || 30;
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const change = () => (Math.random() * 10 - 4).toFixed(1);
    res.json({
        keyMetrics: {
            subscribers: { value: rand(10000, 15000), change: change() },
            reach: { value: rand(50000, 80000), change: change() },
            engagement: { value: rand(3000, 5000), change: change() },
            clicks: { value: rand(500, 1500), change: change() },
        },
        subscriberDynamics: Array.from({ length: period }, (_, i) => ({ day: `День ${i + 1}`, value: rand(9500, 10000 + i * (5000 / period)) })),
        topPosts: [{ id: 1, topic: 'Новая коллекция', metric: rand(500, 800), platform: 'instagram' }, { id: 2, topic: 'Как ухаживать за льном', metric: rand(400, 600), platform: 'telegram' }].sort((a,b) => b.metric - a.metric),
        trafficSources: [{ source: 'Instagram', value: rand(50, 60) }, { source: 'VK', value: rand(20, 30) }, { source: 'Telegram', value: rand(10, 20) }],
    });
});

// --- ОБРАБОТЧИК 404 (должен быть в конце) ---
app.use((req, res, next) => {
    console.log(`[404] Ресурс не найден для запроса: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ message: `Ресурс не найден: ${req.method} ${req.originalUrl}` });
});

// --- ЗАПУСК СЕРВЕР ---
app.listen(PORT, () => {
    console.log(`Сервер успешно запущен и слушает порт http://localhost:${PORT}`);
});