import React from 'react';
import { EmptyState } from '../components/EmptyState';

export const CommunityScreen = () => {
    return (
        <div style={{ padding: '24px', height: '100%' }}>
            <EmptyState
                icon="💬"
                title="Управление сообществом в разработке"
                description="Этот раздел поможет вам отслеживать комментарии, отвечать на сообщения и взаимодействовать с вашей аудиторией."
            />
        </div>
    );
};
