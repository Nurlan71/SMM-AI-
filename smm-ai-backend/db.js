const { query } = require('./pg');

const getFutureDate = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const getPastDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const initializeDb = async () => {
    const createTablesQueries = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            platform TEXT NOT NULL DEFAULT 'instagram',
            content TEXT NOT NULL,
            media TEXT[] DEFAULT ARRAY[]::TEXT[],
            status TEXT NOT NULL DEFAULT 'idea',
            publish_date TIMESTAMPTZ,
            tags TEXT[] DEFAULT ARRAY[]::TEXT[],
            comments_count INT DEFAULT 0,
            likes_count INT DEFAULT 0,
            views_count INT DEFAULT 0,
            is_ab_test BOOLEAN DEFAULT false,
            variants JSONB
        );
        CREATE TABLE IF NOT EXISTS files (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            tags TEXT[] DEFAULT ARRAY[]::TEXT[],
            is_analyzing BOOLEAN DEFAULT false
        );
        CREATE TABLE IF NOT EXISTS knowledge_items (
            id SERIAL PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            post_id INT REFERENCES posts(id) ON DELETE CASCADE,
            author TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            status TEXT NOT NULL,
            suggested_reply TEXT
        );
        CREATE TABLE IF NOT EXISTS team_members (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            message TEXT NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            read BOOLEAN DEFAULT false,
            link JSONB
        );
        CREATE TABLE IF NOT EXISTS ad_accounts (
            id SERIAL PRIMARY KEY,
            platform TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL,
            budget NUMERIC,
            spend NUMERIC,
            impressions INT,
            clicks INT
        );
        CREATE TABLE IF NOT EXISTS ad_campaigns (
            id SERIAL PRIMARY KEY,
            account_id INT REFERENCES ad_accounts(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            status TEXT NOT NULL,
            budget NUMERIC,
            spend NUMERIC,
            impressions INT,
            clicks INT
        );
        CREATE TABLE IF NOT EXISTS settings (
            id INT PRIMARY KEY DEFAULT 1,
            tone_of_voice TEXT,
            keywords TEXT,
            target_audience TEXT,
            platforms TEXT[],
            telegram JSONB
        );
    `;

    await query(createTablesQueries);

    // Check if initial data exists
    const { rows: users } = await query('SELECT COUNT(*) FROM users');
    if (parseInt(users[0].count, 10) === 0) {
        console.log("No initial data found, seeding database...");
        await seedDatabase();
    }
};

const seedDatabase = async () => {
    // Users
    await query(`INSERT INTO users (email, password) VALUES ('dev@smm.ai', 'password')`);
    
    // Posts
    await query(`
        INSERT INTO posts (platform, content, status, publish_date, tags, comments_count, likes_count, views_count) VALUES
        ('instagram', 'Пост о преимуществах нашего сервиса.', 'scheduled', $1, ARRAY['сервис', 'преимущества'], 15, 120, 1500),
        ('vk', 'Завтра выходит наш новый продукт! Следите за анонсами.', 'scheduled', $2, ARRAY['анонс', 'продукт'], 25, 80, 2200),
        ('telegram', 'Еженедельный дайджест новостей SMM.', 'published', $3, ARRAY['дайджест', 'smm'], 12, 58, 1200),
        ('instagram', 'Фотография из офиса. Как мы работаем.', 'published', $4, ARRAY['команда', 'офис'], 40, 150, 2500)
    `, [getFutureDate(2), getFutureDate(1), getPastDate(3), getPastDate(1)]);

    // Comments
    await query(`
        INSERT INTO comments (post_id, author, text, timestamp, status) VALUES
        (4, 'Елена_Стиль', 'Очень уютная атмосфера у вас в офисе! Сразу видно, что работа кипит.', $1, 'unanswered'),
        (4, 'Маркетолог_Иван', 'Круто! А можете рассказать подробнее про ваш стек технологий?', $2, 'unanswered'),
        (1, 'Anna_Creative', 'Отличный пост! Как раз думала о ваших преимуществах. Спасибо, что рассказали.', NOW(), 'answered'),
        (3, 'SMM_Profi', 'Хороший дайджест. Все по делу.', $3, 'archived'),
        (4, 'Дизайнер_Ольга', 'Мне нравится ваш минималистичный интерьер.', $4, 'unanswered'),
        (4, 'Best_Shop_Ever', 'Продаю лучшие товары по низким ценам! Ссылка в профиле!', $5, 'spam')
    `, [getPastDate(0.5), getPastDate(0.4), getPastDate(2), getPastDate(0.2), getPastDate(0.1)]);

    // Team
    await query(`
        INSERT INTO team_members (email, role) VALUES
        ('owner@smm.ai', 'Владелец'),
        ('manager@smm.ai', 'SMM-менеджер'),
        ('guest@smm.ai', 'Гость')
    `);
    
    // Notifications
    await query(`
        INSERT INTO notifications (message, timestamp, read, link) VALUES
        ('Новый комментарий к посту "Фотография из офиса..."', $1, false, '{"screen": "community"}'),
        ('AI сгенерировал для вас 5 постов для кампании "Анонс продукта".', $2, false, '{"screen": "content-plan"}'),
        ('Пост "Еженедельный дайджест..." успешно опубликован.', $3, true, '{"screen": "analytics"}'),
        ('Еженедельный отчет по аналитике готов к просмотру.', $4, false, '{"screen": "analytics"}')
    `, [getPastDate(0.2), getPastDate(1), getPastDate(3), getPastDate(0.5)]);
    
    // Ads
    await query(`
        INSERT INTO ad_accounts (platform, name, status, budget, spend, impressions, clicks) VALUES
        ('facebook', 'SMM AI - Продвижение', 'active', 500, 320, 150000, 2500),
        ('google', 'Поисковая кампания', 'paused', 1000, 850, 220000, 1800)
    `);
    await query(`
        INSERT INTO ad_campaigns (account_id, name, status, budget, spend, impressions, clicks) VALUES
        (1, 'Кампания "Новый продукт"', 'active', 200, 150, 80000, 1200),
        (1, 'Вовлеченность - Осень', 'active', 300, 170, 70000, 1300),
        (1, 'Летняя распродажа', 'completed', 100, 100, 50000, 900),
        (2, 'Поиск по ключевым словам', 'paused', 1000, 850, 220000, 1800)
    `);

    // Settings
    await query(`
        INSERT INTO settings (id, tone_of_voice, keywords, target_audience, platforms, telegram) VALUES
        (1, 
        'Дружелюбный и экспертный. Обращаемся к клиентам на ''вы'', используем эмодзи для настроения.', 
        'ключевые: #одеждаручнойработы, #натуральныеткани; стоп-слова: дешевый, скидка',
        'Женщины 25-45 лет, ценящие уют, натуральные материалы и ручную работу. Интересуются модой, но предпочитают классику и качество.',
        ARRAY['instagram', 'telegram', 'vk', 'facebook', 'youtube', 'tiktok', 'twitter', 'linkedin', 'dzen'],
        '{"token": "", "chatId": ""}'::jsonb
        ) ON CONFLICT (id) DO NOTHING;
    `);
};

// --- Data Access Functions ---
const findUserByEmail = async (email) => {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0];
};
const addUser = async (user) => {
    await query('INSERT INTO users (email, password) VALUES ($1, $2)', [user.email, user.password]);
};

// Helper to convert DB column names (snake_case) to camelCase for the frontend
const toCamelCase = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(v => toCamelCase(v));
    const newObj = {};
    for (const key in obj) {
        const newKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        newObj[newKey] = obj[key];
    }
    return newObj;
};


const getPosts = async () => {
    const { rows } = await query('SELECT * FROM posts ORDER BY id DESC');
    return rows.map(toCamelCase);
};
const getPostById = async (id) => {
    const { rows } = await query('SELECT * FROM posts WHERE id = $1', [id]);
    return toCamelCase(rows[0]);
};
const addPost = async (postData) => {
    const { platform, content, status, isAbTest, variants } = postData;
    const { rows } = await query(
        'INSERT INTO posts (platform, content, status, is_ab_test, variants) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [platform || 'instagram', content, status || 'idea', !!isAbTest, variants ? JSON.stringify(variants) : null]
    );
    return toCamelCase(rows[0]);
};
const updatePost = async (id, updates) => {
    const post = await getPostById(id);
    if (!post) return null;
    const updatedData = { ...post, ...updates };

    const { rows } = await query(
        `UPDATE posts SET 
            platform = $1, content = $2, media = $3, status = $4, publish_date = $5, tags = $6, 
            comments_count = $7, likes_count = $8, views_count = $9, is_ab_test = $10, variants = $11
        WHERE id = $12 RETURNING *`,
        [
            updatedData.platform, updatedData.content, updatedData.media, updatedData.status, updatedData.publishDate,
            updatedData.tags, updatedData.commentsCount, updatedData.likesCount, updatedData.viewsCount,
            updatedData.isAbTest === null ? false : !!updatedData.isAbTest, 
            updatedData.variants ? JSON.stringify(updatedData.variants) : null, 
            id
        ]
    );
    return toCamelCase(rows[0]);
};
const deletePost = async (id) => {
    const { rowCount } = await query('DELETE FROM posts WHERE id = $1', [id]);
    return rowCount > 0;
};

const getFiles = async () => {
    const { rows } = await query('SELECT * FROM files ORDER BY id DESC');
    return rows.map(toCamelCase);
};
const getFileById = async (id) => {
    const { rows } = await query('SELECT * FROM files WHERE id = $1', [id]);
    return toCamelCase(rows[0]);
};
const addFile = async (fileData) => {
    const { name, url, mime_type, tags } = fileData;
    // Fix: Added the 'is_analyzing' column to the INSERT statement with a default value of false.
    // This resolves a bug where files were not being saved to the database because the column was omitted.
    const { rows } = await query(
        'INSERT INTO files (name, url, mime_type, tags, is_analyzing) VALUES ($1, $2, $3, $4, false) RETURNING *',
        [name, url, mime_type, tags || []]
    );
    return toCamelCase(rows[0]);
};
const updateFile = async (id, updates) => {
    const file = await getFileById(id);
    if (!file) return null;
    const { tags, isAnalyzing } = { ...file, ...updates };
    const { rows } = await query(
        'UPDATE files SET tags = $1, is_analyzing = $2 WHERE id = $3 RETURNING *',
        [tags, !!isAnalyzing, id]
    );
    return toCamelCase(rows[0]);
};
const deleteFile = async (id) => {
    const file = await getFileById(id);
    if (!file) return null;
    await query('DELETE FROM files WHERE id = $1', [id]);
    return file; // Return deleted file info for file system cleanup
};

const getKnowledgeBaseItems = async () => (await query('SELECT * FROM knowledge_items ORDER BY id DESC')).rows.map(toCamelCase);
const addKnowledgeBaseItem = async (item) => {
    const { rows } = await query('INSERT INTO knowledge_items (type, name, url) VALUES ($1, $2, $3) RETURNING *', [item.type, item.name, item.url]);
    return toCamelCase(rows[0]);
};
const deleteKnowledgeBaseItem = async (id) => {
    const { rows } = await query('DELETE FROM knowledge_items WHERE id = $1 RETURNING *', [id]);
    return toCamelCase(rows[0]);
};

const getSettings = async () => {
    const { rows } = await query('SELECT * FROM settings WHERE id = 1');
    return toCamelCase(rows[0]);
};
const updateSettings = async (updates) => {
    const settings = await getSettings();
    const { toneOfVoice, keywords, targetAudience, platforms, telegram } = { ...settings, ...updates };
    const { rows } = await query(
        `UPDATE settings SET 
            tone_of_voice = $1, keywords = $2, target_audience = $3, platforms = $4, telegram = $5 
        WHERE id = 1 RETURNING *`,
        [toneOfVoice, keywords, targetAudience, platforms, telegram]
    );
    return toCamelCase(rows[0]);
};

const getComments = async () => (await query('SELECT * FROM comments ORDER BY timestamp DESC')).rows.map(toCamelCase);
const getCommentById = async (id) => {
    const { rows } = await query('SELECT * FROM comments WHERE id = $1', [id]);
    return toCamelCase(rows[0]);
};
const addComment = async (commentData) => {
    const { postId, author, text, status, suggestedReply } = commentData;
    const { rows } = await query(
        'INSERT INTO comments (post_id, author, text, status, suggested_reply) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [postId, author, text, status, suggestedReply]
    );
    return toCamelCase(rows[0]);
};
const updateComment = async (id, updates) => {
    const { status } = updates;
    const { rows } = await query('UPDATE comments SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return toCamelCase(rows[0]);
};

const getTeamMembers = async () => (await query('SELECT * FROM team_members ORDER BY role, email')).rows.map(toCamelCase);
const getTeamMemberById = async (id) => {
    const { rows } = await query('SELECT * FROM team_members WHERE id = $1', [id]);
    return toCamelCase(rows[0]);
};
const findTeamMemberByEmail = async (email) => {
    const { rows } = await query('SELECT * FROM team_members WHERE email = $1', [email]);
    return toCamelCase(rows[0]);
};
const addTeamMember = async (memberData) => {
    const { email, role } = memberData;
    const { rows } = await query('INSERT INTO team_members (email, role) VALUES ($1, $2) RETURNING *', [email, role]);
    return toCamelCase(rows[0]);
};
const updateTeamMember = async (id, updates) => {
    const { role } = updates;
    const { rows } = await query('UPDATE team_members SET role = $1 WHERE id = $2 RETURNING *', [role, id]);
    return toCamelCase(rows[0]);
};
const deleteTeamMember = async (id) => {
    await query('DELETE FROM team_members WHERE id = $1', [id]);
};

const getNotifications = async () => (await query('SELECT * FROM notifications ORDER BY timestamp DESC')).rows.map(toCamelCase);
const addNotification = async (notificationData) => {
    const { message, link } = notificationData;
    await query('INSERT INTO notifications (message, link) VALUES ($1, $2)', [message, link ? JSON.stringify(link) : null]);
};
const markAllNotificationsAsRead = async () => {
    await query('UPDATE notifications SET read = true WHERE read = false');
};

const getAdAccounts = async () => (await query('SELECT * FROM ad_accounts')).rows.map(toCamelCase);
const getAdCampaignsByAccountId = async (accountId) => (await query('SELECT * FROM ad_campaigns WHERE account_id = $1', [accountId])).rows.map(toCamelCase);


module.exports = {
    initializeDb,
    findUserByEmail,
    addUser,
    getPosts,
    getPostById,
    addPost,
    updatePost,
    deletePost,
    getFiles,
    getFileById,
    addFile,
    updateFile,
    deleteFile,
    getKnowledgeBaseItems,
    addKnowledgeBaseItem,
    deleteKnowledgeBaseItem,
    getSettings,
    updateSettings,
    getComments,
    getCommentById,
    addComment,
    updateComment,
    getTeamMembers,
    getTeamMemberById,
    findTeamMemberByEmail,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    getNotifications,
    addNotification,
    markAllNotificationsAsRead,
    getAdAccounts,
    getAdCampaignsByAccountId,
};