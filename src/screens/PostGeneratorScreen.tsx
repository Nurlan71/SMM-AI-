import React from 'react';
import { EmptyState } from '../components/EmptyState';

export const PostGeneratorScreen = () => {
    return (
        <div style={{ padding: '24px', height: '100%' }}>
            <EmptyState
                icon="✍️"
                title="Генератор постов в разработке"
                description="Здесь вы сможете генерировать тексты для постов на основе ваших идей, ключевых слов и базы знаний."
            />
        </div>
    );
};
