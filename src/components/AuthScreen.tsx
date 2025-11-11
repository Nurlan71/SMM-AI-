import React, { useState } from 'react';
import { styles } from '../styles'; // Assuming styles are centralized

interface AuthScreenProps {
  onLoginSuccess: (token: string) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('dev@smm.ai');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isLoginView ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Что-то пошло не так');
      }

      if (isLoginView) {
        onLoginSuccess(data.token);
      } else {
        // Automatically switch to login view after successful registration
        setIsLoginView(true);
        setError('Регистрация прошла успешно! Теперь вы можете войти.');
      }

    } catch (err: any) {
      setError(err.message || 'Не удалось подключиться к серверу.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.authPage}>
      <div style={styles.authPanelLeft}>
        <h1 style={styles.authTitle}>SMM AI</h1>
        <p style={styles.authSubtitle}>Ваш интеллектуальный ассистент в мире социальных сетей.</p>
      </div>
      <div style={styles.authPanelRight}>
        <div style={styles.authFormContainer}>
          <div style={styles.authTabs}>
            <button
              style={isLoginView ? styles.authTabActive : styles.authTab}
              onClick={() => setIsLoginView(true)}
            >
              Вход
            </button>
            <button
              style={!isLoginView ? styles.authTabActive : styles.authTab}
              onClick={() => setIsLoginView(false)}
            >
              Регистрация
            </button>
          </div>
          <form onSubmit={handleSubmit} style={styles.authForm}>
            {error && <p style={styles.authError}>{error}</p>}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.authInput}
              required
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.authInput}
              required
            />
            <button type="submit" style={styles.authButton} disabled={isLoading}>
              {isLoading ? (isLoginView ? 'Входим...' : 'Регистрируемся...') : (isLoginView ? 'Войти' : 'Создать аккаунт')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
