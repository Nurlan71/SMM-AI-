export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('smm_ai_token');

  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    // Unauthorized or Forbidden, force logout
    window.dispatchEvent(new CustomEvent('forceLogout'));
    throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Произошла ошибка' }));
    throw new Error(errorData.message);
  }

  return response.json();
};
