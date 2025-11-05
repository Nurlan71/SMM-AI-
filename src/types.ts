export type PostStatus = 'draft' | 'needs-approval' | 'needs-revision' | 'approved' | 'scheduled' | 'published';
export type CommentStatus = 'new' | 'replied' | 'archived';

export interface Post {
    id: number;
    topic: string;
    postType: string;
    description: string;
    status: PostStatus;
    date?: string; // YYYY-MM-DD
    content?: string; // Generated content
}

export interface Comment {
    id: number;
    author: string;
    text: string;
    platform: string;
    status: CommentStatus;
    aiTag: boolean;
    isGeneratingReplies?: boolean;
    replies?: string[];
}

export interface TeamMember {
    id: number;
    email: string;
    role: string;
}

export interface AppFile {
    id: number;
    name: string;
    url: string;
    mimeType: string;
    tags?: string[];
    description?: string;
    isAnalyzing?: boolean;
}

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
  | 'settings'

export type Toast = {
    id: number;
    message: string;
    type: 'success' | 'error';
};

export interface Settings {
    toneOfVoice: string;
    keywords: string;
    targetAudience: string;
    brandVoiceExamples: number[];
    platforms: string[];
}

export type TranscriptEntry = {
    id: number;
    speaker: 'user' | 'model';
    text: string;
    imageUrl?: string;
    promptForSave?: string;
    isSaving?: boolean;
    isSaved?: boolean;
};

export interface BrandComplianceResult {
    score: number;
    feedback: string;
}

export interface PerformanceForecastResult {
    engagement_score: number;
    potential_reach: 'Низкий' | 'Средний' | 'Высокий';
    virality_chance: 'Низкий' | 'Средний' | 'Высокий';
    recommendations: string;
}