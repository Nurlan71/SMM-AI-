// Fix: To resolve TypeScript errors with `import.meta.env` and missing `vite/client` types,
// a global variable `__IS_PROD__` is now used. It is defined in `vite.config.js`.
declare const __IS_PROD__: boolean;

export const API_BASE_URL = __IS_PROD__ ? '' : 'http://localhost:3001';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {},
  retries = 3,
  onRetry?: (attempt: number) => void
) => {
  const token = localStorage.getItem('smm_ai_token');
  const projectId = localStorage.getItem('smm_ai_activeProjectId');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      if (projectId) {
          headers.set('X-Project-ID', projectId);
      }
      
      if (!(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(url, { ...options, headers });

      if (response.status === 401 || response.status === 403) {
        window.dispatchEvent(new CustomEvent('forceLogout'));
        throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
      }
      
      // If we get a server error, we should retry
      if (response.status >= 500 && attempt < retries) {
        if (onRetry) onRetry(attempt);
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s
        console.warn(`Server error ${response.status}. Retrying in ${delay / 1000}s... (Attempt ${attempt}/${retries})`);
        await sleep(delay);
        continue; // Go to the next iteration of the loop
      }

      if (response.status === 204) {
        return null;
      }
      
      const responseData = await response.json().catch(() => {
          // If response is not JSON, it might be a text error message from the server
          return response.text().then(text => {
              throw new Error(text || `Сервер вернул ошибку ${response.status}`);
          });
      });

      if (!response.ok) {
        // For client errors (4xx), don't retry, just throw
        throw new Error(responseData.message || `Ошибка: ${response.statusText}`);
      }

      return responseData; // Success, exit the loop

    } catch (error) {
      if (attempt === retries) {
        // If this was the last attempt, re-throw the error
        throw error;
      }
    }
  }
};