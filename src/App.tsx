import React, { useState, useEffect, useCallback } from 'react';
import AuthScreen from './components/AuthScreen';
import { styles } from './styles';
import { Post } from './types';
import { MOCK_SCHEDULED_POSTS, MOCK_UNSCHEDULED_POSTS } from './lib/data';

// For now, these are placeholders to show the structure
const ContentPlanScreen = ({ allPosts, setAllPosts, toneOfVoice, keywords, onOpenCampaignWizard, addToast }) => <div style={{padding: 20}}>Контент-план (в разработке)</div>;

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('smm_ai_token'));
  const [activeScreen, setActiveScreen] = useState('plan');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [allPosts, setAllPosts] = useState<Post[]>([]);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem('smm_ai_token', token);
    setIsAuthenticated(true);
    // You might want to navigate to the main screen here
    setActiveScreen('plan');
  };
  
  const handleLogout = useCallback(() => {
    localStorage.removeItem('smm_ai_token');
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    const forcedLogout = () => handleLogout();
    window.addEventListener('forceLogout', forcedLogout);
    return () => window.removeEventListener('forceLogout', forcedLogout);
  }, [handleLogout]);

  // Mock data loading
  useEffect(() => {
    if (isAuthenticated) {
      setAllPosts([...MOCK_UNSCHEDULED_POSTS, ...MOCK_SCHEDULED_POSTS]);
      // fetchFiles(); // This would be the real implementation
    }
  }, [isAuthenticated]);
  
  // Handle sidebar visibility on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  if (!isAuthenticated) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }
  
  return (
    <div style={styles.dashboardLayout}>
      <aside style={{...styles.sidebar, left: isSidebarOpen ? '0' : '-100%'}} className={isSidebarOpen ? 'open' : ''}>
        <div style={styles.logo}>SMM AI</div>
        <nav style={styles.nav}>
            <a href="#" style={styles.navLink} onClick={() => setActiveScreen('plan')}>Контент-план</a>
            {/* Add other links here */}
        </nav>
        <div style={{marginTop: 'auto'}}>
            <button onClick={handleLogout} style={styles.logoutButton}>Выйти</button>
        </div>
      </aside>
      <main style={styles.mainContent}>
        <header style={styles.topBar}>
           <button style={styles.burgerButton} className="burgerButton" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
           <h1 style={styles.screenTitle}>Контент-план</h1>
        </header>
        <div style={styles.screenContent}>
           {activeScreen === 'plan' && <ContentPlanScreen allPosts={allPosts} setAllPosts={setAllPosts} toneOfVoice="" keywords="" onOpenCampaignWizard={() => {}} addToast={() => {}} />}
           {/* other screens... */}
        </div>
      </main>
    </div>
  );
};

export default App;
