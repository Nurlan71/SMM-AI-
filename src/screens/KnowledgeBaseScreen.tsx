import React from 'react';
import { EmptyState } from '../components/EmptyState';

export const KnowledgeBaseScreen = () => {
    return (
        <div style={{ padding: '24px', height: '100%' }}>
            <EmptyState
                icon="📚"
                title="База знаний в разработке"
                description="Загружайте ваши файлы, документы и информацию о продуктах, чтобы AI мог использовать их для создания контента."
            />
        </div>
    );
};
