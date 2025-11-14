import React from 'react';
import { styles } from '../styles';
import type { AiModel } from '../types';

interface AiModelSelectorProps {
    model: AiModel;
    setModel: (model: AiModel) => void;
    useMemory: boolean;
    setUseMemory: (useMemory: boolean) => void;
    isLoading: boolean;
}

const MODELS: { id: AiModel, name: string, icon: string }[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: '⚡️' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', icon: '💎' },
];

export const AiModelSelector: React.FC<AiModelSelectorProps> = ({ model, setModel, useMemory, setUseMemory, isLoading }) => {
    return (
        <div style={{ borderBottom: '1px solid #e9ecef', paddingBottom: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#343a40' }}>Настройки AI</h3>
            <div>
                <label htmlFor="ai-model" style={styles.generatorLabel}>Модель</label>
                <select
                    id="ai-model"
                    style={styles.generatorSelect}
                    value={model}
                    onChange={(e) => setModel(e.target.value as AiModel)}
                    disabled={isLoading}
                >
                    {MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                    ))}
                </select>
            </div>
            <div 
                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: isLoading ? 'not-allowed' : 'pointer' }}
                onClick={() => !isLoading && setUseMemory(!useMemory)}
            >
                <input
                    type="checkbox"
                    id="use-memory"
                    checked={useMemory}
                    onChange={(e) => setUseMemory(e.target.checked)}
                    disabled={isLoading}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="use-memory" style={{ ...styles.generatorLabel, marginBottom: 0, cursor: 'pointer' }}>
                    🧠 Использовать "Базу знаний"
                </label>
            </div>
        </div>
    );
};
