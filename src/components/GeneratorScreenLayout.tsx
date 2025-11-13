import React from 'react';
import { styles } from '../styles';

interface GeneratorScreenLayoutProps {
    controls: React.ReactNode;
    results: React.ReactNode;
}

export const GeneratorScreenLayout: React.FC<GeneratorScreenLayoutProps> = ({ controls, results }) => {
    return (
        <div style={styles.generatorLayout}>
            <div style={styles.generatorControls}>
                {controls}
            </div>
            <div style={styles.generatorResult}>
                {results}
            </div>
        </div>
    );
};
