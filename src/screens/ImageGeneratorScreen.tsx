import React from 'react';
import { EmptyState } from '../components/EmptyState';

export const ImageGeneratorScreen = () => {
    return (
        <div style={{ padding: '24px', height: '100%' }}>
             <EmptyState
                icon="🎨"
                title="Генератор изображений в разработке"
                description="Создавайте уникальные изображения для ваших постов по текстовому описанию с помощью нейросетей."
            />
        </div>
    );
};
