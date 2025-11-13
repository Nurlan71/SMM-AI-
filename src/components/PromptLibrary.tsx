import React, { useState } from 'react';
import { styles } from '../styles';

export interface HistoryItem {
    id: string;
    text: string;
}

interface PromptLibraryProps {
    templates: HistoryItem[];
    history: HistoryItem[];
    onSelect: (text: string) => void;
}

type ActiveTab = 'templates' | 'history';

export const PromptLibrary: React.FC<PromptLibraryProps> = ({ templates, history, onSelect }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('templates');

    const renderList = (items: HistoryItem[]) => {
        if (items.length === 0) {
            return <p style={{ fontSize: '13px', color: '#6c757d', textAlign: 'center' }}>{activeTab === 'templates' ? 'Шаблоны не найдены.' : 'История пуста.'}</p>;
        }
        return items.map(item => (
            <div
                key={item.id}
                style={styles.promptLibraryItem}
                className="planCardClickable"
                onClick={() => onSelect(item.text)}
                title={item.text}
            >
                {item.text}
            </div>
        ));
    };

    return (
        <div style={styles.promptLibraryContainer}>
            <div style={styles.promptLibraryTabs}>
                <button
                    style={activeTab === 'templates' ? { ...styles.promptLibraryTab, ...styles.promptLibraryTabActive } : styles.promptLibraryTab}
                    onClick={() => setActiveTab('templates')}
                >
                    Шаблоony
                </button>
                <button
                    style={activeTab === 'history' ? { ...styles.promptLibraryTab, ...styles.promptLibraryTabActive } : styles.promptLibraryTab}
                    onClick={() => setActiveTab('history')}
                >
                    История
                </button>
            </div>
            <div style={styles.promptLibraryContent}>
                {activeTab === 'templates' ? renderList(templates) : renderList(history)}
            </div>
        </div>
    );
};
