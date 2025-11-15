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
        CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            owner_user_id INT REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS project_members (
            id SERIAL PRIMARY KEY,
            project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            UNIQUE(project_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            project_id INT REFERENCES projects(id) ON DELETE CASCADE,
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
            project_id INT REFERENCES projects(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            tags TEXT[] DEFAULT ARRAY[]::TEXT[],
            is_analyzing BOOLEAN DEFAULT false
        );
        CREATE TABLE IF NOT EXISTS knowledge_items (
            id SERIAL PRIMARY KEY,
            project_id INT REFERENCES projects(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            project_id INT REFERENCES projects(id) ON DELETE CASCADE,
            post_id INT REFERENCES posts(id) ON DELETE CASCADE,
            author TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            status TEXT NOT NULL,
            suggested_reply TEXT
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            project_id INT REFERENCES projects(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            read BOOLEAN DEFAULT false,
            link JSONB
        );
        CREATE TABLE IF NOT EXISTS ad_accounts (
            id SERIAL PRIMARY KEY,
            project_id INT REFERENCES projects(id) ON DELETE CASCADE,
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
            project_id INT REFERENCES projects(id) ON DELETE CASCADE,
            account_id INT REFERENCES ad_accounts(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            status TEXT NOT NULL,
            budget NUMERIC,
            spend NUMERIC,
            impressions INT,
            clicks INT
        );
        CREATE TABLE IF NOT EXISTS settings (
            id SERIAL PRIMARY KEY,
            project_id INT UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
            tone_of_voice TEXT,
            keywords TEXT,
            target_audience TEXT,
            platforms TEXT[],
            telegram JSONB
        );
    `;

    await query(createTablesQueries);
    console.log("Tables ensured.");

    const { rows: users } = await query('SELECT * FROM users');
    if (users.length === 0) {
        console.log("No users found, seeding database...");
        await seedDatabase();
    } else {
        const { rows: projectCountRows } = await query('SELECT COUNT(*) FROM projects');
        if (parseInt(projectCountRows[0].count, 10) === 0) {
            console.log("Migration: No projects found. Migrating existing data to a new project structure...");
            
            const defaultUser = users[0];
            const { rows: projectRows } = await query(
                `INSERT INTO projects (name, owner_user_id) VALUES ($1, $2) RETURNING id`,
                ['Мой первый проект', defaultUser.id]
            );
            const projectId = projectRows[0].id;
            console.log(`Created default project with ID: ${projectId} for user ID: ${defaultUser.id}`);

            await query(
                `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)`,
                [projectId, defaultUser.id, 'Владелец']
            );

            const tablesToMigrate = ['posts', 'files', 'knowledge_items', 'comments', 'notifications', 'ad_accounts', 'ad_campaigns', 'settings'];
            for (const table of tablesToMigrate) {
                try {
                    await query(`UPDATE ${table} SET project_id = $1 WHERE project_id IS NULL`, [projectId]);
                    console.log(`Migrated data for table: ${table}`);
                } catch (e) {
                     console.warn(`Could not migrate data for table ${table}, it might be empty or already migrated. Error: ${e.message}`);
                }
            }
             // Ensure legacy team_members are added to the new project
            const { rows: legacyTeam } = await query('SELECT * FROM team_members');
            for(const member of legacyTeam) {
                 const { rows: teamUserRows } = await query('SELECT id FROM users WHERE email = $1', [member.email]);
                 const teamUserId = teamUserRows[0]?.id || defaultUser.id; // Fallback to owner
                 await query(
                    `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO NOTHING`,
                    [projectId, teamUserId, member.role]
                 );
            }
            console.log("Migration complete.");
        }
    }
};

const seedDatabase = async () => {
    // Users
    const {rows: userRows} = await query(`INSERT INTO users (email, password) VALUES ('dev@smm.ai', 'password') RETURNING id`);
    const userId = userRows[0].id;

    // Projects
    const {rows: projectRows} = await query(`INSERT INTO projects (name, owner_user_id) VALUES ('Мой первый проект', $1) RETURNING id`, [userId]);
    const projectId = projectRows[0].id;
    await query(`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'Владелец')`, [projectId, userId]);
    
    // Posts
    const {rows: postRows} = await query(`
        INSERT INTO posts (project_id, platform, content, status, publish_date, tags, comments_count, likes_count, views_count) VALUES
        ($1, 'instagram', 'Пост о преимуществах нашего сервиса.', 'scheduled', $2, ARRAY['сервис', 'преимущества'], 15, 120, 1500),
        ($1, 'vk', 'Завтра выходит наш новый продукт! Следите за анонсами.', 'scheduled', $3, ARRAY['анонс', 'продукт'], 25, 80, 2200),
        ($1, 'telegram', 'Еженедельный дайджест новостей SMM.', 'published', $4, ARRAY['дайджест', 'smm'], 12, 58, 1200),
        ($1, 'instagram', 'Фотография из офиса. Как мы работаем.', 'published', $5, ARRAY['команда', 'офис'], 40, 150, 2500)
        RETURNING id
    `, [projectId, getFutureDate(2), getFutureDate(1), getPastDate(3), getPastDate(1)]);
    const postIds = postRows.map(r => r.id);

    // Comments
    await query(`
        INSERT INTO comments (project_id, post_id, author, text, timestamp, status) VALUES
        ($1, $2, 'Елена_Стиль', 'Очень уютная атмосфера у вас в офисе! Сразу видно, что работа кипит.', $3, 'unanswered'),
        ($1, $2, 'Маркетолог_Иван', 'Круто! А можете рассказать подробнее про ваш стек технологий?', $4, 'unanswered'),
        ($1, $5, 'Anna_Creative', 'Отличный пост! Как раз думала о ваших преимуществах. Спасибо, что рассказали.', NOW(), 'answered'),
        ($1, $6, 'SMM_Profi', 'Хороший дайджест. Все по делу.', $7, 'archived'),
        ($1, $2, 'Дизайнер_Ольга', 'Мне нравится ваш минималистичный интерьер.', $8, 'unanswered'),
        ($1, $2, 'Best_Shop_Ever', 'Продаю лучшие товары по низким ценам! Ссылка в профиле!', $9, 'spam')
    `, [projectId, postIds[3], getPastDate(0.5), getPastDate(0.4), postIds[0], postIds[2], getPastDate(2), getPastDate(0.2), getPastDate(0.1)]);
    
    // Notifications
    await query(`
        INSERT INTO notifications (project_id, message, timestamp, read, link) VALUES
        ($1, 'Новый комментарий к посту "Фотография из офиса..."', $2, false, '{"screen": "community"}'),
        ($1, 'AI сгенерировал для вас 5 постов для кампании "Анонс продукта".', $3, false, '{"screen": "content-plan"}'),
        ($1, 'Пост "Еженедельный дайджест..." успешно опубликован.', $4, true, '{"screen": "analytics"}'),
        ($1, 'Еженедельный отчет по аналитике готов к просмотру.', $5, false, '{"screen": "analytics"}')
    `, [projectId, getPastDate(0.2), getPastDate(1), getPastDate(3), getPastDate(0.5)]);
    
    // Ads
    const { rows: adAccountRows } = await query(`
        INSERT INTO ad_accounts (project_id, platform, name, status, budget, spend, impressions, clicks) VALUES
        ($1, 'facebook', 'SMM AI - Продвижение', 'active', 500, 320, 150000, 2500),
        ($1, 'google', 'Поисковая кампания', 'paused', 1000, 850, 220000, 1800)
        RETURNING id
    `, [projectId]);
    const adAccountIds = adAccountRows.map(r => r.id);

    await query(`
        INSERT INTO ad_campaigns (project_id, account_id, name, status, budget, spend, impressions, clicks) VALUES
        ($1, $2, 'Кампания "Новый продукт"', 'active', 200, 150, 80000, 1200),
        ($1, $2, 'Вовлеченность - Осень', 'active', 300, 170, 70000, 1300),
        ($1, $2, 'Летняя распродажа', 'completed', 100, 100, 50000, 900),
        ($1, $3, 'Поиск по ключевым словам', 'paused', 1000, 850, 220000, 1800)
    `, [projectId, adAccountIds[0], adAccountIds[1]]);

    // Settings
    await query(`
        INSERT INTO settings (project_id, tone_of_voice, keywords, target_audience, platforms, telegram) VALUES
        ($1, 
        'Дружелюбный и экспертный. Обращаемся к клиентам на ''вы'', используем эмодзи для настроения.', 
        'ключевые: #одеждаручнойработы, #натуральныеткани; стоп-слова: дешевый, скидка',
        'Женщины 25-45 лет, ценящие уют, натуральные материалы и ручную работу. Интересуются модой, но предпочитают классику и качество.',
        ARRAY['instagram', 'telegram', 'vk', 'facebook', 'youtube', 'tiktok', 'twitter', 'linkedin', 'dzen'],
        '{"token": "", "chatId": ""}'::jsonb
        ) ON CONFLICT (project_id) DO NOTHING;
    `, [projectId]);
};

// --- Data Access Functions ---
const findUserByEmail = async (email) => {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0];
};
const addUser = async (user) => {
    const {rows: userRows} = await query('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id', [user.email, user.password]);
    const userId = userRows[0].id;
    const {rows: projectRows} = await query(`INSERT INTO projects (name, owner_user_id) VALUES ('Мой первый проект', $1) RETURNING id`, [userId]);
    const projectId = projectRows[0].id;
    await query(`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'Владелец')`, [projectId, userId]);
    await query(`INSERT INTO settings (project_id, tone_of_voice, keywords, target_audience, platforms, telegram) VALUES ($1, 'Дружелюбный', '', '', ARRAY['instagram', 'telegram', 'vk'], '{"token": "", "chatId": ""}'::jsonb) ON CONFLICT (project_id) DO NOTHING;`, [projectId]);
};
const getProjectsForUser = async (userId) => {
    const { rows } = await query(
        `SELECT p.id, p.name FROM projects p
         JOIN project_members pm ON p.id = pm.project_id
         WHERE pm.user_id = $1`,
        [userId]
    );
    return rows.map(toCamelCase);
};
const userHasAccessToProject = async (userId, projectId) => {
    const { rows } = await query('SELECT 1 FROM project_members WHERE user_id = $1 AND project_id = $2', [userId, projectId]);
    return rows.length > 0;
}


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


const getPosts = async (projectId) => {
    const { rows } = await query('SELECT * FROM posts WHERE project_id = $1 ORDER BY id DESC', [projectId]);
    return rows.map(toCamelCase);
};
const getPostById = async (id, projectId) => {
    const { rows } = await query('SELECT * FROM posts WHERE id = $1 AND project_id = $2', [id, projectId]);
    return toCamelCase(rows[0]);
};
const addPost = async (postData, projectId) => {
    const { platform, content, status, isAbTest, variants } = postData;
    const { rows } = await query(
        'INSERT INTO posts (project_id, platform, content, status, is_ab_test, variants) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [projectId, platform || 'instagram', content, status || 'idea', !!isAbTest, variants ? JSON.stringify(variants) : null]
    );
    return toCamelCase(rows[0]);
};
const updatePost = async (id, updates, projectId) => {
    const post = await getPostById(id, projectId);
    if (!post) return null;
    const updatedData = { ...post, ...updates };

    const { rows } = await query(
        `UPDATE posts SET 
            platform = $1, content = $2, media = $3, status = $4, publish_date = $5, tags = $6, 
            comments_count = $7, likes_count = $8, views_count = $9, is_ab_test = $10, variants = $11
        WHERE id = $12 AND project_id = $13 RETURNING *`,
        [
            updatedData.platform, updatedData.content, updatedData.media, updatedData.status, updatedData.publishDate,
            updatedData.tags, updatedData.commentsCount, updatedData.likesCount, updatedData.viewsCount,
            updatedData.isAbTest === null ? false : !!updatedData.isAbTest, 
            updatedData.variants ? JSON.stringify(updatedData.variants) : null, 
            id, projectId
        ]
    );
    return toCamelCase(rows[0]);
};
const deletePost = async (id, projectId) => {
    const { rowCount } = await query('DELETE FROM posts WHERE id = $1 AND project_id = $2', [id, projectId]);
    return rowCount > 0;
};

const getFiles = async (projectId) => {
    const { rows } = await query('SELECT * FROM files WHERE project_id = $1 ORDER BY id DESC', [projectId]);
    return rows.map(toCamelCase);
};
const getFileById = async (id, projectId) => {
    const { rows } = await query('SELECT * FROM files WHERE id = $1 AND project_id = $2', [id, projectId]);
    return toCamelCase(rows[0]);
};
const addFile = async (fileData, projectId) => {
    const { name, url, mime_type, tags } = fileData;
    const { rows } = await query(
        'INSERT INTO files (project_id, name, url, mime_type, tags, is_analyzing) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [projectId, name, url, mime_type, tags || [], false]
    );
    return toCamelCase(rows[0]);
};
const updateFile = async (id, updates, projectId) => {
    const file = await getFileById(id, projectId);
    if (!file) return null;
    const { tags, isAnalyzing } = { ...file, ...updates };
    const { rows } = await query(
        'UPDATE files SET tags = $1, is_analyzing = $2 WHERE id = $3 AND project_id = $4 RETURNING *',
        [tags, !!isAnalyzing, id, projectId]
    );
    return toCamelCase(rows[0]);
};
const deleteFile = async (id, projectId) => {
    const file = await getFileById(id, projectId);
    if (!file) return null;
    await query('DELETE FROM files WHERE id = $1 AND project_id = $2', [id, projectId]);
    return file;
};

const getKnowledgeBaseItems = async (projectId) => (await query('SELECT * FROM knowledge_items WHERE project_id = $1 ORDER BY id DESC', [projectId])).rows.map(toCamelCase);
const addKnowledgeBaseItem = async (item, projectId) => {
    const { rows } = await query('INSERT INTO knowledge_items (project_id, type, name, url) VALUES ($1, $2, $3, $4) RETURNING *', [projectId, item.type, item.name, item.url]);
    return toCamelCase(rows[0]);
};
const deleteKnowledgeBaseItem = async (id, projectId) => {
    const { rows } = await query('DELETE FROM knowledge_items WHERE id = $1 AND project_id = $2 RETURNING *', [id, projectId]);
    return toCamelCase(rows[0]);
};

const getSettings = async (projectId) => {
    const { rows } = await query('SELECT * FROM settings WHERE project_id = $1', [projectId]);
    return toCamelCase(rows[0]);
};
const updateSettings = async (updates, projectId) => {
    const settings = await getSettings(projectId);
    const { toneOfVoice, keywords, targetAudience, platforms, telegram } = { ...settings, ...updates };
    const { rows } = await query(
        `UPDATE settings SET 
            tone_of_voice = $1, keywords = $2, target_audience = $3, platforms = $4, telegram = $5 
        WHERE project_id = $6 RETURNING *`,
        [toneOfVoice, keywords, targetAudience, platforms, telegram, projectId]
    );
    return toCamelCase(rows[0]);
};

const getComments = async (projectId) => (await query('SELECT * FROM comments WHERE project_id = $1 ORDER BY timestamp DESC', [projectId])).rows.map(toCamelCase);
const getCommentById = async (id, projectId) => {
    const { rows } = await query('SELECT * FROM comments WHERE id = $1 AND project_id = $2', [id, projectId]);
    return toCamelCase(rows[0]);
};
const addComment = async (commentData, projectId) => {
    const { postId, author, text, status, suggestedReply } = commentData;
    const { rows } = await query(
        'INSERT INTO comments (project_id, post_id, author, text, status, suggested_reply) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [projectId, postId, author, text, status, suggestedReply]
    );
    return toCamelCase(rows[0]);
};
const updateComment = async (id, updates, projectId) => {
    const { status } = updates;
    const { rows } = await query('UPDATE comments SET status = $1 WHERE id = $2 AND project_id = $3 RETURNING *', [status, id, projectId]);
    return toCamelCase(rows[0]);
};

const getTeamMembers = async (projectId) => {
    const { rows } = await query(`
        SELECT pm.id, u.email, pm.role FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = $1
        ORDER BY pm.role, u.email
    `, [projectId]);
    return rows.map(toCamelCase);
};
const getTeamMemberById = async (memberId, projectId) => {
    const { rows } = await query('SELECT * FROM project_members WHERE id = $1 AND project_id = $2', [memberId, projectId]);
    return toCamelCase(rows[0]);
};
const findTeamMemberByEmail = async (email, projectId) => {
    const { rows } = await query(`
        SELECT pm.* FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE u.email = $1 AND pm.project_id = $2
    `, [email, projectId]);
    return toCamelCase(rows[0]);
};
const addTeamMember = async (memberData, projectId) => {
    const { email, role } = memberData;
    // In a real app, you'd find a user by email, not just add their email string.
    // For now, we assume user exists and we have their ID or find it.
    const { rows: userRows } = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRows.length === 0) {
        // Here you might auto-create a user or send an invite link. For now, we'll throw an error.
        throw new Error("User with this email not found in the system.");
    }
    const userId = userRows[0].id;
    const { rows } = await query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) RETURNING *', [projectId, userId, role]);
    return toCamelCase({ ...rows[0], email });
};
const updateTeamMember = async (memberId, updates, projectId) => {
    const { role } = updates;
    const { rows } = await query('UPDATE project_members SET role = $1 WHERE id = $2 AND project_id = $3 RETURNING *', [role, memberId, projectId]);
     const { rows: userRows } = await query('SELECT email FROM users u JOIN project_members pm ON u.id = pm.user_id WHERE pm.id = $1', [memberId]);
    return toCamelCase({ ...rows[0], email: userRows[0].email });
};
const deleteTeamMember = async (memberId, projectId) => {
    await query('DELETE FROM project_members WHERE id = $1 AND project_id = $2', [memberId, projectId]);
};

const getNotifications = async (projectId) => (await query('SELECT * FROM notifications WHERE project_id = $1 ORDER BY timestamp DESC', [projectId])).rows.map(toCamelCase);
const addNotification = async (notificationData, projectId) => {
    const { message, link } = notificationData;
    await query('INSERT INTO notifications (project_id, message, link) VALUES ($1, $2, $3)', [projectId, message, link ? JSON.stringify(link) : null]);
};
const markAllNotificationsAsRead = async (projectId) => {
    await query('UPDATE notifications SET read = true WHERE read = false AND project_id = $1', [projectId]);
};

const getAdAccounts = async (projectId) => (await query('SELECT * FROM ad_accounts WHERE project_id = $1', [projectId])).rows.map(toCamelCase);
const getAdCampaignsByAccountId = async (accountId, projectId) => (await query('SELECT * FROM ad_campaigns WHERE account_id = $1 AND project_id = $2', [accountId, projectId])).rows.map(toCamelCase);


module.exports = {
    initializeDb,
    findUserByEmail,
    addUser,
    getProjectsForUser,
    userHasAccessToProject,
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