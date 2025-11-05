const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-super-secret-key-for-smm-ai-app';

// --- НАСТРОЙКА ХРАНИЛИЩА ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s/g, '_'));
    }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir)); // Раздаем статику

// --- БАЗА ДАННЫХ В ПАМЯТИ ---
let users = [
    // pass: password
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Токен не предоставлен или неверный формат.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = users.find(u => u.id === decoded.id);
        if (!req.user) return res.status(401).json({ message: 'Пользователь не найден.' });
        next();
    } catch (error) {
        res.status(401).json({ message: 'Недействительный токен.' });
    }
};


// --- ЭНДПОИНТЫ АУТЕНТИФИКАЦИИ ---
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email и пароль обязательны.' });
    if (users.find(u => u.email === email)) return res.status(400).json({ message: 'Пользователь с таким email уже существует.' });
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = { id: users.length + 1, email, passwordHash };
    users.push(newUser);
    console.log('New user registered:', newUser.email);
    res.status(201).json({ message: 'Пользователь успешно зарегистрирован.' });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        return res.status(400).json({ message: 'Неверный пароль.' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
});

// --- API ПОСТОВ ---
app.get('/api/posts', authMiddleware, (req, res) => {
    res.json(postsData);
});

app.post('/api/posts', authMiddleware, (req, res) => {
    const { topic, postType, description, status, date, content } = req.body;
    const newPost = { id: nextPostId++, topic, postType, description, status, date, content };
    postsData.push(newPost);
    res.status(201).json(newPost);
});

app.put('/api/posts/:id', authMiddleware, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const index = postsData.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ message: 'Пост не найден' });
    
    const updatedPost = { ...postsData[index], ...req.body, id: id };
    postsData[index] = updatedPost;
    res.json(updatedPost);
});

app.delete('/api/posts/:id', authMiddleware, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const initialLength = postsData.length;
    postsData = postsData.filter(p => p.id !== id);
    if (postsData.length === initialLength) return res.status(404).json({ message: 'Пост не найден' });
    res.status(204).send();
});

// --- API ФАЙЛОВ ---
app.get('/api/files', authMiddleware, (req, res) => {
    res.json(filesData);
});

app.post('/api/files', authMiddleware, upload.array('files'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "Файлы не были загружены." });
    }
    const uploadedFiles = req.files.map(file => {
        const newFile = {
            id: nextFileId++,
            name: file.originalname,
            url: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`,
            mimeType: file.mimetype,
            tags: [],
            description: '',
        };
        filesData.unshift(newFile);
        return newFile;
    });
    res.status(201).json(uploadedFiles);
});

app.delete('/api/files/:id', authMiddleware, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const index = filesData.findIndex(f => f.id === id);
    if (index === -1) return res.status(404).json({ message: 'Файл не найден' });

    const fileToDelete = filesData[index];
    const filename = path.basename(fileToDelete.url);
    const filePath = path.join(uploadsDir, filename);

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Failed to delete file from disk:', err);
        }
        filesData.splice(index, 1);
        res.status(204).send();
    });
});

// --- API КОММЕНТАРИЕВ ---
app.get('/api/comments', authMiddleware, (req, res) => {
    res.json(commentsData);
});

app.put('/api/comments/:id', authMiddleware, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const index = commentsData.findIndex(c => c.id === id);
    if (index === -1) return res.status(404).json({ message: 'Комментарий не найден' });

    const updatedComment = { ...commentsData[index], ...req.body, id };
    commentsData[index] = updatedComment;
    res.json(updatedComment);
});

app.post('/api/comments/simulate', authMiddleware, (req, res) => {
    const mockComments = [
        { author: 'Анна В.', text: 'Какая красота! А из какого материала сделано это платье?', platform: 'instagram' },
        { author: 'Максим Петров', text: 'Подскажите, есть ли доставка в Санкт-Петербург?', platform: 'vk' },
        { author: 'Елена_Стиль', text: 'Очень нравится ваш дизайн! А будут ли другие цвета?', platform: 'telegram' },
        { author: 'Сергей_К', text: 'Получил свой заказ, качество просто супер! Спасибо!', platform: 'vk' },
    ];
    const newComments = [];
    const count = Math.floor(Math.random() * 2) + 1; // 1 or 2 new comments
    for(let i = 0; i < count; i++) {
        const mock = mockComments[Math.floor(Math.random() * mockComments.length)];
        const newComment = {
            id: nextCommentId++,
            status: 'new',
            aiTag: false,
            ...mock
        };
        commentsData.unshift(newComment);
        newComments.push(newComment);
    }
    res.status(201).json(newComments);
});


// --- API НАСТРОЕК ---
app.get('/api/settings', authMiddleware, (req, res) => {
    res.json(settingsData);
});

app.post('/api/settings', authMiddleware, (req, res) => {
    settingsData = { ...settingsData, ...req.body };
    res.json(settingsData);
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
