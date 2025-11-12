import React from 'react';
import { EmptyState } from '../components/EmptyState';

export const TrendSpotterScreen = () => {
    return (
        <div style={{ padding: '24px', height: '100%' }}>
            <EmptyState
                icon="📈"
                title="Поиск трендов в разработке"
                description="AI будет анализировать тренды в ваших соцсетях и предлагать актуальные темы для контента."
            />
        </div>
    );
};
