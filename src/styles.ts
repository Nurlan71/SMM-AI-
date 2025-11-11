import React from 'react';

type Styles = {
  [key: string]: React.CSSProperties;
};

export const styles: Styles = {
  // --- AuthScreen Styles ---
  authPage: {
    display: 'flex',
    height: '100%',
    width: '100%',
    backgroundColor: '#fff',
  },
  authPanelLeft: {
    width: '50%',
    backgroundColor: '#007bff',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '40px',
  },
  authTitle: {
    fontSize: '48px',
    fontWeight: 700,
    marginBottom: '16px',
  },
  authSubtitle: {
    fontSize: '24px',
    maxWidth: '400px',
  },
  authPanelRight: {
    width: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authFormContainer: {
    width: '100%',
    maxWidth: '400px',
  },
  authTabs: {
    display: 'flex',
    marginBottom: '24px',
    borderBottom: '1px solid #e0e0e0',
  },
  authTab: {
    padding: '12px 24px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    color: '#888',
  },
  authTabActive: {
    padding: '12px 24px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    color: '#007bff',
    fontWeight: '600',
    borderBottom: '2px solid #007bff',
  },
  authForm: {
    display: 'flex',
    flexDirection: 'column',
  },
  authError: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '16px',
    textAlign: 'center' as const,
  },
  authInput: {
    padding: '12px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  authButton: {
    padding: '12px',
    fontSize: '16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  // --- Dashboard Layout ---
  dashboardLayout: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  sidebar: {
    width: '250px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e0e0e0',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.3s ease',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topBar: {
    height: '64px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    backgroundColor: '#fff',
  },
  burgerButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    marginRight: '16px',
  },
  screenTitle: {
    fontSize: '24px',
    fontWeight: 600,
  },
  screenContent: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    backgroundColor: '#f0f2f5',
  },
  logo: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#007bff',
    marginBottom: '32px',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  navLink: {
    textDecoration: 'none',
    color: '#333',
    padding: '12px 16px',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
  },
  logoutButton: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    background: '#f0f2f5',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left' as const,
  }
};
