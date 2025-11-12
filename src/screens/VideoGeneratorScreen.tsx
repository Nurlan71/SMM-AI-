import React from 'react';
import { EmptyState } from '../components/EmptyState';

export const VideoGeneratorScreen = () => {
    return (
        <div style={{ padding: '24px', height: '100%' }}>
            <EmptyState
                icon="🎬"
                title="Генератор видео в разработке"
                description="Создавайте короткие видео для Reels, Shorts и TikTok на основе ваших изображений и текстовых сценариев."
            />
        </div>
    );
};
