// TODO: This is a file-based mock database. Replace with actual PostgreSQL connection and queries.
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');
let db = {};

const getFutureDate = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const getPastDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();


const getInitialData = () => ({
    users: [
        { email: 'dev@smm.ai', password: 'password' }
    ],
    posts: [
        { id: 1, platform: 'instagram', content: 'Пост о преимуществах нашего сервиса.', media: [], status: 'scheduled', publishDate: getFutureDate(2), tags: ['сервис', 'преимущества'], comments_count: 15, likes_count: 120, views_count: 1500 },
        { id: 2, platform: 'vk', content: 'Завтра выходит наш новый продукт! Следите за анонсами.', media: [], status: 'scheduled', publishDate: getFutureDate(1), tags: ['анонс', 'продукт'], comments_count: 25, likes_count: 80, views_count: 2200 },
        { id: 3, platform: 'telegram', content: 'Еженедельный дайджест новостей SMM.', media: [], status: 'published', publishDate: getPastDate(3), tags: ['дайджест', 'smm'], comments_count: 12, likes_count: 58, views_count: 1200 },
        { id: 4, platform: 'instagram', content: 'Фотография из офиса. Как мы работаем.', media: [], status: 'published', publishDate: getPastDate(1), tags: ['команда', 'офис'], comments_count: 40, likes_count: 150, views_count: 2500 },
    ],
    files: [],
    knowledgeBaseItems: [],
    comments: [
        { id: 1, postId: 4, author: 'Елена_Стиль', text: 'Очень уютная атмосфера у вас в офисе! Сразу видно, что работа кипит.', timestamp: getPastDate(0.5), status: 'unanswered' },
        { id: 2, postId: 4, author: 'Маркетолог_Иван', text: 'Круто! А можете рассказать подробнее про ваш стек технологий?', timestamp: getPastDate(0.4), status: 'unanswered' },
        { id: 3, postId: 1, author: 'Anna_Creative', text: 'Отличный пост! Как раз думала о ваших преимуществах. Спасибо, что рассказали.', timestamp: getFutureDate(0), status: 'answered' },
        { id: 4, postId: 3, author: 'SMM_Profi', text: 'Хороший дайджест. Все по делу.', timestamp: getPastDate(2), status: 'archived' },
        { id: 5, postId: 4, author: 'Дизайнер_Ольга', text: 'Мне нравится ваш минималистичный интерьер.', timestamp: getPastDate(0.2), status: 'unanswered' },
        { id: 6, postId: 4, author: 'Best_Shop_Ever', text: 'Продаю лучшие товары по низким ценам! Ссылка в профиле!', timestamp: getPastDate(0.1), status: 'spam' },
    ],
    teamMembers: [
        { id: 1, email: 'owner@smm.ai', role: 'Владелец' },
        { id: 2, email: 'manager@smm.ai', role: 'SMM-менеджер' },
        { id: 3, email: 'guest@smm.ai', role: 'Гость' },
    ],
    notifications: [
        { id: 1, message: 'Новый комментарий к посту "Фотография из офиса..."', timestamp: getPastDate(0.2), read: false, link: { screen: 'community' } },
        { id: 2, message: 'AI сгенерировал для вас 5 постов для кампании "Анонс продукта".', timestamp: getPastDate(1), read: false, link: { screen: 'content-plan' } },
        { id: 3, message: 'Пост "Еженедельный дайджест..." успешно опубликован.', timestamp: getPastDate(3), read: true, link: { screen: 'analytics' } },
        { id: 4, message: 'Еженедельный отчет по аналитике готов к просмотру.', timestamp: getPastDate(0.5), read: false, link: { screen: 'analytics' } },
    ],
    adAccounts: [
        { id: 1, platform: 'facebook', name: 'SMM AI - Продвижение', status: 'active', budget: 500, spend: 320, impressions: 150000, clicks: 2500 },
        { id: 2, platform: 'google', name: 'Поисковая кампания', status: 'paused', budget: 1000, spend: 850, impressions: 220000, clicks: 1800 },
    ],
    adCampaigns: [
        { id: 101, accountId: 1, name: 'Кампания "Новый продукт"', status: 'active', budget: 200, spend: 150, impressions: 80000, clicks: 1200 },
        { id: 102, accountId: 1, name: 'Вовлеченность - Осень', status: 'active', budget: 300, spend: 170, impressions: 70000, clicks: 1300 },
        { id: 103, accountId: 1, name: 'Летняя распродажа', status: 'completed', budget: 100, spend: 100, impressions: 50000, clicks: 900 },
        { id: 201, accountId: 2, name: 'Поиск по ключевым словам', status: 'paused', budget: 1000, spend: 850, impressions: 220000, clicks: 1800 },
    ],
    settings: {
        toneOfVoice: "Дружелюбный и экспертный. Обращаемся к клиентам на 'вы', используем эмоззи для настроения.",
        keywords: "ключевые: #одеждаручнойработы, #натуральныеткани; стоп-слова: дешевый, скидка",
        targetAudience: "Женщины 25-45 лет, ценящие уют, натуральные материалы и ручную работу. Интересуются модой, но предпочитают классику и качество.",
        brandVoiceExamples: [],
        platforms: ['instagram', 'telegram', 'vk', 'facebook', 'youtube', 'tiktok', 'twitter', 'linkedin', 'dzen'],
        telegram: { token: '', chatId: '' },
    },
    nextIds: {
        post: 5,
        comment: 7,
        notification: 5,
        teamMember: 4,
        adAccount: 3,
        adCampaign: 202,
        file: 1,
        knowledgeBaseItem: 1,
    }
});

