import React from 'react';
import { EmptyState } from '../components/EmptyState';

export const SettingsScreen = () => {
    return (
        <div style={{ padding: '24px', height: '100%' }}>
            <EmptyState
                icon="⚙️"
                title="Настройки в разработке"
                description="В этом разделе вы сможете управлять вашим аккаунтом, командой, подключенными соцсетями и настройками AI."
            />
        </div>
    );
};
