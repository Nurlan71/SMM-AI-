import React from 'react';
import { EmptyState } from '../components/EmptyState';

export const AnalyticsScreen = () => {
    return (
        <div style={{ padding: '24px', height: '100%' }}>
             <EmptyState
                icon="📊"
                title="Аналитика в разработке"
                description="Здесь будет отображаться подробная аналитика по вашим аккаунтам, вовлеченности аудитории и эффективности постов."
            />
        </div>
    );
};
