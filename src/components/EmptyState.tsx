import React from 'react';
import { styles } from '../styles';

interface EmptyStateProps {
    icon: string;
    title: string;
    description: string;
    buttonText?: string;
    onButtonClick?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, buttonText, onButtonClick }) => (
    <div style={styles.emptyStateContainer}>
        <div style={styles.emptyStateIcon}>{icon}</div>
        <h3 style={styles.emptyStateTitle}>{title}</h3>
        <p style={styles.emptyStateDescription}>{description}</p>
        {buttonText && onButtonClick && (
            <button style={styles.emptyStateButton} className="empty-state-button" onClick={onButtonClick}>
                {buttonText}
            </button>
        )}
    </div>
);
