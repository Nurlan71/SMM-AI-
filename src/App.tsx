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
import { StrategyGeneratorScreen } from './screens/StrategyGeneratorScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TrendSpotterScreen } from './screens/TrendSpotterScreen';
import { ContentAdapterScreen } from './screens/ContentAdapterScreen';
import { CompetitorAnalysisScreen } from './screens/CompetitorAnalysisScreen';
import type { Screen } from './types';

// Stubs for other screens - they will be implemented in their own files later


const screenMap: { [key in Screen]: { component: React.ComponentType, title: string } } = {
    'content-plan': { component: ContentPlanScreen, title: 'Контент-план' },
    'community': { component: CommunityScreen, title: 'Сообщество' },
    'analytics': { component: AnalyticsScreen, title: 'Аналитика' },
    'knowledge-base': { component: KnowledgeBaseScreen, title: 'База знаний и Бренд' },
    'post-generator': { component: PostGeneratorScreen, title: 'Генератор постов' },
    'image-generator': { component: ImageGeneratorScreen, title: 'Генератор изображений' },
    'image-editor': { component: ImageEditorScreen, title: 'Редактор изображений' },
    'video-generator': { component: VideoGeneratorScreen, title: 'Генератор видео' },
    'strategy-generator': { component: StrategyGeneratorScreen, title: 'Генератор стратегий' },
    'trend-spotter': { component: TrendSpotterScreen, title: 'Поиск трендов' },
    'content-adapter': { component: ContentAdapterScreen, title: 'Адаптер контента' },
    'competitor-analysis': { component: CompetitorAnalysisScreen, title: 'Анализ конкурентов' },
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
    
    // This effect is no longer needed as the initial state of AppContext handles it
    // useEffect(() => {
    //     const token = localStorage.getItem('smm_ai_token');
    //     if (token) {
    //         appDispatch({ type: 'LOGIN_SUCCESS' });
    //     }
    // }, [appDispatch]);

    useEffect(() => {
        if (appState.isLoggedIn) {
            const loadInitialData = async () => {
                dataDispatch({ type: 'SET_LOADING', payload: true });
                try {
                    const [postsRes, filesRes, settingsRes, commentsRes, notificationsRes, knowledgeRes, teamRes] = await Promise.all([
                        fetchWithAuth(`${API_BASE_URL}/api/posts`),
                        fetchWithAuth(`${API_BASE_URL}/api/files`),
                        fetchWithAuth(`${API_BASE_URL}/api/settings`),
                        fetchWithAuth(`${API_BASE_URL}/api/comments`),
                        fetchWithAuth(`${API_BASE_URL}/api/notifications`),
                        fetchWithAuth(`${API_BASE_URL}/api/knowledge`),
                        fetchWithAuth(`${API_BASE_URL}/api/team`),
                    ]);
                    // Assuming fetchWithAuth now parses JSON
                    dataDispatch({ type: 'SET_INITIAL_DATA', payload: { posts: postsRes, files: filesRes, settings: settingsRes, comments: commentsRes, notifications: notificationsRes, knowledgeBaseItems: knowledgeRes, team: teamRes } });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Не удалось загрузить данные.";
                    dataDispatch({ type: 'SET_ERROR', payload: errorMessage });
                    addToast(errorMessage, 'error');
                }
            };
            loadInitialData();
        }
    }, [appState.isLoggedIn, dataDispatch, addToast]);


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