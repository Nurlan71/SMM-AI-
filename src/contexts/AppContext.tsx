import React, { createContext, useReducer, useContext } from 'react';
import type { Screen, Toast } from '../types';

// --- App Context (UI State) ---
export interface AppState {
    isLoggedIn: boolean;
    activeScreen: Screen;
    isSidebarOpen: boolean;
    isAiToolsOpen: boolean;
    toasts: Toast[];
    isCampaignWizardOpen: boolean;
    isCopilotOpen: boolean;
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
    | { type: 'SET_CAMPAIGN_WIZARD_OPEN'; payload: boolean }
    | { type: 'SET_COPILOT_OPEN'; payload: boolean };

const initialAppState: AppState = {
    isLoggedIn: false,
    activeScreen: 'content-plan',
    isSidebarOpen: window.innerWidth > 768,
    isAiToolsOpen: true,
    toasts: [],
    isCampaignWizardOpen: false,
    isCopilotOpen: false,
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
            return { ...state, isLoggedIn: false, activeScreen: 'content-plan' };
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
        case 'SET_CAMPAIGN_WIZARD_OPEN':
            return { ...state, isCampaignWizardOpen: action.payload };
        case 'SET_COPILOT_OPEN':
            return { ...state, isCopilotOpen: action.payload };
        default:
            return state;
    }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialAppState);
    return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
