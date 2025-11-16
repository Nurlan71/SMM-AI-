import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL } from '../api';
import { styles } from '../styles';

export const AuthScreen = () => {
  const { dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('dev@smm.ai');
  const [password, setPassword] = useState('password');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      setIsLoading(false);
      return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Не удалось зарегистрироваться.');
        }

        setSuccess('Регистрация прошла успешно! Теперь вы можете войти.');
        setActiveTab('login');
        setPassword('');
        setConfirmPassword('');

    } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('Произошла ошибка при регистрации.');
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось войти в систему.');
      }
      
      localStorage.setItem('smm_ai_token', data.token);
      dispatch({ type: 'LOGIN_SUCCESS' });

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Произошла ошибка. Пожалуйста, проверьте ваше соединение и попробуйте снова.');
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div style={styles.authPage}>
      <div style={styles.authPanelLeft}>
        <div style={{...styles.authBlob, ...styles.authBlob1}}></div>
        <div style={{...styles.authBlob, ...styles.authBlob2}}></div>
        <div style={{...styles.authBlob, ...styles.authBlob3}}></div>
        <div style={styles.authPanelContent}>
          <h1 style={styles.authTitle}>SMM AI</h1>
          <p style={styles.authSubtitle}>Ваш интеллектуальный ассистент в мире социальных сетей.</p>
        </div>
      </div>
      <div style={styles.authPanelRight}>
        <div style={styles.authFormContainer}>
          <div style={styles.authTabs}>
            <button
              style={activeTab === 'login' ? styles.authTabActive : styles.authTab}
              onClick={() => setActiveTab('login')}
            >
              Вход
            </button>
            <button
              style={activeTab === 'register' ? styles.authTabActive : styles.authTab}
              onClick={() => setActiveTab('register')}
            >
              Регистрация
            </button>
          </div>
          
          {error && <p style={{...styles.authMessage, ...styles.authMessageError}}>{error}</p>}
          {success && <p style={{...styles.authMessage, ...styles.authMessageSuccess}}>{success}</p>}

          {activeTab === 'login' ? (
            <form style={styles.authForm} onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email (dev@smm.ai)"
                style={styles.authInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Пароль (password)"
                style={styles.authInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" style={isLoading ? styles.buttonDisabled : styles.authButton} className="authButton" disabled={isLoading}>{isLoading ? 'Вход...' : 'Войти'}</button>
            </form>
          ) : (
            <form style={styles.authForm} onSubmit={handleRegister}>
              <input
                type="email"
                placeholder="Email"
                style={styles.authInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Пароль"
                style={styles.authInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Подтвердите пароль"
                style={styles.authInput}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button type="submit" style={isLoading ? styles.buttonDisabled : styles.authButton} className="authButton" disabled={isLoading}>{isLoading ? 'Регистрация...' : 'Зарегистрироваться'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};