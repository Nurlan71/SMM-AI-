import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Fix: Modified defineConfig to accept a function to access the build `mode`.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Fix: Added a `define` configuration to create a global constant `__IS_PROD__`.
  // This replaces `import.meta.env.PROD` and resolves TypeScript errors in `src/api.ts`
  // when `vite/client` types are unavailable.
  define: {
    '__IS_PROD__': mode === 'production',
  },
}));
