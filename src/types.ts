// A list of all available screens in the app
export type Screen =
    | 'content-plan'
    | 'community'
    | 'analytics'
    | 'knowledge-base'
    | 'post-generator'
    | 'image-generator'
    | 'image-editor'
    | 'video-generator'
    | 'video-editor'
    | 'strategy-generator'
    | 'trend-spotter'
    | 'content-adapter'
    | 'competitor-analysis'
    | 'ad-dashboard'
    | 'settings';

export type Toast = {
    id: number;
    message: string;
    type: 'success' | 'error';
};

export interface Project {
    id: number;
    name: string;
}

export type Platform = 'instagram' | 'telegram' | 'vk' | 'facebook' | 'youtube' | 'tiktok' | 'twitter' | 'linkedin' | 'dzen';

export type PostStatus = 'idea' | 'draft' | 'scheduled' | 'published' | 'error';

export interface PostVariant {
    text: string;
    likesCount: number;
    commentsCount: number;
}

export interface Post {
    id: number;
    platform: Platform;
    content: string;
    media: string[]; // array of URLs to media files
    status: PostStatus;
    publishDate?: string; // ISO string
    tags: string[];
    commentsCount: number;
    likesCount: number;
    viewsCount: number;
    isAbTest?: boolean;
    variants?: PostVariant[];
}

export interface AppFile {
    id: number;
    name: string;
    url: string;
    mimeType: string;
    tags: string[];
    isAnalyzing: boolean;
}

export interface Comment {
    id: number;
    postId: number;
    author: string;
    text: string;
    timestamp: string; // ISO string
    status: 'unanswered' | 'answered' | 'archived' | 'spam' | 'hidden';
    suggestedReply?: string | null;
}

export interface TeamMember {
    id: number; // This is project_members.id
    userId: number;
    email: string;
    role: 'Владелец' | 'SMM-менеджер' | 'Гость';
}

export interface Settings {
    toneOfVoice: string;
    keywords: string;
    targetAudience: string;
    brandVoiceExamples: string[];
    platforms: Platform[];
    telegram: {
        token: string;
        chatId: string;
    };
}

export interface Notification {
    id: number;
    message: string;
    timestamp: string; // ISO string
    read: boolean;
    link?: {
        screen: Screen;
    };
}

export interface KnowledgeItem {
    id: number;
    type: 'document' | 'link';
    name: string;
    url: string;
}

export interface AdAccount {
    id: number;
    platform: 'facebook' | 'google';
    name: string;
    status: 'active' | 'paused' | 'archived';
    budget: number;
    spend: number;
    impressions: number;
    clicks: number;
}

export interface AdCampaign {
    id: number;
    accountId: number;
    name: string;
    status: 'active' | 'paused' | 'completed' | 'archived';
    budget: number;
    spend: number;
    impressions: number;
    clicks: number;
}

export type AiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export interface CompetitorAnalysisResult {
    analysis: {
        url: string;
        summary: string;
        strengths: string[];
        weaknesses: string[];
        topContentExample: string;
    }[];
    recommendations: string[];
}

export interface TrendSource {
    uri: string;
    title: string;
}