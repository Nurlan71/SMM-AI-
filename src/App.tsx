import React, { useEffect, useCallback } from 'react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { DataProvider, useDataContext } from './contexts/DataContext';
import { fetchWithAuth, API_BASE_URL } from './api';
import { styles } from './styles';

import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ToastContainer } from './components/Toast';
import { CampaignWizardModal } from './components/modals/CampaignWizardModal';
import { AICopilotModal } from './components/modals/AICopilotModal';
import { PostDetailModal } from './components/modals/PostDetailModal';
import { ReportModal } from './components/modals/ReportModal';
import { AdReportModal } from './components/modals/AdReportModal';
import { TelegramConnectModal } from './components/modals/TelegramConnectModal';
import { AddAccountModal } from './components/modals/AddAccountModal';


// Импортируем настоящие экраны
import { CommunityScreen } from './screens/CommunityScreen';
import { ContentPlanScreen } from './screens/ContentPlanScreen';
import { KnowledgeBaseScreen } from './screens/KnowledgeBaseScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { PostGeneratorScreen } from './screens/PostGeneratorScreen';
import { ImageGeneratorScreen } from './screens/ImageGeneratorScreen';
import { ImageEditorScreen } from './screens/ImageEditorScreen';
import { VideoGeneratorScreen } from './screens/VideoGeneratorScreen';
import { VideoEditorScreen } from './screens/VideoEditorScreen';
import { StrategyGeneratorScreen } from './screens/StrategyGeneratorScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TrendSpotterScreen } from './screens/TrendSpotterScreen';
import { ContentAdapterScreen } from './screens/ContentAdapterScreen';
import { CompetitorAnalysisScreen } from './screens/CompetitorAnalysisScreen';
import { AdDashboardScreen } from './screens/AdDashboardScreen';
import type { Screen, Project } from './types';

const screenMap: { [key in Screen]: { component: React.ComponentType, title: string } } = {
    'content-plan': { component: ContentPlanScreen, title: 'Контент-план' },
    'community': { component: CommunityScreen, title: 'Сообщество' },
    'analytics': { component: AnalyticsScreen, title: 'Аналитика' },
    'knowledge-base': { component: KnowledgeBaseScreen, title: 'База знаний и Бренд' },
    'post-generator': { component: PostGeneratorScreen, title: 'Генератор постов' },
    'image-generator': { component: ImageGeneratorScreen, title: 'Генератор изображений' },
    'image-editor': { component: ImageEditorScreen, title: 'Редактор изображений' },
    'video-generator': { component: VideoGeneratorScreen, title: 'Генератор видео' },
    'video-editor': { component: VideoEditorScreen, title: 'Редактор видео' },
    'strategy-generator': { component: StrategyGeneratorScreen, title: 'Генератор стратегий' },
    'trend-spotter': { component: TrendSpotterScreen, title: 'Поиск трендов' },
    'content-adapter': { component: ContentAdapterScreen, title: 'Адаптер контента' },
    'competitor-analysis': { component: CompetitorAnalysisScreen, title: 'Анализ конкурентов' },
    'ad-dashboard': { component: AdDashboardScreen, title: 'Рекламный кабинет' },
    'settings': { component: SettingsScreen, title: 'Настройки' },
};

