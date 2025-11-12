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
    | 'settings';
    
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
}

export interface AppFile {
  id: number;
  name: string;
  url: string;
  mimeType: string;
  tags: string[];
  isAnalyzing: boolean;
  analysis?: string; // Result of AI analysis
}

export interface Comment {
    id: number;
    postId: number;
    author: string;
    text: string;
    timestamp: string; // ISO string
    status: 'unanswered' | 'answered' | 'archived';
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