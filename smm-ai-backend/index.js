
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-super-secret-key-for-smm-ai-app'; // В реальном проекте это должно быть в .env

app.use(cors());
app.use(express.json());

// Простая база данных в памяти для демонстрации
let users = [
    // Хэш для пароля "password"
    { id: 1, email: 'dev@smm.ai', passwordHash: '$2a$10$f.XqVhrnQ6n.1z8qr.E.L.l5.F1/1hQ1m1ZGp8L4u1v4g.a/7bS.q' }
];

// --- Эндпоинты аутентификации ---

// Регистрация
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email и пароль обязательны.' });
    }

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(400).json({ message: 'Пользователь с таким email уже существует.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const newUser = {
        id: users.length + 1,
        email,
        passwordHash,
    };

    users.push(newUser);
    console.log('New user registered:', newUser.email);

    res.status(201).json({ message: 'Пользователь успешно зарегистрирован.' });
});

// Вход
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email и пароль обязательны.' });
    }
    
    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(401).json({ message: 'Неверный email или пароль.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        return res.status(401).json({ message: 'Неверный email или пароль.' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: '1h'
    });
    
    console.log('User logged in:', user.email);
    res.json({ token });
});


// Middleware для проверки токена (пока не используется, но понадобится для защищенных роутов)
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Заглушки для будущих эндпоинтов ---
app.get('/api/posts', (req, res) => {
    res.json([]);
});
app.get('/api/files', (req, res) => {
    res.json([]);
});


app.get('/', (req, res) => {
    res.send('SMM AI Backend is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log("Registered users for testing:", users.map(u => u.email));
});
