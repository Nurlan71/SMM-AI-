// Fix: To resolve TypeScript errors with `import.meta.env` and missing `vite/client` types,
// a global variable `__IS_PROD__` is now used. It is defined in `vite.config.js`.
declare const __IS_PROD__: boolean;

export const API_BASE_URL = __IS_PROD__ ? '' : 'http://localhost:3001';

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('smm_ai_token');

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    window.dispatchEvent(new CustomEvent('forceLogout'));
    throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
  }

  if (response.status === 204) {
    return null;
  }

  const responseData = await response.json().catch(() => {
    return { message: `Сервер вернул ошибку ${response.status}` };
  });

  if (!response.ok) {
    throw new Error(responseData.message || `Ошибка: ${response.statusText}`);
  }

  return responseData;
};
