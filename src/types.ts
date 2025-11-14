export type Platform = 'instagram' | 'telegram' | 'vk' | 'facebook' | 'youtube' | 'tiktok' | 'twitter' | 'linkedin' | 'dzen';

export type PostStatus = 'idea' | 'draft' | 'scheduled' | 'published' | 'error';

export type Screen = 
    | 'content-plan'
    | 'community'
    | 'analytics'
    | 'knowledge-base'
    | 'post-generator'
    | 'image-generator'
    | 'image-editor'
    | 'video-generator'
    | 'strategy-generator'
    | 'trend-spotter'
    | 'content-adapter'
    | 'competitor-analysis'
    | 'settings';

export type AiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export interface PostVariant {
    text: string;
    likes_count: number;
    comments_count: number;
}
    
export interface Post {
  id: number;
  platform: Platform;
  content: string;
  media: string[]; // URLs to images/videos
  status: PostStatus;
  publishDate?: string; // ISO string
  tags: string[];
  comments_count: number;
  likes_count: number;
  views_count: number;
  isABTest?: boolean;
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

export interface KnowledgeItem {
    id: number;
    type: 'document' | 'link';
    name: string;
    url: string;
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
    id: number;
    email: string;
    role: 'Владелец' | 'SMM-менеджер' | 'Гость';
}

export interface Settings {
    toneOfVoice: string;
    keywords: string;
    targetAudience: string;
    brandVoiceExamples: string[];
    platforms: Platform[];
    // Fix: Added optional 'telegram' property to align with its usage for Telegram integration settings.
    telegram?: {
        token: string;
        chatId: string;
    };
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export interface Notification {
    id: number;
    message: string;
    timestamp: string; // ISO string
    read: boolean;
    link?: {
        screen: Screen;
        // could also have an id for specific item, e.g. postId
    };
}

// --- Competitor Analysis Types ---
export interface CompetitorAnalysis {
    url: string;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    topContentExample: string;
}

export interface CompetitorAnalysisResult {
    analysis: CompetitorAnalysis[];
    recommendations: string[];
}

export interface TrendSource {
    uri: string;
    title: string;
}