function readDb() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf-8');
        db = JSON.parse(data);
    } catch (error) {
        console.error("Error reading database file:", error);
        // If file is corrupted or unreadable, re-initialize
        db = getInitialData();
        writeDb();
    }
}

function writeDb() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
    } catch (error) {
        console.error("Error writing to database file:", error);
    }
}

function initializeDb() {
    if (!fs.existsSync(DB_PATH)) {
        console.log("Database file not found, creating a new one with initial data.");
        db = getInitialData();
        writeDb();
    } else {
        readDb();
    }
}

// --- Generic ID Incrementer ---
function getNextId(entity) {
    readDb();
    const nextId = db.nextIds[entity]++;
    writeDb();
    return nextId;
}

// --- Users ---
const findUserByEmail = (email) => { readDb(); return db.users.find(u => u.email === email); };
const addUser = (user) => { readDb(); db.users.push(user); writeDb(); };

// --- Posts ---
const getPosts = () => { readDb(); return db.posts.sort((a, b) => new Date(b.publishDate || 0) - new Date(a.publishDate || 0)); };
const getPostById = (id) => { readDb(); return db.posts.find(p => p.id === id); };
const addPost = (postData) => {
    readDb();
    const newPost = { ...postData, id: getNextId('post') };
    db.posts.unshift(newPost);
    writeDb();
    return newPost;
};
const updatePost = (id, updates) => {
    readDb();
    const postIndex = db.posts.findIndex(p => p.id === id);
    if (postIndex === -1) return null;
    db.posts[postIndex] = { ...db.posts[postIndex], ...updates, id };
    writeDb();
    return db.posts[postIndex];
};
const deletePost = (id) => {
    readDb();
    const postIndex = db.posts.findIndex(p => p.id === id);
    if (postIndex === -1) return null;
    const [deletedPost] = db.posts.splice(postIndex, 1);
    writeDb();
    return deletedPost;
};

// --- Files ---
const getFiles = () => { readDb(); return db.files; };
const getFileById = (id) => { readDb(); return db.files.find(f => f.id === id); };
const addFile = (fileData, prepend = false) => {
    readDb();
    const newFile = { ...fileData, id: getNextId('file') };
    if (prepend) {
        db.files.unshift(newFile);
    } else {
        db.files.push(newFile);
    }
    writeDb();
    return newFile;
};
const updateFile = (id, updates) => {
    readDb();
    const fileIndex = db.files.findIndex(f => f.id === id);
    if (fileIndex === -1) return null;
    db.files[fileIndex] = { ...db.files[fileIndex], ...updates, id };
    writeDb();
    return db.files[fileIndex];
};
const deleteFile = (id) => {
    readDb();
    const fileIndex = db.files.findIndex(f => f.id === id);
    if (fileIndex === -1) return null;
    const [deletedFile] = db.files.splice(fileIndex, 1);
    writeDb();
    return deletedFile;
};

