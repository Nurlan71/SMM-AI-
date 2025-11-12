import React from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';

export const ContentPlanScreen = () => {
    const { dispatch } = useAppContext();

    return (
        <div style={{ padding: '24px', height: '100%' }}>
            <EmptyState
                icon="🗓️"
                title="Ваш контент-план пуст"
                description="Начните создание контента, запустив помощника по созданию кампаний или сгенерировав идеи для постов."
                buttonText="✨ Создать новую кампанию"
                onButtonClick={() => dispatch({ type: 'SET_CAMPAIGN_WIZARD_OPEN', payload: true })}
            />
        </div>
    );
};
