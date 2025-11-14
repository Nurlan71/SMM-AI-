module.exports = {
  apps: [{
    name: 'smm-ai-backend',
    script: './smm-ai-backend/index.js',
    watch: false,
    env: {
      "NODE_ENV": "production",
    }
  }]
};