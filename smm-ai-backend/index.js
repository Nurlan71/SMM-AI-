const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-super-secret-key-for-dev'; // В продакшене используйте process.env

// Middlewares
app.use(cors()); // Разрешает запросы с фронтенда
app.use(express.json()); // Позволяет читать JSON в теле запроса

// --- MOCK DATA ---
// Это те же данные, что и на фронтенде
const MOCK_FILES = [
    { id: 1, name: 'autumn_coat.jpg', url: 'https://images.unsplash.com/photo-1571513722275-4b41940f54b8?q=80&w=1887&auto=format&fit=crop', mimeType: 'image/jpeg' },
    { id: 2, name: 'team_photo.png', url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop', mimeType: 'image/png' },
    { id: 3, name: 'product_video.mp4', url: 'https://placehold.co/600x400/a2d2ff/333333?text=Video', mimeType: 'video/mp4' },
    { id: 4, name: 'brand_guide.pdf', url: 'https://placehold.co/600x400/ffafcc/333333?text=PDF', mimeType: 'application/pdf' },
    { id: 5, name: 'new_collection.jpg', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop', mimeType: 'image/jpeg' },
];

// --- API ROUTES ---

// 1. Аутентификация
app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    console.log(`[Register Attempt] Email: ${email}`);
    // В реальном приложении: валидация, хеширование пароля, сохранение в БД
    res.status(201).json({ message: 'User registered successfully (mock)' });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    console.log(`[Login Attempt] Email: ${email}`);
    // Проверяем тестового пользователя
    if (email === 'dev@smm.ai' && password === 'password') {
        const token = jwt.sign({ email: email, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token });
    }
    return res.status(401).json({ message: 'Invalid credentials' });
});

// 2. База знаний
// TODO: В будущем добавить middleware для проверки JWT токена
app.get('/api/files', (req, res) => {
    console.log('[Get Files] Sending mock files list.');
    // Имитируем задержку сети
    setTimeout(() => {
        res.json(MOCK_FILES);
    }, 500);
});


// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 SMM AI Backend is running on http://localhost:${PORT}`);
});