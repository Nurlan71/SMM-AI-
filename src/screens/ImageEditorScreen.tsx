import React from 'react';
import { EmptyState } from '../components/EmptyState';

export const ImageEditorScreen = () => {
    return (
        <div style={{ padding: '24px', height: '100%' }}>
            <EmptyState
                icon="🪄"
                title="Редактор изображений в разработке"
                description="Здесь вы сможете редактировать изображения, добавлять текст, фильтры и другие элементы с помощью AI."
            />
        </div>
    );
};
