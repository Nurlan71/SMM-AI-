export interface Post {
  id: string;
  platform: 'Telegram' | 'Instagram' | 'VK';
  content: string;
  media: string[]; // URLs to images/videos
  status: 'idea' | 'scheduled' | 'published' | 'error';
  publishDate?: string; // ISO string
  tags: string[];
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

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}
