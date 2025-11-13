module.exports = {
  apps: [{
    name: 'smm-ai-backend',
    script: 'npm',
    args: 'start',
    cwd: './smm-ai-backend', // Указываем правильную рабочую директорию
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    // Переменные окружения будут переданы через команду `pm2 start`
    // но эта структура позволяет определять их и здесь
    env: {
      NODE_ENV: 'production',
    },
  }],
};
