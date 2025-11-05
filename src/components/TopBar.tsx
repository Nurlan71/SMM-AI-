import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { styles } from '../styles';

interface TopBarProps {
    screenTitle: string;
}

export const TopBar: React.FC<TopBarProps> = ({ screenTitle }) => {
    const { dispatch } = useAppContext();

    return (
        <header style={styles.topBar}>
            <div style={styles.topBarLeft}>
                 <button style={styles.burgerButton} className="burgerButton" onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}>
                    ☰
                </button>
                <h1 style={styles.screenTitle}>{screenTitle}</h1>
            </div>
            {/* Future top bar elements like user profile, notifications etc. can go here */}
        </header>
    );
};
