import React, { useState, useEffect, useMemo } from 'react';
import { EmptyState } from '../components/EmptyState';
import { useAppContext } from '../contexts/AppContext';
import { useDataContext } from '../contexts/DataContext';
import { fetchWithAuth, API_BASE_URL } from '../api';
import { styles } from '../styles';
import type { AdAccount, AdCampaign } from '../types';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
};

const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ru-RU').format(value);
};

const getStatusStyle = (status: AdAccount['status'] | AdCampaign['status']) => {
    switch (status) {
        case 'active': return { color: '#28a745', backgroundColor: '#d4edda' };
        case 'paused': return { color: '#ffc107', backgroundColor: '#fff3cd' };
        case 'completed':
        case 'archived': return { color: '#6c757d', backgroundColor: '#f8f9fa' };
        default: return {};
    }
};

const AdAccountCard = ({ account, isSelected, onSelect }: { account: AdAccount, isSelected: boolean, onSelect: (id: number) => void }) => {
    const statusStyle = getStatusStyle(account.status);
    return (
        <div
            style={{ ...styles.adAccountCard, ...(isSelected && styles.adAccountCardSelected) }}
            onClick={() => onSelect(account.id)}
        >
            <div style={styles.adAccountCardHeader}>
                <span style={styles.adAccountCardIcon}>{account.platform === 'facebook' ? '👍' : '🔍'}</span>
                <h3 style={styles.adAccountCardName}>{account.name}</h3>
                <span style={{ ...styles.adAccountCardStatus, ...statusStyle }}>{account.status}</span>
            </div>
            <div style={styles.adAccountStats}>
                <div><strong>Расход:</strong> {formatCurrency(account.spend)}</div>
                <div><strong>Бюджет:</strong> {formatCurrency(account.budget)}</div>
                <div><strong>Клики:</strong> {formatNumber(account.clicks)}</div>
                <div><strong>Показы:</strong> {formatNumber(account.impressions)}</div>
            </div>
        </div>
    );
};

const AdCampaignsTable = ({ campaigns, isLoading }: { campaigns: AdCampaign[], isLoading: boolean }) => {
    if (isLoading) {
        return <div style={{padding: '20px'}}><div style={styles.spinner} /> Загрузка кампаний...</div>
    }
    if (campaigns.length === 0) {
        return <p style={{padding: '20px', color: '#6c757d'}}>Для этого аккаунта нет кампаний.</p>
    }

    return (
        <div style={styles.adCampaignsTableContainer}>
            <table style={styles.adCampaignsTable}>
                <thead>
                    <tr>
                        <th style={styles.adCampaignsTableTh}>Название кампании</th>
                        <th style={styles.adCampaignsTableTh}>Статус</th>
                        <th style={styles.adCampaignsTableTh}>Расход</th>
                        <th style={styles.adCampaignsTableTh}>Бюджет</th>
                        <th style={styles.adCampaignsTableTh}>Клики</th>
                        <th style={styles.adCampaignsTableTh}>Показы</th>
                    </tr>
                </thead>
                <tbody>
                    {campaigns.map(c => {
                         const statusStyle = getStatusStyle(c.status);
                        return (
                        <tr key={c.id}>
                            <td style={styles.adCampaignsTableTd}>{c.name}</td>
                            <td style={styles.adCampaignsTableTd}>
                                <span style={{ ...styles.adAccountCardStatus, ...statusStyle }}>{c.status}</span>
                            </td>
                            <td style={styles.adCampaignsTableTd}>{formatCurrency(c.spend)}</td>
                            <td style={styles.adCampaignsTableTd}>{formatCurrency(c.budget)}</td>
                            <td style={styles.adCampaignsTableTd}>{formatNumber(c.clicks)}</td>
                            <td style={styles.adCampaignsTableTd}>{formatNumber(c.impressions)}</td>
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
    );
};


export const AdDashboardScreen = () => {
    const { dispatch: appDispatch } = useAppContext();
    const { state: dataState, dispatch: dataDispatch } = useDataContext();
    const { adAccounts, adCampaigns } = dataState;

    const [isLoading, setIsLoading] = useState({ accounts: true, campaigns: false });
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const accounts = await fetchWithAuth(`${API_BASE_URL}/api/ad-accounts`);
                dataDispatch({ type: 'SET_AD_ACCOUNTS', payload: accounts });
                if (accounts.length > 0) {
                    setSelectedAccountId(accounts[0].id);
                }
            } catch (err) {
                 appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка загрузки аккаунтов: ${err instanceof Error ? err.message : ''}`, type: 'error' } });
            } finally {
                 setIsLoading(prev => ({...prev, accounts: false}));
            }
        };
        fetchAccounts();
    }, [dataDispatch, appDispatch]);

    useEffect(() => {
        if (selectedAccountId) {
            const fetchCampaigns = async () => {
                setIsLoading(prev => ({...prev, campaigns: true}));
                try {
                    const campaigns = await fetchWithAuth(`${API_BASE_URL}/api/ad-campaigns/${selectedAccountId}`);
                    dataDispatch({ type: 'SET_AD_CAMPAIGNS', payload: campaigns });
                } catch (err) {
                    appDispatch({ type: 'ADD_TOAST', payload: { message: `Ошибка загрузки кампаний: ${err instanceof Error ? err.message : ''}`, type: 'error' } });
                } finally {
                     setIsLoading(prev => ({...prev, campaigns: false}));
                }
            };
            fetchCampaigns();
        } else {
             dataDispatch({ type: 'SET_AD_CAMPAIGNS', payload: [] });
        }
    }, [selectedAccountId, dataDispatch, appDispatch]);

    const handleConnectAccount = () => {
         appDispatch({ type: 'ADD_TOAST', payload: { message: 'Интеграция с рекламными кабинетами скоро появится!', type: 'success' } });
    };

    if (isLoading.accounts) {
        return <div style={{ padding: '24px' }}><div style={styles.spinner} /> Загрузка данных...</div>;
    }

    if (adAccounts.length === 0) {
        return (
            <div style={{ padding: '24px', height: '100%' }}>
                <EmptyState
                    icon="📢"
                    title="Рекламные кабинеты не подключены"
                    description="Подключите свои рекламные аккаунты, чтобы управлять кампаниями и анализировать их эффективность."
                    buttonText="+ Подключить аккаунт"
                    onButtonClick={handleConnectAccount}
                />
            </div>
        );
    }
    
    return (
        <div style={styles.adDashboardLayout}>
            <div style={styles.analyticsHeader}>
                <h2 style={{fontSize: '24px', fontWeight: 600}}>Обзор рекламных кабинетов</h2>
                <button style={{...styles.button, ...styles.buttonPrimary}} onClick={handleConnectAccount}>
                    + Подключить новый аккаунт
                </button>
            </div>
            <div style={styles.adAccountGrid}>
                {adAccounts.map(acc => (
                    <AdAccountCard 
                        key={acc.id} 
                        account={acc} 
                        isSelected={selectedAccountId === acc.id} 
                        onSelect={setSelectedAccountId} 
                    />
                ))}
            </div>
            <div style={styles.analyticsHeader}>
                 <h2 style={{fontSize: '24px', fontWeight: 600}}>Рекламные кампании</h2>
                <button style={{...styles.button, ...styles.buttonPrimary}} onClick={handleConnectAccount}>
                    + Создать кампанию
                </button>
            </div>
            <AdCampaignsTable campaigns={adCampaigns} isLoading={isLoading.campaigns} />
        </div>
    );
};