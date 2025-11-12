import React, { createContext, useReducer, useContext } from 'react';
import type { Post, AppFile, Comment, TeamMember, Settings, Notification } from '../types';

// --- MOCK DATA ---
const MOCK_TEAM: TeamMember[] = [
    { id: 1, email: 'owner@smm.ai', role: 'Владелец' },
    { id: 2, email: 'manager@smm.ai', role: 'SMM-менеджер' },
    { id: 3, email: 'guest@smm.ai', role: 'Гость' },
];
// --- END MOCK DATA ---

// --- Data Context (App Data) ---
export interface DataState {
    posts: Post[];
    files: AppFile[];
    comments: Comment[];
    team: TeamMember[];
    settings: Settings;
    notifications: Notification[];
    dataLoading: boolean;
    dataError: string | null;
}

export type DataAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_INITIAL_DATA'; payload: { posts: Post[]; files: AppFile[]; settings: Settings; comments: Comment[], notifications: Notification[] } }
    | { type: 'SET_POSTS'; payload: Post[] }
    | { type: 'ADD_POST'; payload: Post }
    | { type: 'ADD_MANY_POSTS'; payload: Post[] }
    | { type: 'UPDATE_POST'; payload: Post }
    | { type: 'DELETE_POST'; payload: number }
    | { type: 'SET_FILES'; payload: AppFile[] }
    | { type: 'ADD_FILES'; payload: AppFile[] }
    | { type: 'DELETE_FILE'; payload: number }
    | { type: 'SET_COMMENTS'; payload: Comment[] }
    | { type: 'ADD_COMMENTS'; payload: Comment[] }
    | { type: 'UPDATE_COMMENT'; payload: Comment }
    | { type: 'SET_TEAM'; payload: TeamMember[] }
    | { type: 'ADD_TEAM_MEMBER'; payload: TeamMember }
    | { type: 'REMOVE_TEAM_MEMBER'; payload: number }
    | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
    | { type: 'SET_SETTINGS'; payload: Settings };

const initialDataState: DataState = {
    posts: [],
    files: [],
    comments: [],
    team: MOCK_TEAM,
    settings: {
        toneOfVoice: "Дружелюбный и экспертный. Обращаемся к клиентам на 'вы', используем эмодзи для настроения.",
        keywords: "ключевые: #одеждаручнойработы, #натуральныеткани; стоп-слова: дешевый, скидка",
        targetAudience: "Женщины 25-45 лет, ценящие уют, натуральные материалы и ручную работу. Интересуются модой, но предпочитают классику и качество.",
        brandVoiceExamples: [],
        platforms: ['instagram', 'telegram', 'vk'],
    },
    notifications: [],
    dataLoading: true,
    dataError: null,
};

export const DataContext = createContext<{ state: DataState; dispatch: React.Dispatch<DataAction> }>({
    state: initialDataState,
    dispatch: () => null,
});

export const dataReducer = (state: DataState, action: DataAction): DataState => {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, dataLoading: action.payload };
        case 'SET_ERROR':
            return { ...state, dataError: action.payload, dataLoading: false };
        case 'SET_INITIAL_DATA':
            const { posts, files, settings, comments, notifications } = action.payload;
            return {
                ...state,
                posts: Array.isArray(posts) ? posts : [],
                files: Array.isArray(files) ? files : [],
                comments: Array.isArray(comments) ? comments : [],
                notifications: Array.isArray(notifications) ? notifications : [],
                settings: settings || state.settings,
                dataLoading: false,
                dataError: null,
            };
        case 'SET_POSTS':
            return { ...state, posts: action.payload };
        case 'ADD_POST':
            return { ...state, posts: [...state.posts, action.payload] };
        case 'ADD_MANY_POSTS':
            return { ...state, posts: [...state.posts, ...action.payload] };
        case 'UPDATE_POST':
            return { ...state, posts: state.posts.map(p => p.id === action.payload.id ? action.payload : p) };
        case 'DELETE_POST':
            return { ...state, posts: state.posts.filter(p => p.id !== action.payload) };
        case 'SET_FILES':
            return { ...state, files: action.payload };
        case 'ADD_FILES':
            return { ...state, files: [...action.payload, ...state.files] };
        case 'DELETE_FILE':
            return { ...state, files: state.files.filter(f => f.id !== action.payload) };
        case 'SET_COMMENTS':
            return { ...state, comments: action.payload };
        case 'ADD_COMMENTS':
             return { ...state, comments: [...action.payload, ...state.comments] };
        case 'UPDATE_COMMENT':
            return { ...state, comments: state.comments.map(c => c.id === action.payload.id ? action.payload : c) };
        case 'SET_TEAM':
            return { ...state, team: action.payload };
        case 'ADD_TEAM_MEMBER':
            return { ...state, team: [...state.team, action.payload] };
        case 'REMOVE_TEAM_MEMBER':
            return { ...state, team: state.team.filter(m => m.id !== action.payload) };
        case 'SET_SETTINGS':
            return { ...state, settings: action.payload };
        case 'SET_NOTIFICATIONS':
             return { ...state, notifications: action.payload };
        default:
            return state;
    }
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, initialDataState);
    return <DataContext.Provider value={{ state, dispatch }}>{children}</DataContext.Provider>;
};

export const useDataContext = () => useContext(DataContext);