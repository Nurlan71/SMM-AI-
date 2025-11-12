import React from 'react';
import { EmptyState } from '../components/EmptyState';

export const StrategyGeneratorScreen = () => {
    return (
        <div style={{ padding: '24px', height: '100%' }}>
            <EmptyState
                icon="🧭"
                title="Генератор стратегий в разработке"
                description="Получайте готовые SMM-стратегии и контент-планы на основе анализа вашей ниши и целевой аудитории."
            />
        </div>
    );
};
