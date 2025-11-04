import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Загружаем переменные окружения из .env файла
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // "Пробрасываем" ключ API в приложение, чтобы он был доступен через process.env.API_KEY
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY)
    }
  }
})
