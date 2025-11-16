import React, { createContext, useReducer, useContext } from 'react';
import type { Screen, Toast, Project } from '../types';

// --- App Context (UI State) ---
export interface AppState {
    isLoggedIn: boolean;
    activeScreen: Screen;
    isSidebarOpen: boolean;
    isAiToolsOpen: boolean;
    toasts: Toast[];
    projects: Project[];
    activeProjectId: number | null;
    isCampaignWizardOpen: boolean;
    isCopilotOpen: boolean;
    isPostDetailModalOpen: boolean;
    isReportModalOpen: boolean;
    isAdReportModalOpen: boolean;
    isTelegramConnectModalOpen: boolean;
    isAddAccountModalOpen: boolean;
    activePostId: number | null;
}

export type AppAction =
    | { type: 'LOGIN_SUCCESS' }
    | { type: 'LOGOUT' }
    | { type: 'SET_ACTIVE_SCREEN'; payload: Screen }
    | { type: 'TOGGLE_SIDEBAR' }
    | { type: 'SET_SIDEBAR'; payload: boolean }
    | { type: 'TOGGLE_AI_TOOLS' }
    | { type: 'ADD_TOAST'; payload: Omit<Toast, 'id'> }
    | { type: 'REMOVE_TOAST'; payload: number }
    | { type: 'SET_PROJECTS'; payload: Project[] }
    | { type: 'ADD_PROJECT'; payload: Project }
    | { type: 'UPDATE_PROJECT'; payload: Project }
    | { type: 'DELETE_PROJECT'; payload: number }
    | { type: 'SET_ACTIVE_PROJECT_ID'; payload: number }
    | { type: 'SET_CAMPAIGN_WIZARD_OPEN'; payload: boolean }
    | { type: 'SET_COPILOT_OPEN'; payload: boolean }
    | { type: 'SET_REPORT_MODAL_OPEN', payload: boolean }
    | { type: 'SET_AD_REPORT_MODAL_OPEN', payload: boolean }
    | { type: 'SET_TELEGRAM_CONNECT_MODAL_OPEN', payload: boolean }
    | { type: 'SET_ADD_ACCOUNT_MODAL_OPEN', payload: boolean }
    | { type: 'OPEN_POST_DETAIL_MODAL'; payload: number }
    | { type: 'CLOSE_POST_DETAIL_MODAL' };

const initialAppState: AppState = {
    isLoggedIn: !!localStorage.getItem('smm_ai_token'), // Check token on initial load
    activeScreen: 'content-plan',
    isSidebarOpen: window.innerWidth > 768,
    isAiToolsOpen: true,
    toasts: [],
    projects: [],
    activeProjectId: Number(localStorage.getItem('smm_ai_activeProjectId')) || null,
    isCampaignWizardOpen: false,
    isCopilotOpen: false,
    isPostDetailModalOpen: false,
    isReportModalOpen: false,
    isAdReportModalOpen: false,
    isTelegramConnectModalOpen: false,
    isAddAccountModalOpen: false,
    activePostId: null,
};

export const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<AppAction> }>({
    state: initialAppState,
    dispatch: () => null,
});

export const appReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'LOGIN_SUCCESS':
            return { ...state, isLoggedIn: true };
        case 'LOGOUT':
            localStorage.removeItem('smm_ai_activeProjectId');
            return { ...state, isLoggedIn: false, activeScreen: 'content-plan', projects: [], activeProjectId: null };
        case 'SET_ACTIVE_SCREEN':
            return { ...state, activeScreen: action.payload };
        case 'TOGGLE_SIDEBAR':
            return { ...state, isSidebarOpen: !state.isSidebarOpen };
        case 'SET_SIDEBAR':
            return { ...state, isSidebarOpen: action.payload };
        case 'TOGGLE_AI_TOOLS':
            return { ...state, isAiToolsOpen: !state.isAiToolsOpen };
        case 'ADD_TOAST':
            return { ...state, toasts: [...state.toasts, { ...action.payload, id: Date.now() }] };
        case 'REMOVE_TOAST':
            return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
        case 'SET_PROJECTS':
            return { ...state, projects: action.payload };
        case 'ADD_PROJECT':
            return { ...state, projects: [...state.projects, action.payload] };
        case 'UPDATE_PROJECT':
            return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? action.payload : p) };
        case 'DELETE_PROJECT': {
            const newProjects = state.projects.filter(p => p.id !== action.payload);
            let newActiveProjectId = state.activeProjectId;
            // If the deleted project was the active one, switch to another project
            if (state.activeProjectId === action.payload) {
                newActiveProjectId = newProjects[0]?.id || null;
                if (newActiveProjectId) {
                    localStorage.setItem('smm_ai_activeProjectId', String(newActiveProjectId));
                } else {
                    localStorage.removeItem('smm_ai_activeProjectId');
                }
            }
            return { ...state, projects: newProjects, activeProjectId: newActiveProjectId };
        }
        case 'SET_ACTIVE_PROJECT_ID':
            localStorage.setItem('smm_ai_activeProjectId', String(action.payload));
            return { ...state, activeProjectId: action.payload };
        case 'SET_CAMPAIGN_WIZARD_OPEN':
            return { ...state, isCampaignWizardOpen: action.payload };
        case 'SET_COPILOT_OPEN':
            return { ...state, isCopilotOpen: action.payload };
        case 'SET_REPORT_MODAL_OPEN':
            return { ...state, isReportModalOpen: action.payload };
        case 'SET_AD_REPORT_MODAL_OPEN':
            return { ...state, isAdReportModalOpen: action.payload };
        case 'SET_TELEGRAM_CONNECT_MODAL_OPEN':
            return { ...state, isTelegramConnectModalOpen: action.payload };
        case 'SET_ADD_ACCOUNT_MODAL_OPEN':
            return { ...state, isAddAccountModalOpen: action.payload };
        case 'OPEN_POST_DETAIL_MODAL':
            return { ...state, isPostDetailModalOpen: true, activePostId: action.payload };
        case 'CLOSE_POST_DETAIL_MODAL':
            return { ...state, isPostDetailModalOpen: false, activePostId: null };
        default:
            return state;
    }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialAppState);
    return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);