// --- Comments ---
const getComments = () => { readDb(); return db.comments; };
const getCommentById = (id) => { readDb(); return db.comments.find(c => c.id === id); };
const addComment = (commentData) => {
    readDb();
    const newComment = { ...commentData, id: getNextId('comment') };
    db.comments.unshift(newComment);
    writeDb();
    return newComment;
};
const updateComment = (id, updates) => {
    readDb();
    const commentIndex = db.comments.findIndex(c => c.id === id);
    if (commentIndex === -1) return null;
    db.comments[commentIndex] = { ...db.comments[commentIndex], ...updates, id };
    writeDb();
    return db.comments[commentIndex];
};


// --- Knowledge Base ---
const getKnowledgeBaseItems = () => { readDb(); return db.knowledgeBaseItems; };
const addKnowledgeBaseItem = (itemData) => {
    readDb();
    const newItem = { ...itemData, id: getNextId('knowledgeBaseItem') };
    db.knowledgeBaseItems.unshift(newItem);
    writeDb();
    return newItem;
};
const deleteKnowledgeBaseItem = (id) => {
    readDb();
    const itemIndex = db.knowledgeBaseItems.findIndex(i => i.id === id);
    if (itemIndex === -1) return null;
    const [deletedItem] = db.knowledgeBaseItems.splice(itemIndex, 1);
    writeDb();
    return deletedItem;
};

// --- Team ---
const getTeamMembers = () => { readDb(); return db.teamMembers; };
const getTeamMemberById = (id) => { readDb(); return db.teamMembers.find(m => m.id === id); };
const findTeamMemberByEmail = (email) => { readDb(); return db.teamMembers.find(m => m.email === email); };
const addTeamMember = (memberData) => {
    readDb();
    const newMember = { ...memberData, id: getNextId('teamMember') };
    db.teamMembers.push(newMember);
    writeDb();
    return newMember;
};
const updateTeamMember = (id, updates) => {
    readDb();
    const memberIndex = db.teamMembers.findIndex(m => m.id === id);
    if (memberIndex === -1) return null;
    db.teamMembers[memberIndex] = { ...db.teamMembers[memberIndex], ...updates, id };
    writeDb();
    return db.teamMembers[memberIndex];
};
const deleteTeamMember = (id) => {
    readDb();
    const memberIndex = db.teamMembers.findIndex(m => m.id === id);
    if (memberIndex === -1) return null;
    const [deletedMember] = db.teamMembers.splice(memberIndex, 1);
    writeDb();
    return deletedMember;
};


// --- Notifications ---
const getNotifications = () => { readDb(); return db.notifications; };
const addNotification = (notificationData) => {
    readDb();
    const newNotification = { ...notificationData, id: getNextId('notification') };
    db.notifications.unshift(newNotification);
    writeDb();
    return newNotification;
};
const markAllNotificationsAsRead = () => {
    readDb();
    db.notifications.forEach(n => n.read = true);
    writeDb();
};

// --- Ad Dashboard ---
const getAdAccounts = () => { readDb(); return db.adAccounts; };
const getAdCampaignsByAccountId = (accountId) => { readDb(); return db.adCampaigns.filter(c => c.accountId === accountId); };

// --- Settings ---
const getSettings = () => { readDb(); return db.settings; };
const updateSettings = (updates) => {
    readDb();
    db.settings = { ...db.settings, ...updates };
    writeDb();
    return db.settings;
};


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
    getComments,
    getCommentById,
    addComment,
    updateComment,
    getKnowledgeBaseItems,
    addKnowledgeBaseItem,
    deleteKnowledgeBaseItem,
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
    getSettings,
    updateSettings,
};