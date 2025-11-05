export const API_BASE_URL = 'http://localhost:3001';

// Helper для аутентифицированных запросов
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('smm_ai_token');
    const headers = new Headers(options.headers || {});
    
    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
    }

    if (!(options.body instanceof FormData)) {
        if (!headers.has('Content-Type')) {
            headers.append('Content-Type', 'application/json');
        }
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // This custom event will be listened to in App.tsx to force a logout
        window.dispatchEvent(new CustomEvent('forceLogout'));
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'Произошла ошибка на сервере.');
    }

    return response;
};