const MainApp = () => {
    const { state: appState, dispatch: appDispatch } = useAppContext();
    const { dispatch: dataDispatch } = useDataContext();

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        appDispatch({ type: 'ADD_TOAST', payload: { message, type } });
    }, [appDispatch]);
    
    const forceLogout = useCallback(() => {
        localStorage.removeItem('smm_ai_token');
        appDispatch({ type: 'LOGOUT' });
        addToast("Ваша сессия истекла. Пожалуйста, войдите снова.", "error");
    }, [appDispatch, addToast]);

    useEffect(() => {
        window.addEventListener('forceLogout', forceLogout);
        return () => {
            window.removeEventListener('forceLogout', forceLogout);
        };
    }, [forceLogout]);
    
    // 1. Fetch projects on login
    useEffect(() => {
        if (appState.isLoggedIn) {
            const loadProjects = async () => {
                try {
                    const projects: Project[] = await fetchWithAuth(`${API_BASE_URL}/api/projects`);
                    appDispatch({ type: 'SET_PROJECTS', payload: projects });
                    
                    // Set active project
                    const storedProjectId = localStorage.getItem('smm_ai_activeProjectId');
                    const activeProject = projects.find(p => p.id === Number(storedProjectId));
                    if (activeProject) {
                        appDispatch({ type: 'SET_ACTIVE_PROJECT_ID', payload: activeProject.id });
                    } else if (projects.length > 0) {
                        appDispatch({ type: 'SET_ACTIVE_PROJECT_ID', payload: projects[0].id });
                    }
                } catch (error) {
                    addToast("Не удалось загрузить проекты.", 'error');
                }
            };
            loadProjects();
        }
    }, [appState.isLoggedIn, appDispatch, addToast]);

    // 2. Fetch data when active project changes
    useEffect(() => {
        if (appState.isLoggedIn && appState.activeProjectId) {
            const loadProjectData = async () => {
                dataDispatch({ type: 'SET_LOADING', payload: true });
                try {
                    // Fetch all data for the current project
                    const [postsRes, filesRes, settingsRes, commentsRes, notificationsRes, knowledgeRes, teamRes] = await Promise.all([
                        fetchWithAuth(`${API_BASE_URL}/api/posts`),
                        fetchWithAuth(`${API_BASE_URL}/api/files`),
                        fetchWithAuth(`${API_BASE_URL}/api/settings`),
                        fetchWithAuth(`${API_BASE_URL}/api/comments`),
                        fetchWithAuth(`${API_BASE_URL}/api/notifications`),
                        fetchWithAuth(`${API_BASE_URL}/api/knowledge`),
                        fetchWithAuth(`${API_BASE_URL}/api/team`),
                    ]);
                    
                    dataDispatch({ type: 'SET_PROJECT_DATA', payload: { posts: postsRes, files: filesRes, settings: settingsRes, comments: commentsRes, notifications: notificationsRes, knowledgeBaseItems: knowledgeRes, team: teamRes } });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Не удалось загрузить данные проекта.";
                    dataDispatch({ type: 'SET_ERROR', payload: errorMessage });
                    addToast(errorMessage, 'error');
                }
            };
            loadProjectData();
        } else if (appState.isLoggedIn) {
            // Logged in but no project selected/available
             dataDispatch({ type: 'CLEAR_DATA' });
             dataDispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [appState.isLoggedIn, appState.activeProjectId, dataDispatch, addToast]);


    if (!appState.isLoggedIn) {
        return <AuthScreen />;
    }

    const ActiveScreen = screenMap[appState.activeScreen].component;
    const screenTitle = screenMap[appState.activeScreen].title;

    return (
        <div style={styles.dashboardLayout}>
            <Sidebar />
            <main style={styles.mainContent}>
                <TopBar screenTitle={screenTitle} />
                <div style={styles.screenContent}>
                    <ActiveScreen />
                </div>
            </main>
            <ToastContainer />
            {appState.isCampaignWizardOpen && <CampaignWizardModal />}
            {appState.isCopilotOpen && <AICopilotModal />}
            {appState.isPostDetailModalOpen && <PostDetailModal />}
            {appState.isReportModalOpen && <ReportModal />}
            {appState.isAdReportModalOpen && <AdReportModal />}
            {appState.isTelegramConnectModalOpen && <TelegramConnectModal />}
            {appState.isAddAccountModalOpen && <AddAccountModal />}
             <button
                style={{...styles.copilotFab, transform: appState.isCopilotOpen ? 'scale(0.8)' : 'scale(1)'}}
                onClick={() => appDispatch({ type: 'SET_COPILOT_OPEN', payload: true })}
                aria-label="Открыть AI Co-pilot"
            >
                🎙️
            </button>
        </div>
    );
};

export const App = () => {
    return (
        <AppProvider>
            <DataProvider>
                <MainApp />
            </DataProvider>
        </AppProvider>
    );
};