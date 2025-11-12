import React, { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { styles } from '../styles';

// --- Types ---
interface FormData {
    projectName: string;
    projectDescription: string;
    mainGoal: string;
    targetAudience: string;
    competitors: string;
}

interface StrategyResult {
    projectName: string;
    analysis: {
        audience: string;
        competitors: string;
        swot: string;
    };
    strategy: {
        contentPillars: string[];
        platformRecommendations: {
            platform: string;
            reasoning: string;
        }[];
        postingSchedule: string;
    };
    kpis: string[];
}

// --- Constants ---
const GOALS = [
    { id: 'sales', label: 'Увеличение продаж' },
    { id: 'awareness', label: 'Повышение узнаваемости бренда' },
    { id: 'engagement', label: 'Вовлечение аудитории' },
    { id: 'leads', label: 'Генерация лидов' },
    { id: 'community', label: 'Создание сообщества' },
];

const initialFormData: FormData = {
    projectName: 'Магазин вязаных вещей "Уютное тепло"',
    projectDescription: 'Мы продаем свитера, шапки и шарфы ручной работы из 100% шерсти мериноса. Наша фишка - уникальный дизайн и высокое качество.',
    mainGoal: 'sales',
    targetAudience: 'Женщины 25-45 лет, которые ценят ручную работу, комфорт и натуральные материалы. Интересуются модой, но не гонятся за быстрыми трендами.',
    competitors: 'brand_X, large_marketplaces',
};


const StrategyResultDisplay = ({ result }: { result: StrategyResult }) => (
    <div style={styles.strategyResultContent}>
        <h2 style={styles.strategyResultTitle}>SMM-стратегия для "{result.projectName}"</h2>
        
        <div>
            <h3 style={styles.strategyResultSectionTitle}>1. Анализ</h3>
            <strong>Целевая аудитория:</strong>
            <p>{result.analysis.audience}</p>
            
            <strong>Конкурентный анализ:</strong>
            <p>{result.analysis.competitors}</p>
            
             <strong>SWOT-анализ:</strong>
            <p>{result.analysis.swot}</p>
        </div>

        <div>
            <h3 style={styles.strategyResultSectionTitle}>2. Стратегия</h3>
            <strong>Контентные рубрики:</strong>
            <ul style={styles.strategyResultList}>
                {result.strategy.contentPillars.map((pillar, i) => <li key={i} style={styles.strategyResultListItem}>{pillar}</li>)}
            </ul>

            <strong>Рекомендованные платформы:</strong>
             <ul style={styles.strategyResultList}>
                {result.strategy.platformRecommendations.map((rec, i) => (
                    <li key={i} style={styles.strategyResultListItem}>
                        <strong>{rec.platform}:</strong> {rec.reasoning}
                    </li>
                ))}
            </ul>
            
            <strong>Частота публикаций:</strong>
            <p>{result.strategy.postingSchedule}</p>
        </div>

        <div>
            <h3 style={styles.strategyResultSectionTitle}>3. Ключевые показатели эффективности (KPI)</h3>
            <ul style={styles.strategyResultList}>
                {result.kpis.map((kpi, i) => <li key={i} style={styles.strategyResultListItem}>{kpi}</li>)}
            </ul>
        </div>
    </div>
);


export const StrategyGeneratorScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [strategyResult, setStrategyResult] = useState<StrategyResult | null>(null);

    const handleInputChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setError('');
        setStrategyResult(null);

        try {
            const result = await fetchWithAuth(`${API_BASE_URL}/api/generate-strategy`, {
                method: 'POST',
                body: JSON.stringify(formData),
            });
            setStrategyResult(result);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка.";
            setError(errorMessage);
            appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка: ${errorMessage}`, type: 'error' } });
        } finally {
            setIsLoading(false);
        }
    };

    const isFormValid = formData.projectName && formData.projectDescription && formData.targetAudience;

    return (
        <div style={styles.imageGeneratorLayout} className="generatorLayout">
            <div style={styles.imageGeneratorControls}>
                <h2 style={{fontWeight: 600}}>Создайте SMM-стратегию</h2>
                <p style={{ color: '#6c757d', marginTop: '-10px' }}>Заполните информацию о вашем проекте, и AI разработает для вас индивидуальную стратегию продвижения.</p>
                
                <div>
                    <label htmlFor="projectName" style={styles.generatorLabel}>Название проекта/бренда</label>
                    <input id="projectName" type="text" style={styles.generatorSelect} value={formData.projectName} onChange={e => handleInputChange('projectName', e.target.value)} />
                </div>

                <div>
                    <label htmlFor="projectDescription" style={styles.generatorLabel}>Описание продукта/услуги</label>
                    <textarea id="projectDescription" style={styles.generatorTextarea} value={formData.projectDescription} onChange={e => handleInputChange('projectDescription', e.target.value)} rows={4}/>
                </div>

                <div>
                    <label htmlFor="mainGoal" style={styles.generatorLabel}>Главная цель</label>
                    <select id="mainGoal" style={styles.generatorSelect} value={formData.mainGoal} onChange={e => handleInputChange('mainGoal', e.target.value)}>
                        {GOALS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                </div>
                
                <div>
                    <label htmlFor="targetAudience" style={styles.generatorLabel}>Целевая аудитория</label>
                    <textarea id="targetAudience" style={styles.generatorTextarea} value={formData.targetAudience} onChange={e => handleInputChange('targetAudience', e.target.value)} rows={4}/>
                </div>
                
                <div>
                    <label htmlFor="competitors" style={styles.generatorLabel}>Конкуренты (опционально)</label>
                    <input id="competitors" type="text" style={styles.generatorSelect} value={formData.competitors} onChange={e => handleInputChange('competitors', e.target.value)} />
                </div>
                
                <button
                    style={{ ...styles.button, ...styles.buttonPrimary, marginTop: 'auto', padding: '14px' }}
                    className="newCampaignButton"
                    onClick={handleGenerate}
                    disabled={isLoading || !isFormValid}
                >
                    {isLoading ? 'Анализ и генерация...' : '🧭 Сгенерировать стратегию'}
                </button>
            </div>

            <div style={styles.imageGeneratorResult}>
                {isLoading && (
                     <div style={styles.shimmerPlaceholder}>
                        <div style={styles.shimmerEffect}></div>
                         <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#495057' }}>
                            <p>🧭 Анализируем ваш бизнес...</p>
                            <p style={{fontSize: '12px'}}>Это может занять до минуты.</p>
                        </div>
                    </div>
                )}
                {error && !isLoading && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
                        <h4>Ошибка генерации</h4>
                        <p>{error}</p>
                    </div>
                )}
                {!isLoading && !strategyResult && !error && (
                    <EmptyState
                        icon="🧭"
                        title="Генератор стратегий"
                        description="Заполните информацию о вашем проекте слева, чтобы получить готовую SMM-стратегию."
                    />
                )}
                {strategyResult && !isLoading && (
                    <StrategyResultDisplay result={strategyResult} />
                )}
            </div>
        </div>
    );
};
