const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// --- Serve Frontend Static Files ---
// Path to the frontend build directory
const frontendDistPath = path.join(__dirname, '..', 'dist');
app.use(express.static(frontendDistPath));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// --- API Auth Routes ---
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

// --- API Middleware to verify token ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- API Posts Route ---
app.get('/api/posts', authMiddleware, (req, res) => {
    res.json(posts);
});

// --- API File Routes ---
app.get('/api/files', authMiddleware, (req, res) => {
    res.json(files);
});

app.post('/api/files/upload', [authMiddleware, upload.array('files')], (req, res) => {
    const uploadedFiles = req.files.map(file => {
        const newFile = {
            id: nextFileId++,
            name: file.originalname,
            url: `/uploads/${file.filename}`, // Use relative path for production
            mimeType: file.mimetype,
            tags: [],
            isAnalyzing: false,
        };
        files.push(newFile);
        return newFile;
    });
    res.status(201).json(uploadedFiles);
});

app.delete('/api/files/:id', authMiddleware, (req, res) => {
    const fileId = parseInt(req.params.id, 10);
    const fileIndex = files.findIndex(f => f.id === fileId);

    if (fileIndex === -1) {
        return res.status(404).json({ message: 'Файл не найден.' });
    }

    const [deletedFile] = files.splice(fileIndex, 1);
    
    try {
        const filePath = path.join(__dirname, 'uploads', path.basename(deletedFile.url));
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch(err) {
        console.error("Error deleting file from disk:", err);
    }

    res.status(200).json({ message: 'Файл удален.' });
});

// Mock routes for data that's not implemented yet
app.get('/api/settings', authMiddleware, (req, res) => res.json({}));
app.get('/api/comments', authMiddleware, (req, res) => res.json([]));


// --- Catch-all to serve index.html for any other request ---
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