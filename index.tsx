
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
// Fix: Aliased the Blob import from @google/genai to GenAIBlob to avoid conflict with the browser's native Blob type.
// Fix: Import `VideoGenerationReferenceImage` and `VideoGenerationReferenceType` to fix a type error.
import { GoogleGenAI, Type, Modality, LiveServerMessage, Blob as GenAIBlob, FunctionDeclaration, VideoGenerationReferenceImage, VideoGenerationReferenceType } from "@google/genai";

const API_BASE_URL = 'http://localhost:3001';

// --- DATA STRUCTURES ---
interface Post {
    id: number;
    topic: string;
    postType: string;
    description: string;
    status: 'idea' | 'scheduled' | 'published';
    date?: string; // YYYY-MM-DD
    content?: string; // Generated content
}

interface TeamMember {
    id: number;
    email: string;
    role: string;
}

// --- MOCK DATA ---
const MOCK_UNSCHEDULED_POSTS: Post[] = [
    { id: 101, topic: "Анонс осенней коллекции", postType: "Пост с фото", description: "Показать новые свитера и пальто. Сделать акцент на уюте и натуральных материалах.", status: 'idea' },
    { id: 102, topic: "Закулисье фотосессии", postType: "Видео Reels", description: "Смешные моменты и процесс съемки новой коллекции. Показать команду в действии.", status: 'idea' },
    { id: 103, topic: "Как выбрать идеальное пальто?", postType: "Статья", description: "Полезные советы по выбору пальто по типу фигуры и стилю. Продемонстрировать модели из нашего ассортимента.", status: 'idea' },
    { id: 104, topic: "5 способов носить шарф", postType: "Карусель", description: "Показать 5 разных образов с одним и тем же шарфом, чтобы вдохновить подписчиков.", status: 'idea' },
];

const MOCK_SCHEDULED_POSTS: Post[] = [
    { id: 201, topic: "Прямой эфир с дизайнером", postType: "Live", description: "Ответы на вопросы о новой коллекции.", date: `2025-11-${new Date().getDate()}`, status: 'scheduled' },
    { id: 202, topic: "Розыгрыш сертификата", postType: "Конкурс", description: "Условия участия: лайк, подписка, комментарий.", date: '2025-11-15', status: 'published' },
    { id: 203, topic: "Отзыв клиента", postType: "Пост с фото", description: "Поделиться положительным отзывом от довольного клиента с его фотографией.", date: '2025-11-22', status: 'scheduled' },
    { id: 204, topic: "Скидка на трикотаж", postType: "Промо", description: "Объявить о недельной скидке на все трикотажные изделия.", date: '2025-11-22', status: 'scheduled' },
];

const MOCK_TEAM: TeamMember[] = [
    { id: 1, email: 'owner@smm.ai', role: 'Владелец' },
    { id: 2, email: 'manager@smm.ai', role: 'SMM-менеджер' },
    { id: 3, email: 'guest@smm.ai', role: 'Гость' },
];
// --- END MOCK DATA ---

// Fix: Moved style object declarations to the top of the file to resolve block-scoped variable errors.
const analyticsStyles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
    },
    dateRangePicker: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
    },
    dateRangeButton: {
        padding: '8px 16px',
        border: '1px solid #ced4da',
        background: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 500,
        transition: 'background-color 0.2s, color 0.2s, border-color 0.2s',
    },
    dateRangeButtonActive: {
        padding: '8px 16px',
        border: '1px solid #007bff',
        background: '#e7f1ff',
        color: '#007bff',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 600,
    },
    keyMetricsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
    },
    metricCard: {
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        border: '1px solid #e9ecef',
    },
    metricTitle: {
        margin: 0,
        fontSize: '14px',
        color: '#6c757d',
        marginBottom: '8px',
    },
    metricValue: {
        margin: 0,
        fontSize: '28px',
        fontWeight: '600',
        color: '#212529',
    },
    metricChange: {
        margin: 0,
        fontSize: '14px',
        fontWeight: '500',
    },
    mainGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'auto',
        gap: '24px',
        gridTemplateAreas: `
            "chart chart posts"
            "chart chart traffic"
        `,
    },
    largeCard: {
        gridColumn: 'span 2',
    },
    cardTitle: {
        marginBottom: '16px',
        fontSize: '18px',
        fontWeight: '600',
    },
    chartContainer: {
        height: '250px',
        width: '100%',
    },
    postList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxHeight: '300px',
        overflowY: 'auto',
    },
    postItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px',
        borderRadius: '8px',
        transition: 'background-color 0.2s',
    },
    postPlatformIcon: {
        width: '20px',
        height: '20px',
        marginRight: '12px',
    },
    postTopic: {
        flex: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontSize: '14px',
    },
    postMetric: {
        fontWeight: '500',
        fontSize: '14px',
        marginLeft: '12px',
    },
    doughnutLayout: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        marginTop: '20px',
    },
    doughnutChart: {
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        position: 'relative',
    },
    doughnutLegend: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        fontSize: '14px',
    },
    legendMarker: {
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        marginRight: '8px',
    },
    legendValue: {
        marginLeft: 'auto',
        fontWeight: '500',
        paddingLeft: '12px',
        color: '#6c757d',
    },
     // Styles for Competitor Analysis
    competitorAnalysisContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    competitorForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        borderRadius: '12px',
        border: '1px solid #e9ecef',
        backgroundColor: '#fff',
    },
    competitorResults: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    competitorCard: {
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #e9ecef',
        backgroundColor: '#fff',
    },
    recommendationCard: {
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #007bff',
        backgroundColor: '#e7f1ff',
    },
    analysisList: {
        listStylePosition: 'inside',
        paddingLeft: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    analysisTitle: {
        fontSize: '1.2rem',
        fontWeight: 600,
        marginBottom: '12px',
    },
};

const baseCardStyles: React.CSSProperties = {
    backgroundColor: '#fff',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    border: '1px solid #e9ecef',
    overflow: 'hidden',
};

const copilotStyles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        textAlign: 'center',
        padding: '24px',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
    },
    visualizer: {
        width: '150px',
        height: '150px',
        borderRadius: '50%',
        backgroundColor: '#007bff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '4rem',
        transition: 'all 0.3s ease',
    },
    visualizerActive: {
        animation: 'pulse 2s infinite',
    },
    visualizerThinking: {
        background: 'linear-gradient(45deg, #007bff, #6610f2, #e83e8c, #fd7e14)',
        backgroundSize: '400% 400%',
        animation: 'thinking 3s ease infinite',
    },
    transcriptContainer: {
        flex: 1,
        width: '100%',
        overflowY: 'auto',
        margin: '24px 0',
        padding: '20px',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        backgroundColor: '#fff',
        textAlign: 'left',
    },
    transcriptEntry: {
        marginBottom: '12px',
        padding: '10px 14px',
        borderRadius: '8px',
        lineHeight: '1.5',
    },
    transcriptUser: {
        backgroundColor: '#e7f1ff',
        color: '#004085',
        textAlign: 'right',
    },
    transcriptModel: {
        backgroundColor: '#e9ecef',
        color: '#495057',
    },
    controls: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
    },
    statusText: {
        color: '#6c757d',
        fontWeight: 500,
        height: '24px',
    },
    copilotButton: {
        padding: '16px 32px',
        fontSize: '1.2rem',
        fontWeight: '600',
        color: '#fff',
        backgroundColor: '#007bff',
        border: 'none',
        borderRadius: '50px',
        cursor: 'pointer',
        transition: 'background-color 0.2s, transform 0.2s',
        minWidth: '200px',
    },
    copilotButtonStop: {
        backgroundColor: '#dc3545',
    }
};

const styles: { [key: string]: React.CSSProperties } = {
    authPage: {
        display: 'flex',
        height: '100%',
        width: '100%',
        backgroundColor: '#fff',
    },
    authPanelLeft: {
        width: '50%',
        backgroundColor: '#007bff',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    authPanelRight: {
        width: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa',
    },
    authBlob: {
        position: 'absolute',
        borderRadius: '50%',
        opacity: 0.15,
        filter: 'blur(40px)',
    },
    authBlob1: {
        width: '400px',
        height: '400px',
        backgroundColor: '#fff',
        top: '-100px',
        left: '-150px',
        animation: 'moveBlob1 20s infinite alternate',
    },
    authBlob2: {
        width: '300px',
        height: '300px',
        backgroundColor: '#ffc107',
        bottom: '-50px',
        right: '-100px',
        animation: 'moveBlob2 25s infinite alternate',
    },
    authBlob3: {
        width: '250px',
        height: '250px',
        backgroundColor: '#dc3545',
        bottom: '100px',
        left: '50px',
        animation: 'moveBlob3 15s infinite alternate',
    },
    authPanelContent: {
        textAlign: 'center',
        zIndex: 1,
    },
    authTitle: {
        fontSize: '4rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
    },
    authSubtitle: {
        fontSize: '1.25rem',
        maxWidth: '400px',
    },
    authFormContainer: {
        width: '100%',
        maxWidth: '400px',
        padding: '0 20px',
    },
    authTabs: {
        display: 'flex',
        marginBottom: '2rem',
        borderBottom: '1px solid #dee2e6',
    },
    authTab: {
        flex: 1,
        padding: '1rem',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500',
        color: '#6c757d',
        position: 'relative',
    },
    authTabActive: {
        flex: 1,
        padding: '1rem',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '600',
        color: '#007bff',
        borderBottom: '2px solid #007bff',
    },
    authForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    authInput: {
        padding: '0.9rem',
        fontSize: '1rem',
        border: '1px solid #ced4da',
        borderRadius: '8px',
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
    },
    authButton: {
        padding: '0.9rem',
        fontSize: '1rem',
        fontWeight: '600',
        color: '#fff',
        backgroundColor: '#007bff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    authMessage: {
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '1rem',
        textAlign: 'center',
    },
    authMessageError: {
        backgroundColor: '#f8d7da',
        color: '#721c24',
        border: '1px solid #f5c6cb',
    },
    authMessageSuccess: {
        backgroundColor: '#d4edda',
        color: '#155724',
        border: '1px solid #c3e6cb',
    },
    dashboardLayout: {
        display: 'flex',
        height: '100%',
        width: '100%',
    },
    sidebar: {
        width: '260px',
        backgroundColor: '#fff',
        borderRight: '1px solid #e9ecef',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width 0.3s ease-in-out',
    },
    sidebarOpen: {
        left: '0 !important',
    },
    logo: {
        fontSize: '2rem',
        fontWeight: 'bold',
        color: '#007bff',
        textAlign: 'center',
        marginBottom: '32px',
    },
    nav: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    navButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        border: 'none',
        background: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500',
        color: '#495057',
        borderRadius: '8px',
        transition: 'background-color 0.2s, color 0.2s',
        width: '100%',
    },
    navButtonActive: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '600',
        borderRadius: '8px',
        backgroundColor: '#e7f1ff',
        color: '#007bff',
        width: '100%',
    },
    navIcon: {
        marginRight: '12px',
        fontSize: '1.2rem',
    },
    navChevron: {
        marginLeft: 'auto',
        transition: 'transform 0.2s',
    },
    navChevronOpen: {
        transform: 'rotate(90deg)',
    },
    aiToolsContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        paddingLeft: '20px',
        overflow: 'hidden',
        transition: 'max-height 0.3s ease-in-out',
    },
    mainContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    topBar: {
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e9ecef',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
    },
    topBarLeft: {
        display: 'flex',
        alignItems: 'center',
    },
    burgerButton: {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        marginRight: '16px',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
    },
    screenTitle: {
        fontSize: '1.75rem',
        fontWeight: '600',
        color: '#212529',
    },
    screenContent: {
        padding: '32px',
        overflowY: 'auto',
        height: '100%',
    },
    card: baseCardStyles,
    cardTitle: {
        margin: 0,
        marginBottom: '8px',
        fontSize: '1.25rem',
        fontWeight: '600',
    },
    cardSubtitle: {
        margin: 0,
        marginBottom: '20px',
        color: '#6c757d',
        fontSize: '0.9rem',
    },
    contentPlanLayout: {
        display: 'grid',
        gridTemplateColumns: '350px 1fr',
        gap: '24px',
        height: '100%',
    },
    contentPlanControls: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
    },
    planList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    planCard: {
        padding: '16px',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
    },
    planCardDraggable: {
        cursor: 'grab',
    },
    planCardDragging: {
        opacity: 0.5,
        cursor: 'grabbing',
    },
    planCardTitle: {
        fontWeight: '600',
        fontSize: '1rem',
        marginBottom: '4px',
        display: 'block',
    },
    planCardBadge: {
        backgroundColor: '#e9ecef',
        color: '#495057',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '500',
        display: 'inline-block',
        marginBottom: '8px',
    },
    planCardDescription: {
        fontSize: '0.9rem',
        color: '#6c757d',
        lineHeight: 1.5,
    },
    calendarContainer: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
    },
    calendarHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
    },
    calendarTitle: {
        fontSize: '1.5rem',
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    calendarNavButton: {
        background: 'none',
        border: '1px solid #ced4da',
        borderRadius: '50%',
        width: '36px',
        height: '36px',
        cursor: 'pointer',
        fontSize: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s',
    },
    calendarGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridAutoRows: 'minmax(120px, 1fr)',
        gap: '4px',
        flex: 1,
    },
    calendarWeekDay: {
        textAlign: 'center',
        fontWeight: '600',
        color: '#6c757d',
        fontSize: '0.9rem',
        padding: '8px 0',
    },
    calendarDay: {
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '8px',
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 0.2s, border-color 0.2s',
        position: 'relative',
    },
    calendarDayDragOver: {
        backgroundColor: '#e7f1ff',
        border: '2px dashed #007bff',
    },
    calendarDayEmpty: {
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
    },
    calendarDayToday: {
        borderColor: '#007bff',
        backgroundColor: '#f0f8ff',
    },
    calendarDayNumber: {
        fontWeight: '600',
        marginBottom: '8px',
    },
    scheduledPostsContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        overflow: 'hidden',
    },
    scheduledPostItem: {
        backgroundColor: '#e7f1ff',
        color: '#004085',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.8rem',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        cursor: 'pointer',
        borderLeft: '3px solid #007bff',
    },
    scheduledPostItemPublished: {
        backgroundColor: '#e2e3e5',
        color: '#383d41',
        borderLeft: '3px solid #6c757d',
        textDecoration: 'line-through',
    },
    generatorLayout: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        height: '100%',
    },
    generatorControls: {
        ...baseCardStyles,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    generatorResult: {
        ...baseCardStyles,
        display: 'flex',
        flexDirection: 'column',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    label: {
        fontWeight: '600',
        fontSize: '1rem',
    },
    input: {
        padding: '12px',
        fontSize: '1rem',
        border: '1px solid #ced4da',
        borderRadius: '8px',
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        width: '100%',
    },
    textarea: {
        padding: '12px',
        fontSize: '1rem',
        border: '1px solid #ced4da',
        borderRadius: '8px',
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        width: '100%',
        minHeight: '80px',
        resize: 'vertical',
        fontFamily: 'inherit',
    },
    button: {
        padding: '12px 20px',
        fontSize: '1rem',
        fontWeight: '600',
        color: '#fff',
        backgroundColor: '#007bff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    },
    buttonDisabled: {
        padding: '12px 20px',
        fontSize: '1rem',
        fontWeight: '600',
        color: '#6c757d',
        backgroundColor: '#e9ecef',
        border: 'none',
        borderRadius: '8px',
        cursor: 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    },
    resultBox: {
        flex: 1,
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        overflowY: 'auto',
        lineHeight: 1.6,
    },
    loader: {
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #007bff',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        animation: 'spin 1s linear infinite',
        margin: 'auto',
    },
    miniLoader: {
        border: '3px solid rgba(0, 123, 255, 0.3)',
        borderTop: '3px solid #007bff',
        borderRadius: '50%',
        width: '20px',
        height: '20px',
        animation: 'spin 1s linear infinite',
    },
    placeholderText: {
        color: '#6c757d',
        textAlign: 'center',
    },
    fileSelectionGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '12px',
        maxHeight: '300px',
        overflowY: 'auto',
        padding: '4px',
    },
    fileSelectItem: {
        position: 'relative',
        height: '100px',
        borderRadius: '8px',
        border: '2px solid #e9ecef',
        cursor: 'pointer',
        overflow: 'hidden',
        backgroundColor: '#f8f9fa',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.2s',
    },
    fileSelectItemActive: {
        borderColor: '#007bff',
    },
    fileSelectIcon: {
        fontSize: '2rem',
    },
    fileSelectOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: 'white',
        padding: '4px 8px',
        fontSize: '0.8rem',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    fileSelectCheck: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: '#007bff',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
    },
    aspectRatioSelector: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
    },
    aspectRatioButton: {
        padding: '8px 16px',
        border: '1px solid #ced4da',
        background: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.2s, color 0.2s, border-color 0.2s',
    },
    aspectRatioButtonActive: {
        padding: '8px 16px',
        border: '1px solid #007bff',
        background: '#e7f1ff',
        color: '#007bff',
        borderRadius: '8px',
        cursor: 'pointer',
    },
    errorText: {
        color: '#dc3545',
        fontWeight: '500',
        textAlign: 'center',
    },
    imagePreviewContainer: {
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    generatedImage: {
        maxWidth: '100%',
        maxHeight: '100%',
        borderRadius: '8px',
        objectFit: 'contain',
    },
    generatedVideo: {
        maxWidth: '100%',
        maxHeight: '100%',
        borderRadius: '8px',
        objectFit: 'contain',
    },
    imageActions: {
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '12px',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: '8px 12px',
        borderRadius: '8px',
    },
    imageActionButton: {
        background: 'none',
        border: '1px solid #fff',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '6px',
        cursor: 'pointer',
        textDecoration: 'none',
        fontSize: '14px',
    },
    knowledgeBaseContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    dropzone: {
        border: '2px dashed #ced4da',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        color: '#6c757d',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background-color 0.2s',
    },
    dropzoneActive: {
        borderColor: '#007bff',
        backgroundColor: '#f0f8ff',
    },
    uploadIcon: {
        fontSize: '3rem',
        display: 'block',
        marginBottom: '16px',
    },
    fileGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '20px',
    },
    fileCard: {
        position: 'relative',
        height: '180px',
        borderRadius: '12px',
        border: '1px solid #e9ecef',
        backgroundColor: '#f8f9fa',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    },
    fileCardIcon: {
        fontSize: '3.5rem',
    },
    fileCardOverlay: {
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        padding: '12px',
        backgroundColor: 'rgba(0,0,0,0.6)',
        color: '#fff',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    fileName: {
        fontWeight: '600',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'block',
    },
    fileTagsContainer: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        justifyContent: 'center',
        maxHeight: '44px',
        overflow: 'hidden',
    },
    fileTag: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        color: '#fff',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '0.7rem',
    },
    fileCardAnalyzingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    deleteButton: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        background: 'rgba(255, 0, 0, 0.5)',
        color: '#fff',
        border: 'none',
        borderRadius: '50%',
        width: '32px',
        height: '32px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1rem',
        opacity: 0,
        transition: 'opacity 0.2s, background-color 0.2s',
    },
    fileCardSkeleton: {
        height: '180px',
        backgroundColor: '#e9ecef',
        borderRadius: '12px',
        position: 'relative',
        overflow: 'hidden',
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
        animation: 'shimmer 1.5s infinite',
    },
    settingsLayout: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
    },
    platformGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
    },
    platformCard: {
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        border: '2px solid #e9ecef',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background-color 0.2s',
    },
    platformCardActive: {
        borderColor: '#007bff',
        backgroundColor: '#f0f8ff',
    },
    platformIcon: {
        width: '32px',
        height: '32px',
        marginRight: '12px',
        objectFit: 'contain',
    },
    platformName: {
        fontWeight: '500',
    },
    teamInviteForm: {
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
    },
    inviteButton: {
        padding: '0 20px',
        fontSize: '1rem',
        fontWeight: '600',
        color: '#fff',
        backgroundColor: '#007bff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    teamTable: {
        width: '100%',
        borderCollapse: 'collapse',
    },
    teamTableTh: {
        textAlign: 'left',
        padding: '12px',
        borderBottom: '2px solid #e9ecef',
        color: '#6c757d',
        fontSize: '0.9rem',
        textTransform: 'uppercase',
    },
    teamTableTd: {
        padding: '12px',
        borderBottom: '1px solid #e9ecef',
    },
    teamRemoveButton: {
        background: 'none',
        border: 'none',
        color: '#dc3545',
        cursor: 'pointer',
        padding: 0,
    },
    emptyStateContainer: {
        textAlign: 'center',
        padding: '40px',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        border: '1px solid #e9ecef',
    },
    emptyStateIcon: {
        fontSize: '3rem',
        marginBottom: '16px',
    },
    emptyStateTitle: {
        fontSize: '1.5rem',
        fontWeight: 600,
        marginBottom: '8px',
    },
    emptyStateDescription: {
        color: '#6c757d',
        maxWidth: '450px',
        margin: '0 auto 24px',
    },
    emptyStateButton: {
        padding: '12px 24px',
        fontSize: '1rem',
        fontWeight: 600,
        color: '#fff',
        backgroundColor: '#007bff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: 'white',
        padding: '32px',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '700px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        position: 'relative',
    },
    drawerOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        zIndex: 1000,
    },
    drawerContent: {
        backgroundColor: 'white',
        width: '100%',
        maxWidth: '500px',
        height: '100%',
        maxHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
        position: 'relative',
        animation: 'slideInRight 0.3s ease-out',
        borderRadius: '12px 0 0 12px',
    },
    modalCloseButton: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: '#6c757d',
    },
    modalBody: {
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    modalHeader: {
        marginBottom: '16px',
        paddingBottom: '16px',
        borderBottom: '1px solid #e9ecef',
    },
    modalFooter: {
        marginTop: '24px',
        paddingTop: '16px',
        borderTop: '1px solid #e9ecef',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusSelector: {
        display: 'flex',
        gap: '8px',
    },
    statusButton: {
        padding: '6px 12px',
        border: '1px solid #ced4da',
        background: 'none',
        borderRadius: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    deleteButtonFooter: {
        background: 'none',
        border: 'none',
        color: '#dc3545',
        fontWeight: 500,
        cursor: 'pointer',
    },
    campaignWizardResultSection: {
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid #e9ecef',
    },
    newCampaignButton: {
        padding: '8px 16px',
        fontSize: '0.9rem',
        background: 'linear-gradient(45deg, #007bff, #6610f2)',
        border: 'none',
    },
    copilotFab: {
        position: 'fixed',
        bottom: '32px',
        right: '32px',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        fontSize: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.2s, background-color 0.2s',
        zIndex: 1001,
    },
    // Styles for Content Adapter
    adapterSourceTabs: {
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid #dee2e6',
        marginBottom: '16px',
    },
    adapterSourceTab: {
        padding: '8px 16px',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500',
        color: '#6c757d',
        borderBottom: '2px solid transparent',
    },
    adapterSourceTabActive: {
        padding: '8px 16px',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '600',
        color: '#007bff',
        borderBottom: '2px solid #007bff',
    },
    adapterPostList: {
        maxHeight: '200px',
        overflowY: 'auto',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
    },
    adapterPostItem: {
        padding: '12px',
        borderBottom: '1px solid #e9ecef',
        cursor: 'pointer',
    },
    adapterPostItemActive: {
        backgroundColor: '#e7f1ff',
    },
    adapterResultGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        height: '100%',
        overflowY: 'auto',
        paddingRight: '10px'
    },
    adapterResultCard: {
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #e9ecef',
        backgroundColor: '#fff',
        position: 'relative',
    },
    adapterResultHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
    },
    adapterResultTitle: {
        fontSize: '1.2rem',
        fontWeight: 600,
    },
    adapterCopyButton: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        padding: '6px 12px',
        fontSize: '0.9rem',
        backgroundColor: '#f8f9fa',
        border: '1px solid #ced4da',
        color: '#495057',
    },
    modalTabs: {
        display: 'flex',
        borderBottom: '1px solid #dee2e6',
        marginBottom: '20px',
    },
    modalTab: {
        padding: '10px 20px',
        cursor: 'pointer',
        border: 'none',
        background: 'none',
        fontSize: '1rem',
        fontWeight: 500,
        color: '#6c757d',
        borderBottom: '2px solid transparent',
    },
    modalTabActive: {
        padding: '10px 20px',
        cursor: 'pointer',
        border: 'none',
        background: 'none',
        fontSize: '1rem',
        fontWeight: 600,
        color: '#007bff',
        borderBottom: '2px solid #007bff',
    },
    commentSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    commentList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    commentItem: {
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #e9ecef',
    },
    commentText: {
        marginBottom: '12px',
        lineHeight: 1.5,
    },
    replyButton: {
        padding: '6px 12px',
        fontSize: '0.9rem',
        backgroundColor: '#e7f1ff',
        color: '#004085',
        border: '1px solid #b8daff',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    replyOptionsContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginTop: '12px',
        borderTop: '1px solid #e9ecef',
        paddingTop: '12px',
    },
    replyOptionButton: {
        textAlign: 'left',
        padding: '10px',
        borderRadius: '6px',
        border: '1px solid #ced4da',
        background: '#fff',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    communityLayout: {
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: '24px',
        height: '100%',
    },
    communitySidebar: {
        ...baseCardStyles,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    communityFilterButton: {
        width: '100%',
        textAlign: 'left',
        padding: '10px 14px',
        border: 'none',
        background: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 500,
        fontSize: '1rem',
        transition: 'background-color 0.2s, color 0.2s',
    },
    communityFilterButtonActive: {
        backgroundColor: '#e7f1ff',
        color: '#007bff',
        fontWeight: 600,
    },
    communityHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
    },
    autopilotToggle: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    inboxFeed: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    inboxCard: {
        ...baseCardStyles,
        padding: '20px',
    },
    inboxCardHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '12px',
    },
    inboxCardAvatar: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: '#e9ecef',
    },
    inboxCardAuthor: {
        fontWeight: 600,
    },
    inboxCardMeta: {
        fontSize: '0.85rem',
        color: '#6c757d',
    },
    inboxCardAiTag: {
        marginLeft: 'auto',
        padding: '4px 10px',
        borderRadius: '16px',
        fontSize: '0.8rem',
        fontWeight: 500,
    },
    inboxCardReplySection: {
        marginTop: '16px',
        borderTop: '1px solid #e9ecef',
        paddingTop: '16px',
    },
    inboxCardReplyTitle: {
        fontWeight: 600,
        marginBottom: '10px',
    },
    inboxCardReplyOption: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #ced4da',
        marginBottom: '8px',
        backgroundColor: '#fff',
    },
    inboxCardReplyButton: {
        padding: '6px 12px',
        fontSize: '0.9rem',
    },
};

// Helper для аутентифицированных запросов
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('smm_ai_token');
    const headers = new Headers(options.headers || {});
    
    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
    }

    // Не устанавливаем Content-Type для FormData, браузер сделает это сам с правильным boundary
    if (!(options.body instanceof FormData)) {
        if (!headers.has('Content-Type')) {
            headers.append('Content-Type', 'application/json');
        }
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // Токен недействителен или истек, вызываем принудительный выход
        window.dispatchEvent(new CustomEvent('forceLogout'));
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'Произошла ошибка на сервере.');
    }

    return response;
};

const AuthScreen = ({ onLoginSuccess }: { onLoginSuccess: (token: string) => void }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      setIsLoading(false);
      return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Не удалось зарегистрироваться.');
        }

        setSuccess('Регистрация прошла успешно! Теперь вы можете войти.');
        setActiveTab('login');
        setPassword('');
        setConfirmPassword('');

    } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('Произошла ошибка при регистрации.');
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось войти в систему.');
      }
      
      onLoginSuccess(data.token);

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Произошла ошибка. Пожалуйста, проверьте ваше соединение и попробуйте снова.');
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div style={styles.authPage}>
      <div style={styles.authPanelLeft}>
        <div style={{...styles.authBlob, ...styles.authBlob1}}></div>
        <div style={{...styles.authBlob, ...styles.authBlob2}}></div>
        <div style={{...styles.authBlob, ...styles.authBlob3}}></div>
        <div style={styles.authPanelContent}>
          <h1 style={styles.authTitle}>SMM AI</h1>
          <p style={styles.authSubtitle}>Ваш интеллектуальный ассистент в мире социальных сетей.</p>
        </div>
      </div>
      <div style={styles.authPanelRight}>
        <div style={styles.authFormContainer}>
          <div style={styles.authTabs}>
            <button
              style={activeTab === 'login' ? styles.authTabActive : styles.authTab}
              onClick={() => setActiveTab('login')}
            >
              Вход
            </button>
            <button
              style={activeTab === 'register' ? styles.authTabActive : styles.authTab}
              onClick={() => setActiveTab('register')}
            >
              Регистрация
            </button>
          </div>
          
          {error && <p style={{...styles.authMessage, ...styles.authMessageError}}>{error}</p>}
          {success && <p style={{...styles.authMessage, ...styles.authMessageSuccess}}>{success}</p>}

          {activeTab === 'login' ? (
            <form style={styles.authForm} onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email (dev@smm.ai)"
                style={styles.authInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Пароль (password)"
                style={styles.authInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" style={isLoading ? styles.buttonDisabled : styles.authButton} className="authButton" disabled={isLoading}>{isLoading ? 'Вход...' : 'Войти'}</button>
            </form>
          ) : (
            <form style={styles.authForm} onSubmit={handleRegister}>
              <input
                type="email"
                placeholder="Email"
                style={styles.authInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Пароль"
                style={styles.authInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Подтвердите пароль"
                style={styles.authInput}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button type="submit" style={isLoading ? styles.buttonDisabled : styles.authButton} className="authButton" disabled={isLoading}>{isLoading ? 'Регистрация...' : 'Зарегистрироваться'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const socialPlatforms = [
  { id: 'instagram', name: 'Instagram', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png' },
  { id: 'vk', name: 'ВКонтакте', icon: 'https://upload.wikimedia.org/wikipedia/commons/2/21/VK.com-logo.svg' },
  { id: 'telegram', name: 'Telegram', icon: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg' },
  { id: 'dzen', name: 'Дзен', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSJibGFjayIgZD0iTTIxLjMzIDI0VjBoLTUuMjhMMTAuMDkgMTQuNzZWMEg0Ljh2MjRoNS40NEwxNi4yIDkuMjRWMjR6Ii8+PC9zdmc+' },
  { id: 'rutube', name: 'Rutube', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiNkZTAwMTEiLz48cGF0aCBkPSJNMTYuNTcgMTIuNDIyTDEwLjI4NCAxNi40MTZjLS41NDQuMzQ4LTEuMjQyLS4wNDItMS4yNDItLjY3NVY4LjI1OWMwLS42MzMuNjk4LTEuMDIzIDEuMjQyLS42NzVsNi4yODYgMy45OTJjLjU0NS4zNDguNTQ1IDEuMDAyIDAgMS4zNXoiIGZpbGw9IndoaXRlIi8+PC9zdmc+' },
  { id: 'ok', name: 'Одноклассники', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjRUU3NjAwIiBkPSJNMTIgMEM1LjM3MyAwIDAgNS4zNzMgMCAxMnM1LjM3MyAxMiAxMiAxMiAxMi01LjM3MyAxMi0xMlMxOC42MjcgMCAxMiAwem0uMDQyIDE3LjQxN2MtMy4wMzYgMC01LjYyNS0xLjg0OC02LjY3OC00LjQ4OGEzLjE4MiAzLjE4MiAwIDAgMSA1LjU4LTMuMzc0YzEuMDg3LS4zMDQgMi4yMDQtLjQ2MiAzLjMzLS40NjIgMS45MSAwIDMuNzMuNTggNS4yMjcgMS42Mi0xLjQxMyAyLjk3NC00LjQ2MyA2LjcxLTcuNDU5IDYuNzF6bS4yMDMtOC40NDhjLTEuNDkgMC0yLjcwMi0xLjIxMy0yLjcwMi0yLjcwMyAwLTEuNDg4IDEuMjEyLTIuNzAyIDIuNzAyLTIuNzAyIDEuNDg4IDAgMi43IDEuMjE0IDIuNyAyLjcwMiAwIDEuNDktMS4yMTMgMi43MDItMi4yIDIuNzAyeiIvPjwvc3ZnPg==' },
  { id: 'tiktok', name: 'TikTok', icon: 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg' },
  { id: 'pinterest', name: 'Pinterest', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png' },
  { id: 'youtube', name: 'YouTube', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg' },
];

const getFileType = (fileNameOrMimeType: string | undefined | null) => {
    if (!fileNameOrMimeType) {
        return { type: 'Файл', icon: '📁', isImage: false };
    }
    const mimeType = fileNameOrMimeType.includes('/') ? fileNameOrMimeType : '';
    const extension = !mimeType ? fileNameOrMimeType.split('.').pop()?.toLowerCase() || '' : '';
    
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) return { type: 'Изображение', icon: '🖼️', isImage: true };
    if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm'].includes(extension)) return { type: 'Видео', icon: '🎬', isImage: false };
    if (mimeType.startsWith('text/') || mimeType.includes('pdf') || mimeType.includes('document') || ['txt', 'md', 'pdf', 'doc', 'docx'].includes(extension)) return { type: 'Текст', icon: '📄', isImage: false };
    return { type: 'Файл', icon: '📁', isImage: false };
};

interface AppFile {
    id: number;
    name: string;
    url: string;
    mimeType: string;
    tags?: string[];
    description?: string;
    isAnalyzing?: boolean;
}

const EmptyState = ({ icon, title, description, buttonText, onButtonClick }: {
    icon: string;
    title: string;
    description: string;
    buttonText?: string;
    onButtonClick?: () => void;
}) => (
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

const FileCardSkeleton = () => (
    <div className="file-card-skeleton" style={styles.fileCardSkeleton}>
        <div className="shimmer" style={styles.shimmer}></div>
    </div>
);

const KnowledgeBaseScreen = ({ files, isLoading, error, onUpload, onDelete }: { 
    files: AppFile[], 
    isLoading: boolean,
    error: string,
    onUpload: (files: File[]) => void, 
    onDelete: (id: number) => void
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const lowercasedQuery = searchQuery.toLowerCase();
    return files.filter(file => 
        (file.name && file.name.toLowerCase().includes(lowercasedQuery)) ||
        (file.description && file.description.toLowerCase().includes(lowercasedQuery)) ||
        (file.tags && file.tags.some(tag => tag.toLowerCase().includes(lowercasedQuery)))
    );
}, [files, searchQuery]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        onUpload(Array.from(event.target.files));
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files) {
        onUpload(Array.from(event.dataTransfer.files));
    }
  }, [onUpload]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const dropzoneStyle = useMemo(() => ({
    ...styles.dropzone,
    ...(isDragging ? styles.dropzoneActive : {}),
  }), [isDragging]);

  return (
    <div>
        <div style={styles.knowledgeBaseContent}>
            <div 
              style={dropzoneStyle} 
              onDrop={handleDrop} 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
                <input type="file" id="file-upload" multiple style={{display: 'none'}} onChange={handleFileChange} />
                <span style={styles.uploadIcon}>☁️</span>
                <p>Перетащите файлы сюда или <strong>нажмите для выбора</strong></p>
                <p style={{fontSize: '0.8rem', marginTop: '8px'}}>AI проанализирует изображения и добавит им теги для удобного поиска.</p>
            </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Ваши файлы</h3>
                <input
                    type="search"
                    placeholder="🔎 Поиск по названию, описанию, тегам..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ ...styles.input, maxWidth: '400px', width: '100%' }}
                />
            </div>

            <div style={styles.fileGrid}>
                {isLoading && (
                    Array.from({ length: 8 }).map((_, index) => <FileCardSkeleton key={index} />)
                )}
                
                {error && <p style={{...styles.errorText, gridColumn: '1 / -1'}}>{error}</p>}
                
                {!isLoading && !error && files.length === 0 && (
                     <div style={{ gridColumn: '1 / -1' }}>
                        <EmptyState 
                            icon="📚"
                            title="База знаний пуста"
                            description="Загрузите ваши медиафайлы, документы или текстовые заметки, чтобы AI мог использовать их для создания контента."
                            buttonText="📤 Загрузить первый файл"
                            onButtonClick={() => document.getElementById('file-upload')?.click()}
                        />
                    </div>
                )}
                
                {!isLoading && !error && filteredFiles.map((file) => {
                  const { icon, isImage } = getFileType(file.mimeType);
                  const cardStyle = isImage ? { ...styles.fileCard, backgroundImage: `url(${file.url})` } : styles.fileCard;
                  return (
                    <div key={file.id} style={cardStyle} className="fileCard">
                        {file.isAnalyzing && (
                            <div style={styles.fileCardAnalyzingOverlay}>
                                <div style={styles.miniLoader}></div>
                            </div>
                        )}
                       {!isImage && <div style={styles.fileCardIcon}>{icon}</div>}
                        <div style={styles.fileCardOverlay}>
                           <span style={styles.fileName}>{file.name}</span>
                            {file.tags && file.tags.length > 0 && (
                               <div style={styles.fileTagsContainer}>
                                   {file.tags.slice(0, 3).map(tag => (
                                       <span key={tag} style={styles.fileTag}>{tag}</span>
                                   ))}
                               </div>
                           )}
                        </div>
                        <button style={styles.deleteButton} className="deleteButton" onClick={() => onDelete(file.id)}>
                           🗑️
                        </button>
                    </div>
                  );
                })}
            </div>
        </div>
    </div>
  );
};

const PostGeneratorScreen = ({ files, brandContextPrompt, onAddPostIdea }: { files: AppFile[], brandContextPrompt: string, onAddPostIdea: (idea: Omit<Post, 'id' | 'status' | 'date'>) => void }) => {
    const [topic, setTopic] = useState('');
    const [selectedFile, setSelectedFile] = useState<AppFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    
    const handleFileSelect = (file: AppFile) => {
        setSelectedFile(prev => prev?.id === file.id ? null : file);
    }
    
    const urlToGenerativePart = async (url: string, mimeType: string) => {
        try {
            const response = await fetchWithAuth(url); // Use fetchWithAuth for potentially protected files
            if (!response.ok) { throw new Error(`Не удалось загрузить изображение с ${url}`); }
            const blob = await response.blob();
            const base64EncodedData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return {
                inlineData: { data: base64EncodedData, mimeType: mimeType, },
            };
        } catch (e) {
            console.error("Ошибка при загрузке изображения для анализа:", e);
            alert("Не удалось загрузить изображение для анализа. Убедитесь, что файл доступен.");
            return null;
        }
    };

    const handleGenerate = async () => {
        if (!topic && !selectedFile) return;
        setIsLoading(true);
        setResult('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const textPrompt = `Ты — профессиональный SMM-менеджер. Напиши яркий и вовлекающий пост для социальных сетей на русском языке.
                          \n\nТема: "${topic}"
                          \n\n${brandContextPrompt}
                          \n\nЕсли предоставлено изображение, обязательно основывай текст поста на том, что изображено на картинке.
                          Твой пост должен быть структурированным, содержать призыв к действию и релевантные хэштеги.`;
            
            const parts: ({ text: string } | { inlineData: { data: string; mimeType: string; } })[] = [];
            
            if (selectedFile && getFileType(selectedFile.mimeType).isImage) {
              const imagePart = await urlToGenerativePart(selectedFile.url, selectedFile.mimeType);
              if (imagePart) parts.push(imagePart);
            }
            parts.push({ text: textPrompt });
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts },
            });
            
            setResult(response.text);

        } catch (error) {
            console.error("Ошибка при генерации поста:", error);
            setResult("К сожалению, произошла ошибка. Пожалуйста, попробуйте еще раз.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAddToIdeas = () => {
        if (!result) return;
        onAddPostIdea({
            topic: topic || `AI: ${result.substring(0, 40)}...`,
            postType: "Сгенерировано AI",
            description: result,
            content: result,
        });
        // Clear fields for next generation
        setTopic('');
        setResult('');
        setSelectedFile(null);
    };

    const canGenerate = topic || selectedFile;

    return (
        <div>
            <div style={styles.generatorLayout}>
                <div style={styles.generatorControls}>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="topic">1. Тема поста (необязательно, если выбрано фото)</label>
                        <input 
                            type="text" 
                            id="topic"
                            style={styles.input}
                            placeholder="Например: Анонс новой летней коллекции"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>2. Выберите файл (особенно фото)</label>
                        {files.length === 0 ? (
                             <EmptyState 
                                icon="📚"
                                title="Файлы не найдены"
                                description="Сначала загрузите файлы в разделе 'База знаний', чтобы использовать их для генерации."
                            />
                        ) : (
                            <div style={styles.fileSelectionGrid}>
                                {files.map(appFile => {
                                    const { icon, isImage } = getFileType(appFile.mimeType);
                                    const isSelected = selectedFile?.id === appFile.id;
                                    const cardStyle = isImage 
                                      ? { ...styles.fileSelectItem, backgroundImage: `url(${appFile.url})` } 
                                      : styles.fileSelectItem;
                                    const finalStyle = isSelected ? { ...cardStyle, ...styles.fileSelectItemActive } : cardStyle;

                                    return (
                                        <div 
                                            key={appFile.id} 
                                            style={finalStyle}
                                            onClick={() => handleFileSelect(appFile)}
                                        >
                                           {!isImage && <div style={styles.fileSelectIcon}>{icon}</div>}
                                            <div style={styles.fileSelectOverlay}>
                                                <div style={{/* styles.fileSelectName */}}>{appFile.name}</div>
                                            </div>
                                            {isSelected && <div style={styles.fileSelectCheck}>✔</div>}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    <button 
                        style={canGenerate ? styles.button : styles.buttonDisabled}
                        disabled={!canGenerate || isLoading}
                        onClick={handleGenerate}
                    >
                        {isLoading ? 'Генерация...' : '✨ Сгенерировать'}
                    </button>
                </div>
                <div style={styles.generatorResult}>
                    <label style={styles.label}>3. Результат</label>
                    <div style={styles.resultBox}>
                        {isLoading && <div style={styles.loader}></div>}
                        {!isLoading && result === '' && <p style={styles.placeholderText}>Здесь появится сгенерированный текст...</p>}
                        {!isLoading && result && <p style={{whiteSpace: 'pre-wrap'}}>{result}</p>}
                    </div>
                     {result && !isLoading && (
                        <button onClick={handleAddToIdeas} style={{...styles.button, marginTop: '20px', backgroundColor: '#28a745'}}>
                            📋 Добавить в Идеи
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

const ImageGeneratorScreen = ({ onSaveGeneratedImage }: { onSaveGeneratedImage: (data: { base64: string; name: string }) => Promise<void> }) => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const handleGenerate = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setError('');
        setGeneratedImage(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: {
                  numberOfImages: 1,
                  outputMimeType: 'image/jpeg',
                  aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
                },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                const base64ImageBytes = response.generatedImages[0].image.imageBytes;
                setGeneratedImage(`data:image/jpeg;base64,${base64ImageBytes}`);
            } else {
                setError('Не удалось сгенерировать изображение. Попробуйте другой запрос.');
            }

        } catch (err) {
            console.error('Ошибка при генерации изображения:', err);
            const message = (err instanceof Error && err.message) || 'Неизвестная ошибка';
            setError(`Произошла ошибка: ${message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSave = async () => {
        if (!generatedImage) return;
        setIsSaving(true);
        try {
            const base64Data = generatedImage.split(',')[1];
            await onSaveGeneratedImage({ base64: base64Data, name: `${prompt.substring(0, 30)}.jpg` });
        } catch (error) {
            console.error("Failed to save image:", error);
            // Toast is handled by the parent
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div>
            <div style={styles.generatorLayout}>
                <div style={styles.generatorControls}>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="prompt">1. Опишите изображение</label>
                        <textarea
                            id="prompt"
                            style={{...styles.textarea, minHeight: '120px'}}
                            placeholder="Например: Кот в очках, читающий книгу в уютной библиотеке, в стиле импрессионизма"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>2. Выберите соотношение сторон</label>
                        <div style={styles.aspectRatioSelector}>
                            {['1:1', '16:9', '9:16', '4:3', '3:4'].map(ratio => (
                                <button 
                                    key={ratio}
                                    style={aspectRatio === ratio ? styles.aspectRatioButtonActive : styles.aspectRatioButton}
                                    onClick={() => setAspectRatio(ratio)}
                                >
                                    {ratio}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button 
                        style={prompt ? styles.button : styles.buttonDisabled}
                        disabled={!prompt || isLoading}
                        onClick={handleGenerate}
                    >
                         {isLoading ? 'Генерация...' : '🎨 Сгенерировать'}
                    </button>
                </div>
                <div style={styles.generatorResult}>
                     <label style={styles.label}>3. Результат</label>
                     <div style={{...styles.resultBox, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        {isLoading && <div style={styles.loader}></div>}
                        {error && <p style={{...styles.errorText, padding: '20px'}}>{error}</p>}
                        {!isLoading && !error && !generatedImage && <p style={styles.placeholderText}>Здесь появится ваше изображение...</p>}
                        {generatedImage && (
                            <div style={styles.imagePreviewContainer}>
                                <img src={generatedImage} alt="Generated image" style={styles.generatedImage}/>
                                <div style={styles.imageActions}>
                                    <a href={generatedImage} download={`${prompt.substring(0, 30)}.jpg`} style={styles.imageActionButton}>
                                        📥 Скачать
                                    </a>
                                    <button onClick={handleSave} style={styles.imageActionButton} disabled={isSaving}>
                                        {isSaving ? 'Сохранение...' : '💾 Сохранить в Базу'}
                                    </button>
                                </div>
                            </div>
                        )}
                     </div>
                </div>
            </div>
        </div>
    )
};

const ImageEditorScreen = ({ files, onSaveGeneratedImage }: { files: AppFile[], onSaveGeneratedImage: (data: { base64: string; name: string }) => Promise<void> }) => {
    const [prompt, setPrompt] = useState('');
    const [selectedFile, setSelectedFile] = useState<AppFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const imageFiles = useMemo(() => files.filter(f => getFileType(f.mimeType).isImage), [files]);

    const handleFileSelect = (file: AppFile) => {
        setSelectedFile(file);
        setEditedImage(null); // Clear previous result when a new image is selected
        setError('');
    };
    
    const handleEdit = async () => {
        if (!prompt || !selectedFile) return;
        setIsLoading(true);
        setError('');
        setEditedImage(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Fetch and convert the selected image to a generative part
            const responseBlob = await fetchWithAuth(selectedFile.url);
            if (!responseBlob.ok) throw new Error(`Failed to fetch image from ${selectedFile.url}`);
            const blob = await responseBlob.blob();
            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            
            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType: selectedFile.mimeType,
                },
            };
            
            const textPart = { text: prompt };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [imagePart, textPart] },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            // Extract the edited image from the response
            const newImagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
            if (newImagePart?.inlineData) {
                const base64ImageBytes = newImagePart.inlineData.data;
                setEditedImage(`data:${newImagePart.inlineData.mimeType};base64,${base64ImageBytes}`);
            } else {
                setError('Не удалось отредактировать изображение. Модель не вернула результат. Попробуйте другой запрос.');
            }

        } catch (err) {
            console.error('Ошибка при редактировании изображения:', err);
            const message = (err instanceof Error && err.message) || 'Неизвестная ошибка';
            setError(`Произошла ошибка: ${message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSave = async () => {
        if (!editedImage) return;
        setIsSaving(true);
        try {
            const base64Data = editedImage.split(',')[1];
            await onSaveGeneratedImage({ base64: base64Data, name: `edited_${selectedFile?.name || 'image.jpg'}` });
        } catch (error) {
            console.error("Failed to save edited image:", error);
            // Toast is handled by the parent
        } finally {
            setIsSaving(false);
        }
    };

    const canEdit = prompt && selectedFile;

    return (
        <div>
            <div style={styles.generatorLayout}>
                <div style={styles.generatorControls}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>1. Выберите изображение для редактирования</label>
                        {imageFiles.length === 0 ? (
                             <EmptyState 
                                icon="🖼️"
                                title="Изображения не найдены"
                                description="Сначала загрузите изображения в 'Базу знаний', чтобы их можно было редактировать."
                            />
                        ) : (
                            <div style={styles.fileSelectionGrid}>
                                {imageFiles.map(appFile => {
                                    const isSelected = selectedFile?.id === appFile.id;
                                    const finalStyle = isSelected 
                                      ? { ...styles.fileSelectItem, ...styles.fileSelectItemActive, backgroundImage: `url(${appFile.url})` } 
                                      : { ...styles.fileSelectItem, backgroundImage: `url(${appFile.url})` };

                                    return (
                                        <div 
                                            key={appFile.id} 
                                            style={finalStyle}
                                            onClick={() => handleFileSelect(appFile)}
                                        >
                                            <div style={styles.fileSelectOverlay}>
                                                <span>{appFile.name}</span>
                                            </div>
                                            {isSelected && <div style={styles.fileSelectCheck}>✔</div>}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                     <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="prompt">2. Опишите, что нужно изменить</label>
                        <textarea
                            id="prompt"
                            style={{...styles.textarea, minHeight: '100px'}}
                            placeholder="Например: Добавь на кота смешную шляпу"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={!selectedFile}
                        />
                    </div>
                    <button 
                        style={canEdit ? styles.button : styles.buttonDisabled}
                        disabled={!canEdit || isLoading}
                        onClick={handleEdit}
                    >
                         {isLoading ? 'Редактирование...' : '🪄 Редактировать'}
                    </button>
                </div>
                <div style={styles.generatorResult}>
                     <label style={styles.label}>3. Результат</label>
                     <div style={{...styles.resultBox, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        {isLoading && <div style={styles.loader}></div>}
                        {error && <p style={{...styles.errorText, padding: '20px'}}>{error}</p>}
                        
                        {!isLoading && !error && !selectedFile && <p style={styles.placeholderText}>Выберите изображение, чтобы начать...</p>}
                        
                        {!isLoading && !error && selectedFile && !editedImage && (
                            <img src={selectedFile.url} alt="Original" style={styles.generatedImage}/>
                        )}

                        {editedImage && (
                            <div style={styles.imagePreviewContainer}>
                                <img src={editedImage} alt="Edited image" style={styles.generatedImage}/>
                                <div style={styles.imageActions}>
                                    <a href={editedImage} download={`edited_${selectedFile?.name || 'image.jpg'}`} style={styles.imageActionButton}>
                                        📥 Скачать
                                    </a>
                                    <button onClick={handleSave} style={styles.imageActionButton} disabled={isSaving}>
                                        {isSaving ? 'Сохранение...' : '💾 Сохранить в Базу'}
                                    </button>
                                </div>
                            </div>
                        )}
                     </div>
                </div>
            </div>
        </div>
    )
};

const fileUrlToBase64 = async (url: string, mimeType: string) => {
    const response = await fetchWithAuth(url);
    if (!response.ok) throw new Error(`Не удалось загрузить файл с ${url}`);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const VideoGeneratorScreen = ({ files, onUpload, addToast }: { files: AppFile[], onUpload: (files: File[]) => void, addToast: (message: string, type: 'success' | 'error') => void; }) => {
    const [mode, setMode] = useState<'default' | 'interpolation' | 'references' | 'extend'>('default');
    const [prompt, setPrompt] = useState('');
    const [startFile, setStartFile] = useState<AppFile | null>(null);
    const [endFile, setEndFile] = useState<AppFile | null>(null);
    const [referenceFiles, setReferenceFiles] = useState<AppFile[]>([]);
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [resolution, setResolution] = useState('720p');
    
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState('');
    
    const [generatedVideos, setGeneratedVideos] = useState<{ id: number; url: string; blob: Blob; operation: any; prompt: string }[]>([]);
    const [videoToExtend, setVideoToExtend] = useState<any | null>(null);

    const [isSaving, setIsSaving] = useState<number | null>(null);
    const [apiKeyNeeded, setApiKeyNeeded] = useState(false);

    const imageFiles = useMemo(() => files.filter(f => getFileType(f.mimeType).isImage), [files]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isLoading) {
            const messages = ["Собираем пиксели в кадры...", "Оживляем вашу идею...", "Рендеринг... это может занять несколько минут.", "Почти готово, добавляем последние штрихи..."];
            let messageIndex = 0;
            setLoadingMessage(messages[messageIndex]);
            interval = setInterval(() => {
                messageIndex = (messageIndex + 1) % messages.length;
                setLoadingMessage(messages[messageIndex]);
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [isLoading]);
    
    const handleReferenceFileToggle = (file: AppFile) => {
        setReferenceFiles(prev => {
            const isSelected = prev.some(f => f.id === file.id);
            if (isSelected) {
                return prev.filter(f => f.id !== file.id);
            } else {
                if (prev.length < 3) {
                    return [...prev, file];
                } else {
                    addToast('Можно выбрать до 3 референсных изображений.', 'error');
                }
                return prev;
            }
        });
    };

    const handleGenerate = async () => {
        if (typeof window.aistudio?.hasSelectedApiKey === 'function') {
             const hasKey = await window.aistudio.hasSelectedApiKey();
             if (!hasKey) {
                 setApiKeyNeeded(true);
                 return;
             }
        }

        setIsLoading(true);
        setError('');
        setApiKeyNeeded(false);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            let operation;

            switch (mode) {
                case 'default':
                case 'interpolation':
                    let imagePayload;
                    if (startFile) {
                        imagePayload = { imageBytes: await fileUrlToBase64(startFile.url, startFile.mimeType), mimeType: startFile.mimeType };
                    }
                    let lastFramePayload;
                    if (mode === 'interpolation' && endFile) {
                        lastFramePayload = { imageBytes: await fileUrlToBase64(endFile.url, endFile.mimeType), mimeType: endFile.mimeType };
                    }
                     operation = await ai.models.generateVideos({
                        model: 'veo-3.1-fast-generate-preview',
                        prompt: prompt || ' ',
                        ...(imagePayload && { image: imagePayload }),
                        config: { numberOfVideos: 1, resolution: resolution as '720p' | '1080p', aspectRatio: aspectRatio as '16:9' | '9:16', ...(lastFramePayload && { lastFrame: lastFramePayload }) }
                    });
                    break;
                case 'references':
                    if (referenceFiles.length === 0 || !prompt) throw new Error("Для этого режима нужен промпт и хотя бы одно референсное изображение.");
// Fix: Use `VideoGenerationReferenceType.ASSET` enum instead of the string 'ASSET' to match the expected type.
// Added explicit type annotation for `referenceImagesPayload` for better type safety.
                    const referenceImagesPayload: VideoGenerationReferenceImage[] = await Promise.all(referenceFiles.map(async file => ({
                        image: { imageBytes: await fileUrlToBase64(file.url, file.mimeType), mimeType: file.mimeType },
                        referenceType: VideoGenerationReferenceType.ASSET,
                    })));
                    operation = await ai.models.generateVideos({
                        model: 'veo-3.1-generate-preview',
                        prompt: prompt,
                        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9', referenceImages: referenceImagesPayload }
                    });
                    break;
                case 'extend':
                    if (!videoToExtend || !prompt) throw new Error("Выберите видео и опишите, что должно произойти дальше.");
                    operation = await ai.models.generateVideos({
                        model: 'veo-3.1-generate-preview',
                        prompt: prompt,
                        video: videoToExtend.operation.response?.generatedVideos?.[0]?.video,
                        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: videoToExtend.operation.response?.generatedVideos?.[0]?.video?.aspectRatio || '16:9' }
                    });
                    break;
                default:
                    throw new Error("Неизвестный режим генерации.");
            }

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }

            if (operation.error) throw new Error(operation.error.message);

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) throw new Error("Не удалось получить ссылку на видео.");

            const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            if (!videoResponse.ok) throw new Error("Не удалось загрузить сгенерированное видео.");
            
            const videoBlob = await videoResponse.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            setGeneratedVideos(prev => [...prev, { id: Date.now(), url: videoUrl, blob: videoBlob, operation, prompt: prompt }]);

        } catch (err) {
            console.error('Ошибка при генерации видео:', err);
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            let errorMessage = `Произошла ошибка: ${message}`;
            if (message.includes("Requested entity was not found")) {
                errorMessage = "Ошибка API ключа. Пожалуйста, выберите другой ключ и попробуйте снова.";
                setApiKeyNeeded(true);
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSelectKey = async () => {
        await window.aistudio.openSelectKey();
        setApiKeyNeeded(false);
        setTimeout(handleGenerate, 500); 
    };

    const handleSave = async (video: { id: number; blob: Blob; prompt: string }) => {
        setIsSaving(video.id);
        try {
            const videoFile = new File([video.blob], `${(video.prompt || 'generated_video').substring(0, 30)}.mp4`, { type: 'video/mp4' });
            await onUpload([videoFile]);
        } catch (error) {
            console.error("Failed to save video:", error);
        } finally {
            setIsSaving(null);
        }
    };
    
    const latestVideo = generatedVideos.length > 0 ? generatedVideos[generatedVideos.length - 1] : null;

    return (
        <div>
            <div style={styles.generatorLayout}>
                <div style={styles.generatorControls}>
                     <div style={styles.adapterSourceTabs}>
                        {(['default', 'interpolation', 'references', 'extend'] as const).map(m => (
                            <button key={m} style={mode === m ? styles.adapterSourceTabActive : styles.adapterSourceTab} onClick={() => setMode(m)} disabled={m === 'extend' && generatedVideos.length === 0}>
                                {m === 'default' && 'Текст/Фото'}
                                {m === 'interpolation' && 'Интерполяция'}
                                {m === 'references' && 'Референсы'}
                                {m === 'extend' && 'Продлить'}
                            </button>
                        ))}
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="video-prompt">1. Описание (промпт)</label>
                        <textarea
                            id="video-prompt"
                            style={{...styles.textarea, minHeight: '80px'}}
                            placeholder={
                                mode === 'extend' ? "Что должно произойти дальше?" :
                                mode === 'references' ? "Опишите сцену с персонажами/предметами" :
                                "Неоновая голограмма кота на скейтборде"
                            }
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />
                    </div>
                     
                     {mode !== 'extend' && <div style={styles.formGroup}>
                        <label style={styles.label}>2. Изображения</label>
                        {mode === 'default' && <p style={styles.cardSubtitle}>Стартовое изображение (необязательно)</p>}
                        {mode === 'interpolation' && <p style={styles.cardSubtitle}>Стартовое и конечное изображение</p>}
                        {mode === 'references' && <p style={styles.cardSubtitle}>До 3-х референсных изображений</p>}

                        <div style={{ display: 'flex', gap: '16px' }}>
                            { (mode === 'default' || mode === 'interpolation') && 
                                <FilePicker title="Старт" files={imageFiles} selectedFile={startFile} onSelect={setStartFile} /> }
                            { mode === 'interpolation' &&
                                <FilePicker title="Конец" files={imageFiles} selectedFile={endFile} onSelect={setEndFile} /> }
                        </div>
                        { mode === 'references' && 
                             <div style={styles.fileSelectionGrid}>
                                {imageFiles.map(appFile => {
                                    const isSelected = referenceFiles.some(f => f.id === appFile.id);
                                    return (
                                        <div 
                                            key={appFile.id} 
                                            style={{...styles.fileSelectItem, ...(isSelected ? styles.fileSelectItemActive : {}), backgroundImage: `url(${appFile.url})`}}
                                            onClick={() => handleReferenceFileToggle(appFile)}
                                        >
                                            <div style={styles.fileSelectOverlay}><span>{appFile.name}</span></div>
                                            {isSelected && <div style={styles.fileSelectCheck}>✔</div>}
                                        </div>
                                    );
                                })}
                            </div>
                         }
                    </div>}

                    {mode === 'extend' && 
                         <div style={styles.formGroup}>
                            <label style={styles.label}>2. Выберите видео для продления</label>
                            <select style={styles.input} onChange={e => setVideoToExtend(generatedVideos.find(v => v.id === Number(e.target.value)) || null)}>
                                <option value="">-- Выберите видео --</option>
                                {generatedVideos.map(v => <option key={v.id} value={v.id}>{v.prompt.substring(0,50)}...</option>)}
                            </select>
                         </div>
                    }

                    <div style={styles.formGroup}>
                        <label style={styles.label}>3. Настройки</label>
                         <div style={styles.aspectRatioSelector}>
                            <strong>Формат:</strong>
                            {['16:9', '9:16'].map(ratio => <button key={ratio} style={aspectRatio === ratio ? styles.aspectRatioButtonActive : styles.aspectRatioButton} onClick={() => setAspectRatio(ratio)} disabled={mode === 'references' || mode === 'extend'}>{ratio}</button>)}
                        </div>
                         <div style={styles.aspectRatioSelector}>
                            <strong>Качество:</strong>
                            {['720p', '1080p'].map(res => <button key={res} style={resolution === res ? styles.aspectRatioButtonActive : styles.aspectRatioButton} onClick={() => setResolution(res)} disabled={mode === 'references' || mode === 'extend'}>{res}</button>)}
                        </div>
                        {(mode === 'references' || mode === 'extend') && <p style={styles.cardSubtitle}>Для этого режима формат 16:9 и качество 720p установлены автоматически.</p>}
                    </div>
                    <button style={styles.button} disabled={isLoading} onClick={handleGenerate}>
                        {isLoading ? 'Генерация...' : '🎬 Сгенерировать видео'}
                    </button>
                </div>
                <div style={styles.generatorResult}>
                     <label style={styles.label}>4. Результат</label>
                     <div style={{...styles.resultBox, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px'}}>
                        {isLoading && <> <div style={styles.loader}></div> <p style={styles.placeholderText}>{loadingMessage}</p> </>}
                        {apiKeyNeeded && <ApiKeyPrompt onSelectKey={handleSelectKey} />}
                        {error && !isLoading && <p style={{...styles.errorText, padding: '20px'}}>{error}</p>}
                        {!isLoading && !error && !apiKeyNeeded && !latestVideo && <p style={styles.placeholderText}>Здесь появится ваше видео...</p>}
                        {latestVideo && (
                            <div style={styles.imagePreviewContainer}>
                                <video src={latestVideo.url} controls style={styles.generatedVideo} />
                                <div style={styles.imageActions}>
                                    <a href={latestVideo.url} download={`${(latestVideo.prompt || 'generated_video').substring(0, 30)}.mp4`} style={styles.imageActionButton}>📥 Скачать</a>
                                    <button onClick={() => handleSave(latestVideo)} style={styles.imageActionButton} disabled={isSaving === latestVideo.id}>{isSaving === latestVideo.id ? 'Сохранение...' : '💾 Сохранить'}</button>
                                </div>
                            </div>
                        )}
                     </div>
                     {generatedVideos.length > 0 && <div style={{padding: '16px', borderTop: '1px solid #e9ecef'}}>
                        <h4 style={{marginBottom: '12px'}}>Сгенерированные видео:</h4>
                        <div style={{maxHeight: '150px', overflowY: 'auto'}}>
                            {generatedVideos.map(v => (
                                <div key={v.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #f0f0f0'}}>
                                    <p style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{v.prompt || 'Видео без промпта'}</p>
                                    <button style={{...styles.button, padding: '4px 8px', fontSize: '0.8rem', marginLeft: '12px'}} onClick={() => { setVideoToExtend(v); setMode('extend'); setPrompt(''); }}>Продлить</button>
                                </div>
                            ))}
                        </div>
                     </div>}
                </div>
            </div>
        </div>
    );
};

const FilePicker = ({ title, files, selectedFile, onSelect }: { title: string, files: AppFile[], selectedFile: AppFile | null, onSelect: (file: AppFile | null) => void }) => (
    <div style={{flex: 1}}>
        <p style={{...styles.label, fontSize: '0.9rem', marginBottom: '8px'}}>{title}</p>
        <div style={{...styles.fileSelectionGrid, maxHeight: '120px'}}>
             {files.length === 0 ? <p style={styles.placeholderText}>Нет файлов</p> : files.map(appFile => {
                const isSelected = selectedFile?.id === appFile.id;
                return (
                    <div 
                        key={appFile.id} 
                        style={{...styles.fileSelectItem, ...(isSelected ? styles.fileSelectItemActive : {}), backgroundImage: `url(${appFile.url})`}}
                        onClick={() => onSelect(isSelected ? null : appFile)}
                    >
                        <div style={styles.fileSelectOverlay}><span>{appFile.name}</span></div>
                        {isSelected && <div style={styles.fileSelectCheck}>✔</div>}
                    </div>
                );
            })}
        </div>
    </div>
);

const ApiKeyPrompt = ({ onSelectKey }: { onSelectKey: () => void }) => (
     <div style={{textAlign: 'center'}}>
        <p style={{...styles.errorText, marginBottom: '16px'}}>Требуется API ключ для генерации видео.</p>
        <p style={styles.cardSubtitle}>Для использования этой модели вам необходимо выбрать API-ключ с доступом к Veo и <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer">включенным биллингом</a>.</p>
        <button style={{...styles.button, marginTop: '16px'}} onClick={onSelectKey}>Выбрать API ключ</button>
    </div>
);

type StrategyResult = {
    strategy_summary: string;
    post_ideas: Omit<Post, 'id' | 'status'>[];
}

const StrategyGeneratorScreen = ({ onAddPostIdeas, brandContextPrompt }: {
    onAddPostIdeas: (ideas: Omit<Post, 'id' | 'status'>[]) => void;
    brandContextPrompt: string;
}) => {
    const [prompt, setPrompt] = useState('');
    const [numPosts, setNumPosts] = useState(5);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<StrategyResult | null>(null);

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const fullPrompt = `Ты — ведущий SMM-стратег. Тебе нужно разработать контент-стратегию для клиента.
            
            **Информация о клиенте:**
            ${prompt}
            
            **Твоя задача:**
            1.  Кратко сформулировать основную стратегию (1-2 абзаца).
            2.  Предложить ${numPosts} конкретных идей для постов. Каждая идея должна включать:
                -   \`topic\`: цепляющая тема поста.
                -   \`postType\`: подходящий тип контента (например, 'Пост с фото', 'Видео Reels', 'Статья', 'Карусель', 'Конкурс').
                -   \`description\`: краткое, но содержательное описание того, о чем должен быть пост.
            
            **Гайдлайны по стилю бренда:**
            ${brandContextPrompt}
            
            Верни ответ СТРОГО в формате JSON, без лишних символов или комментариев.`;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    strategy_summary: { type: Type.STRING, description: "Краткое изложение контент-стратегии." },
                    post_ideas: {
                        type: Type.ARRAY,
                        description: "Список идей для постов.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                topic: { type: Type.STRING, description: "Тема поста." },
                                postType: { type: Type.STRING, description: "Тип поста (e.g., 'Видео Reels')." },
                                description: { type: Type.STRING, description: "Описание идеи поста." },
                            },
                            required: ["topic", "postType", "description"],
                        },
                    },
                },
                required: ["strategy_summary", "post_ideas"],
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });
            
// Fix: Explicitly cast the result of JSON.parse to StrategyResult to resolve a type error.
// The parsed object was being inferred as 'unknown', which is not assignable to the 'StrategyResult' state type. This ensures type safety.
// Fix: Cast `response.text` to string for JSON.parse to resolve type error.
            const parsedResult = JSON.parse(response.text as string) as StrategyResult;
            setResult(parsedResult);

        } catch (err) {
            console.error('Ошибка при генерации стратегии:', err);
            if (err instanceof Error) {
                setError(`Произошла ошибка: ${err.message}`);
            } else {
                setError('Произошла неизвестная ошибка при генерации стратегии.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddIdeasToPlan = () => {
        if (result && result.post_ideas) {
            onAddPostIdeas(result.post_ideas);
            setResult(null); // Clear results after adding
        }
    };

    return (
        <div>
            <div style={styles.generatorLayout}>
                <div style={styles.generatorControls}>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="strategy-prompt">1. Опишите ваш бренд и цели</label>
                        <textarea
                            id="strategy-prompt"
                            style={{...styles.textarea, minHeight: '150px'}}
                            placeholder="Например: Магазин авторской керамики ручной работы. Цель - анонсировать новую коллекцию и увеличить продажи."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="num-posts">2. Количество идей для постов</label>
                        <input
                            type="number"
                            id="num-posts"
                            style={styles.input}
                            value={numPosts}
                            onChange={(e) => setNumPosts(Math.max(1, parseInt(e.target.value, 10)))}
                            min="1"
                            max="10"
                        />
                    </div>
                    <button 
                        style={prompt ? styles.button : styles.buttonDisabled}
                        disabled={!prompt || isLoading}
                        onClick={handleGenerate}
                    >
                        {isLoading ? 'Генерация...' : '✨ Сгенерировать стратегию'}
                    </button>
                </div>
                <div style={styles.generatorResult}>
                    <label style={styles.label}>3. Результат</label>
                    <div style={{...styles.resultBox, padding: 0}}>
                        {isLoading && <div style={{...styles.loader, marginTop: '40px'}}></div>}
                        {error && <p style={{...styles.errorText, padding: '20px'}}>{error}</p>}
                        {!isLoading && !error && !result && <p style={styles.placeholderText}>Здесь появится ваша стратегия...</p>}
                        
                        {result && (
                            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div>
                                    <h3 style={{...styles.cardTitle, fontSize: '1.1rem' }}>Общая стратегия</h3>
                                    <p style={{ ...styles.cardSubtitle, fontSize: '1rem', whiteSpace: 'pre-wrap' }}>{result.strategy_summary}</p>
                                    <h3 style={{...styles.cardTitle, fontSize: '1.1rem', marginTop: '24px' }}>Предложенные идеи</h3>
                                </div>
                                <div style={{...styles.planList, overflowY: 'auto', flex: 1, paddingRight: '10px' }}>
                                    {result.post_ideas.map((post, index) => (
                                        <div key={index} style={{...styles.planCard, cursor: 'default'}}>
                                            <strong style={styles.planCardTitle}>{post.topic}</strong>
                                            <span style={styles.planCardBadge}>{post.postType}</span>
                                            <p style={styles.planCardDescription}>{post.description}</p>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={handleAddIdeasToPlan}
                                    style={{ ...styles.button, marginTop: '20px', width: '100%'}}
                                >
                                    Добавить все идеи в Контент-план
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

type TrendResult = {
    text: string;
    sources: { uri: string; title: string }[];
}

const TrendSpotterScreen = () => {
    const [industry, setIndustry] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<TrendResult | null>(null);

    const handleFindTrends = async () => {
        if (!industry) return;
        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
            Ты — опытный SMM-аналитик и тренд-вотчер. Твоя задача — найти самые свежие и актуальные тренды для указанной отрасли, используя данные из Google Поиска.

            **Отрасль клиента:** ${industry}

            **Что нужно сделать:**
            1.  Определи 3-5 ключевых трендов, набирающих популярность прямо сейчас. Это могут быть новые форматы контента (например, определенный стиль Reels), вирусные челленджи, актуальные темы для обсуждения или новости, влияющие на отрасль.
            2.  Для каждого тренда дай краткое описание (1-2 предложения).
            3.  Предложи конкретную идею, как бренд из этой отрасли может адаптировать этот тренд для своего контент-плана.
            4.  Отформатируй ответ, используя Markdown для заголовков и списков, чтобы его было легко читать.
            `;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });
            
            const textResult = response.text;
            const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
            
            const sources = rawChunks
                .map(chunk => chunk.web)
                .filter(web => web && web.uri)
                .map(web => ({ uri: web!.uri!, title: web!.title || web!.uri! }));

            const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());

            setResult({ text: textResult, sources: uniqueSources });

        } catch (err) {
            console.error('Ошибка при поиске трендов:', err);
            if (err instanceof Error) {
                setError(`Произошла ошибка: ${err.message}`);
            } else {
                setError('Произошла неизвестная ошибка при поиске трендов.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <div style={styles.generatorLayout}>
                <div style={styles.generatorControls}>
                    <h3 style={styles.cardTitle}>Поиск трендов</h3>
                    <p style={styles.cardSubtitle}>Узнайте о последних тенденциях в вашей отрасли, чтобы создавать актуальный контент.</p>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="industry-prompt">Опишите вашу отрасль или нишу</label>
                        <textarea
                            id="industry-prompt"
                            style={{...styles.textarea, minHeight: '120px'}}
                            placeholder="Например: мода, экологичная косметика, кофейни в Москве, стритвир-одежда"
                            value={industry}
                            onChange={(e) => setIndustry(e.target.value)}
                        />
                    </div>
                    <button 
                        style={industry ? styles.button : styles.buttonDisabled}
                        disabled={!industry || isLoading}
                        onClick={handleFindTrends}
                    >
                        {isLoading ? 'Поиск...' : '🔍 Найти тренды'}
                    </button>
                </div>
                <div style={styles.generatorResult}>
                    <label style={styles.label}>Результат</label>
                    <div style={styles.resultBox}>
                        {isLoading && <div style={styles.loader}></div>}
                        {error && <p style={styles.errorText}>{error}</p>}
                        {!isLoading && !error && !result && <p style={styles.placeholderText}>Здесь появятся актуальные тренды, найденные с помощью Google Поиска...</p>}
                        
                        {result && (
                            <div>
                                <p style={{whiteSpace: 'pre-wrap'}}>{result.text}</p>
                                {result.sources.length > 0 && (
                                    <div style={{marginTop: '24px'}}>
                                        <h4 style={{...styles.cardTitle, fontSize: '1rem', borderTop: '1px solid #e9ecef', paddingTop: '16px'}}>Источники:</h4>
                                        <ul style={{ listStylePosition: 'inside', paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {result.sources.map((source, index) => (
                                                <li key={index}>
                                                    <a href={source.uri} target="_blank" rel="noopener noreferrer">
                                                        {source.title || source.uri}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const adaptationPlatforms = [
  { id: 'instagram', name: 'Пост для Instagram', icon: '📸' },
  { id: 'telegram', name: 'Анонс для Telegram', icon: '✈️' },
  { id: 'tiktok', name: 'Сценарий для Reels/TikTok', icon: '🎬' },
  { id: 'vk', name: 'Пост для ВКонтакте', icon: '👥' },
];

const ContentAdapterScreen = ({ allPosts, brandContextPrompt, addToast }: { allPosts: Post[], brandContextPrompt: string, addToast: (message: string, type: 'success' | 'error') => void }) => {
    const [sourceMode, setSourceMode] = useState<'text' | 'post'>('text');
    const [inputText, setInputText] = useState('');
    const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [adaptedContent, setAdaptedContent] = useState<Record<string, string> | null>(null);
    const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

    const sourceContent = useMemo(() => {
        if (sourceMode === 'text') return inputText;
        if (sourceMode === 'post' && selectedPostId) {
            const post = allPosts.find(p => p.id === selectedPostId);
            return post?.content || post?.description || '';
        }
        return '';
    }, [sourceMode, inputText, selectedPostId, allPosts]);

    const handlePlatformToggle = (platformId: string) => {
        setSelectedPlatforms(prev => 
            prev.includes(platformId) 
                ? prev.filter(id => id !== platformId) 
                : [...prev, platformId]
        );
    };

    const handleAdapt = async () => {
        if (!sourceContent || selectedPlatforms.length === 0) return;
        setIsLoading(true);
        setError('');
        setAdaptedContent(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const prompt = `Ты — эксперт по SMM, специализирующийся на адаптации контента. Твоя задача — переписать исходный текст для разных социальных сетей, учитывая их формат, стиль и аудиторию.

            **Исходный текст:**
            "${sourceContent}"

            **Гайдлайны по стилю бренда:**
            ${brandContextPrompt}

            **Нужно адаптировать этот текст для следующих платформ:** ${selectedPlatforms.join(', ')}.

            - Для **instagram**: Сделай текст визуально привлекательным, добавь эмодзи, раздели на абзацы и подбери 3-5 релевантных хэштегов.
            - Для **telegram**: Напиши более сжатый и информативный анонс.
            - Для **tiktok**: Создай короткий, динамичный сценарий для видео (по пунктам или тезисно), который легко озвучить или наложить текстом на видео.
            - Для **vk**: Напиши дружелюбный пост, который мотивирует к обсуждению в комментариях.

            Верни ответ СТРОГО в формате JSON, где ключ — это ID платформы (${selectedPlatforms.map(p => `'${p}'`).join(', ')}), а значение — адаптированный текст.`;

            const schemaProperties = selectedPlatforms.reduce((acc, platformId) => {
                acc[platformId] = { type: Type.STRING };
                return acc;
            }, {} as Record<string, { type: Type }>);
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: schemaProperties,
                required: selectedPlatforms,
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: responseSchema,
                },
            });
            
// Fix: Cast `response.text` to string for JSON.parse to resolve type error.
            setAdaptedContent(JSON.parse(response.text as string));

        } catch (err) {
            console.error('Ошибка при адаптации контента:', err);
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Произошла ошибка: ${message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopy = (platformId: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedPlatform(platformId);
        addToast('Текст скопирован!', 'success');
        setTimeout(() => setCopiedPlatform(null), 2000);
    };
    
    const canAdapt = sourceContent.trim() !== '' && selectedPlatforms.length > 0;

    return (
        <div>
            <div style={styles.generatorLayout}>
                <div style={styles.generatorControls}>
                     <h3 style={styles.cardTitle}>Адаптер контента</h3>
                    <p style={styles.cardSubtitle}>Перепишите один пост для нескольких социальных сетей за один клик.</p>
                    
                    <div style={styles.formGroup}>
                        <label style={styles.label}>1. Выберите источник контента</label>
                        <div style={styles.adapterSourceTabs}>
                            <button 
                                style={sourceMode === 'text' ? styles.adapterSourceTabActive : styles.adapterSourceTab}
                                onClick={() => setSourceMode('text')}
                            >
                                Ввести текст
                            </button>
                             <button 
                                style={sourceMode === 'post' ? styles.adapterSourceTabActive : styles.adapterSourceTab}
                                onClick={() => setSourceMode('post')}
                            >
                                Выбрать из плана
                            </button>
                        </div>
                        {sourceMode === 'text' ? (
                            <textarea 
                                style={{...styles.textarea, minHeight: '150px'}}
                                placeholder="Вставьте сюда ваш исходный текст..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                        ) : (
                            <div style={styles.adapterPostList}>
                                {allPosts.map(post => (
                                    <div 
                                        key={post.id}
                                        style={{...styles.adapterPostItem, ...(selectedPostId === post.id ? styles.adapterPostItemActive : {})}}
                                        onClick={() => setSelectedPostId(post.id)}
                                    >
                                        <strong style={styles.planCardTitle}>{post.topic}</strong>
                                        <p style={styles.planCardDescription}>{post.description.substring(0, 100)}...</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div style={styles.formGroup}>
                         <label style={styles.label}>2. Выберите целевые платформы</label>
                         <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                            {adaptationPlatforms.map(p => (
                                <button 
                                    key={p.id}
                                    style={selectedPlatforms.includes(p.id) ? styles.aspectRatioButtonActive : styles.aspectRatioButton}
                                    onClick={() => handlePlatformToggle(p.id)}
                                >
                                   {p.icon} {p.name}
                                </button>
                            ))}
                         </div>
                    </div>
                    
                    <button 
                        style={canAdapt ? styles.button : styles.buttonDisabled}
                        disabled={!canAdapt || isLoading}
                        onClick={handleAdapt}
                    >
                        {isLoading ? 'Адаптация...' : '🔄 Адаптировать'}
                    </button>
                </div>
                <div style={styles.generatorResult}>
                    <label style={styles.label}>3. Результат</label>
                    <div style={{...styles.resultBox, padding: 0}}>
                        {isLoading && <div style={{...styles.loader, marginTop: '40px'}}></div>}
                        {error && <p style={{...styles.errorText, padding: '20px'}}>{error}</p>}
                        {!isLoading && !error && !adaptedContent && <p style={styles.placeholderText}>Здесь появятся адаптированные версии вашего контента...</p>}
                        
                        {adaptedContent && (
                            <div style={styles.adapterResultGrid}>
                                {Object.entries(adaptedContent).map(([platformId, text]) => {
                                    const platformInfo = adaptationPlatforms.find(p => p.id === platformId);
                                    return (
                                        <div key={platformId} style={styles.adapterResultCard}>
                                            <div style={styles.adapterResultHeader}>
                                                <span style={{fontSize: '1.5rem'}}>{platformInfo?.icon}</span>
                                                <h4 style={styles.adapterResultTitle}>{platformInfo?.name}</h4>
                                            </div>
                                            <p style={{whiteSpace: 'pre-wrap'}}>{text}</p>
                                            <button 
                                                style={{...styles.button, ...styles.adapterCopyButton}}
                                                onClick={() => handleCopy(platformId, text)}
                                            >
                                                {copiedPlatform === platformId ? 'Скопировано!' : 'Копировать'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Audio Helper Functions for AI Co-pilot ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

type TranscriptEntry = {
    id: number;
    speaker: 'user' | 'model';
    text: string;
    imageUrl?: string;
    promptForSave?: string;
    isSaving?: boolean;
    isSaved?: boolean;
};

const AICopilotScreen = ({ onAddPostIdea, onSaveGeneratedImage }: {
    onAddPostIdea: (idea: Omit<Post, 'id' | 'status' | 'date'>) => void;
    onSaveGeneratedImage: (data: { base64: string; name: string }) => Promise<void>;
}) => {
    const [sessionStatus, setSessionStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [error, setError] = useState('');

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
    
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    const stopSession = useCallback(() => {
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        
        for (const source of sourcesRef.current.values()) {
            source.stop();
        }
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        
        sessionPromiseRef.current?.then(session => {
            session.close();
            sessionPromiseRef.current = null;
        }).catch(e => console.error("Error closing session:", e));
    }, []);

    const handleStart = async () => {
        setSessionStatus('connecting');
        setError('');
        setTranscript([]);
        nextStartTimeRef.current = 0;

        try {
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = inputCtx;
            
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputCtx;
            const outputNode = outputCtx.createGain();
            outputNode.connect(outputCtx.destination);

            const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = userStream;
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const addPostIdeaFunctionDeclaration: FunctionDeclaration = {
                name: 'addPostIdea',
                parameters: {
                    type: Type.OBJECT,
                    description: 'Создает новую идею для поста и добавляет ее в список идей контент-плана.',
                    properties: {
                        topic: { type: Type.STRING, description: 'Основная тема или заголовок поста.' },
                        postType: { type: Type.STRING, description: 'Формат поста, например, "Пост с фото", "Видео Reels", "Статья".' },
                        description: { type: Type.STRING, description: 'Краткое описание содержания поста.' },
                    },
                    required: ['topic', 'postType', 'description'],
                },
            };

            const generateImageFunctionDeclaration: FunctionDeclaration = {
                name: 'generateImage',
                parameters: {
                    type: Type.OBJECT,
                    description: 'Генерирует изображение на основе текстового описания.',
                    properties: {
                        prompt: { type: Type.STRING, description: 'Подробное описание изображения для генерации.' },
                    },
                    required: ['prompt'],
                },
            };
            
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: 'You are a friendly and expert SMM assistant co-pilot. You can brainstorm ideas, suggest strategies, and help draft content. Use the provided tools to help the user. Keep your answers concise and helpful.',
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations: [addPostIdeaFunctionDeclaration, generateImageFunctionDeclaration] }],
                },
                callbacks: {
                    onopen: () => {
                        setSessionStatus('active');
                        const source = inputCtx.createMediaStreamSource(userStream);
                        mediaStreamSourceRef.current = source;
                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob: GenAIBlob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(f => f * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscriptionRef.current.trim();
                            const fullOutput = currentOutputTranscriptionRef.current.trim();
                            
                            setTranscript(prev => {
                                const newTranscript = [...prev];
                                if (fullInput) newTranscript.push({ id: Date.now() + 1, speaker: 'user', text: fullInput });
                                if (fullOutput) newTranscript.push({ id: Date.now() + 2, speaker: 'model', text: fullOutput });
                                return newTranscript;
                            });
                            
                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                         if (message.toolCall) {
                            (async () => {
                                for (const fc of message.toolCall.functionCalls) {
                                    let toolResult: any = { status: 'success' };
                                    let functionOutputText = '';

                                    try {
                                        switch (fc.name) {
                                            case 'addPostIdea':
                                                const topic = String(fc.args.topic);
                                                const postType = String(fc.args.postType);
                                                const description = String(fc.args.description);
                                                onAddPostIdea({ topic, postType, description });
                                                functionOutputText = `Идея для поста "${topic}" была успешно добавлена в ваш контент-план.`;
                                                break;
                                            case 'generateImage':
                                                const prompt = String(fc.args.prompt);
                                                const generatingMessageId = Date.now();
                                                setTranscript(prev => [...prev, { id: generatingMessageId, speaker: 'model', text: `🎨 Генерирую изображение по вашему запросу: "${prompt}"...` }]);

                                                const imageGenAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
                                                const response = await imageGenAI.models.generateImages({
                                                    model: 'imagen-4.0-generate-001',
                                                    prompt: prompt,
                                                    config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
                                                });
                                                
                                                if (!response.generatedImages || response.generatedImages.length === 0) {
                                                    throw new Error('API не вернуло изображение.');
                                                }

                                                const base64ImageBytes = response.generatedImages[0].image.imageBytes;
                                                const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                                                
                                                setTranscript(prev => [
                                                    ...prev.filter(e => e.id !== generatingMessageId), 
                                                    { id: Date.now(), speaker: 'model', text: 'Вот что у меня получилось:', imageUrl, promptForSave: prompt }
                                                ]);
                                                
                                                functionOutputText = `Изображение по запросу "${prompt}" успешно создано.`;
                                                break;
                                        }
                                        toolResult.result = functionOutputText;
                                    } catch (e) {
                                        const errorMessage = e instanceof Error ? e.message : 'Unknown error during function call';
                                        toolResult = { error: `Function call failed: ${errorMessage}` };
                                        setError(`Ошибка выполнения команды: ${errorMessage}`);
                                    }

                                    sessionPromiseRef.current?.then((session) => {
                                        session.sendToolResponse({
                                            functionResponses: { id: fc.id, name: fc.name, response: toolResult }
                                        });
                                    });
                                }
                            })();
                        }
                        
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio) {
                            const nextStartTime = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                            
                            const source = outputCtx.createBufferSource();
                            sourcesRef.current.add(source);
                            source.buffer = audioBuffer;
                            source.connect(outputNode);
                            source.addEventListener('ended', () => { sourcesRef.current.delete(source); });
                            source.start(nextStartTime);
                            nextStartTimeRef.current = nextStartTime + audioBuffer.duration;
                        }

                        if (message.serverContent?.interrupted) {
                            for (const source of sourcesRef.current.values()) {
                                source.stop();
                                sourcesRef.current.delete(source);
                            }
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onclose: () => { setSessionStatus('idle'); },
                    // Fix: Use the correct ErrorEvent type for the onerror callback parameter and simplify the error handling logic.
// The `onerror` callback can receive various error types. Changing the parameter to `any` and using optional chaining makes the handler more robust.
                    onerror: (err: any) => {
                        const message = err?.message || 'Произошла неизвестная ошибка.';
                        setError(`Произошла ошибка сессии: ${message}`);
                        setSessionStatus('error');
                    },
                }
            });
        } catch (err) {
            const message = (err instanceof Error && err.message) || 'Неизвестная ошибка';
            setError(`Не удалось начать сессию: ${message}. Убедитесь, что вы предоставили доступ к микрофону.`);
            setSessionStatus('error');
            stopSession();
        }
    };
    
    const handleStop = () => {
        stopSession();
        setSessionStatus('idle');
    };

    const handleSaveImage = async (entry: TranscriptEntry) => {
        if (!entry.imageUrl || !entry.promptForSave) return;
        
        setTranscript(prev => prev.map(e => e.id === entry.id ? { ...e, isSaving: true } : e));
        
        try {
            const base64Data = entry.imageUrl.split(',')[1];
            await onSaveGeneratedImage({ base64: base64Data, name: `${entry.promptForSave.substring(0, 30)}.jpg` });
            setTranscript(prev => prev.map(e => e.id === entry.id ? { ...e, isSaving: false, isSaved: true } : e));
        } catch (error) {
            console.error("Failed to save image from copilot:", error);
            setError("Не удалось сохранить изображение.");
             setTranscript(prev => prev.map(e => e.id === entry.id ? { ...e, isSaving: false } : e));
        }
    };

    useEffect(() => {
        return () => {
            if (sessionStatus !== 'idle') stopSession();
        };
    }, [sessionStatus, stopSession]);

    const getStatusInfo = () => {
        switch (sessionStatus) {
            case 'idle': return { text: 'Готов к работе. Нажмите "Начать", чтобы поговорить.', icon: '🎙️', buttonText: 'Начать', buttonAction: handleStart, visualizerClass: {} };
            case 'connecting': return { text: 'Подключение...', icon: '⌛', buttonText: 'Подключение...', buttonAction: () => {}, visualizerClass: {} };
            case 'active': return { text: 'Слушаю... Говорите в микрофон.', icon: '🎧', buttonText: 'Завершить', buttonAction: handleStop, visualizerClass: copilotStyles.visualizerActive };
            case 'error': return { text: error, icon: '⚠️', buttonText: 'Попробовать снова', buttonAction: handleStart, visualizerClass: {} };
            default: return { text: '', icon: '🎙️', buttonText: 'Начать', buttonAction: handleStart, visualizerClass: {} };
        }
    };

    const { text, icon, buttonText, buttonAction, visualizerClass } = getStatusInfo();
    
    return (
        <div style={copilotStyles.container}>
            <div style={{ ...copilotStyles.visualizer, ...visualizerClass }}>{icon}</div>
            
            <div style={copilotStyles.transcriptContainer} className="copilot-transcript-container">
                {transcript.length === 0 && <p style={styles.placeholderText}>Здесь появится расшифровка вашего диалога...<br/><br/>Попробуйте сказать: "Создай идею для поста про скидки на пальто" или "Сгенерируй изображение кота-астронавта".</p>}
                {transcript.map((entry) => (
                    <div 
                        key={entry.id} 
                        style={{...copilotStyles.transcriptEntry, ...(entry.speaker === 'user' ? copilotStyles.transcriptUser : copilotStyles.transcriptModel)}}
                    >
                       <strong>{entry.speaker === 'user' ? 'Вы:' : 'AI:'}</strong> {entry.text}
                       {entry.imageUrl && (
                         <div style={{ marginTop: '10px', position: 'relative' }}>
                            <img src={entry.imageUrl} style={{ maxWidth: '100%', borderRadius: '8px' }} alt={entry.promptForSave} />
                            {!entry.isSaved && (
                                <button
                                    onClick={() => handleSaveImage(entry)}
                                    disabled={entry.isSaving}
                                    style={{...styles.button, position: 'absolute', bottom: '10px', right: '10px', padding: '6px 12px', fontSize: '0.9rem'}}
                                >
                                    {entry.isSaving ? 'Сохранение...' : '💾 Сохранить в Базу'}
                                </button>
                            )}
                         </div>
                       )}
                    </div>
                ))}
                <div ref={transcriptEndRef} />
            </div>

            <div style={copilotStyles.controls}>
                <p style={copilotStyles.statusText}>{text}</p>
                 <button 
                    style={{...copilotStyles.copilotButton, ...(sessionStatus === 'active' && copilotStyles.copilotButtonStop)}} 
                    onClick={buttonAction}
                    disabled={sessionStatus === 'connecting'}
                >
                    {buttonText}
                </button>
            </div>
        </div>
    );
};

const AICopilotModal = ({ onClose, onAddPostIdea, onSaveGeneratedImage }: {
    onClose: () => void;
    onAddPostIdea: (idea: Omit<Post, 'id' | 'status' | 'date'>) => void;
    onSaveGeneratedImage: (data: { base64: string; name: string }) => Promise<void>;
}) => {
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={{...styles.modalContent, width: '90%', maxWidth: '800px', height: '80vh'}} onClick={(e) => e.stopPropagation()}>
                 <button style={styles.modalCloseButton} onClick={onClose}>&times;</button>
                 <div style={styles.modalHeader}>
                    <h2 style={styles.cardTitle}>AI Co-pilot</h2>
                 </div>
                 <div style={{...styles.modalBody, flex: 1, padding: '0'}}>
                    <AICopilotScreen onAddPostIdea={onAddPostIdea} onSaveGeneratedImage={onSaveGeneratedImage} />
                 </div>
            </div>
        </div>
    );
};

const generateMockAnalytics = (range: string) => {
    const randomFactor = range === '7d' ? 0.25 : range === '30d' ? 1 : 0.9;
    const plusOrMinus = () => (Math.random() > 0.5 ? 1 : -1);
    
    const keyMetrics = {
        subscribers: { title: 'Подписчики', value: (10254 * randomFactor).toLocaleString('ru-RU', {maximumFractionDigits: 0}), change: `${(Math.random() * 2).toFixed(1)}%`, isPositive: Math.random() > 0.3 },
        reach: { title: 'Охват', value: (123456 * randomFactor).toLocaleString('ru-RU', {maximumFractionDigits: 0}), change: `${(Math.random() * 8).toFixed(1)}%`, isPositive: true },
        engagement: { title: 'Вовлеченность', value: `${(6.8 + plusOrMinus() * Math.random()).toFixed(1)}%`, change: `${(Math.random() * 0.5).toFixed(1)}%`, isPositive: Math.random() > 0.5 },
        publications: { title: 'Публикации', value: Math.round(15 * randomFactor).toString(), change: `+${Math.round(2 * randomFactor)}`, isPositive: true },
    };

    const topPosts = [
        { id: 1, platformId: 'instagram', topic: 'Закулисье фотосессии...', metric: `❤️ ${(1203 * randomFactor).toFixed(0)}` },
        { id: 2, platformId: 'vk', topic: 'Розыгрыш сертификата', metric: `👁️ ${(15.4 * randomFactor).toFixed(1)}k` },
        { id: 3, platformId: 'telegram', topic: 'Как выбрать идеальное пальто?', metric: `💬 ${(287 * randomFactor).toFixed(0)}` },
        { id: 4, platformId: 'dzen', topic: '5 способов носить шарф', metric: `👍 ${(890 * randomFactor).toFixed(0)}` },
    ].sort(() => Math.random() - 0.5); // Shuffle posts

    let remainingPercent = 100;
    const randomTraffic = (base: number) => {
        const value = Math.round(base + (Math.random() * 10 - 5));
        remainingPercent -= value;
        return value;
    }
    const insta = randomTraffic(45);
    const vk = randomTraffic(30);
    const tg = randomTraffic(15);
    
    const trafficSources = [
        { source: 'Instagram', value: insta, color: '#833ab4' },
        { source: 'ВКонтакте', value: vk, color: '#4680c2' },
        { source: 'Telegram', value: tg, color: '#0088cc' },
        { source: 'Прочее', value: remainingPercent, color: '#cccccc' },
    ];
    
    return { keyMetrics, topPosts, trafficSources };
}

type DateRange = '7d' | '30d' | 'month';

type CompetitorAnalysisResult = {
    competitors: {
        url: string;
        strengths: string[];
        weaknesses: string[];
        content_themes: string[];
    }[];
    recommendations: string[];
};

const CompetitorAnalysis = () => {
    const [urls, setUrls] = useState(['', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<CompetitorAnalysisResult | null>(null);

    const handleUrlChange = (index: number, value: string) => {
        const newUrls = [...urls];
        newUrls[index] = value;
        setUrls(newUrls);
    };

    const handleAnalyze = async () => {
        const validUrls = urls.filter(url => url.trim() !== '');
        if (validUrls.length === 0) {
            setError('Пожалуйста, введите хотя бы один URL для анализа.');
            return;
        }

        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
                Ты — ведущий SMM-стратег. Проведи глубокий анализ социальных сетей конкурентов.
                Вот список их профилей: ${validUrls.join(', ')}.

                Твоя задача — предоставить структурированный отчет. Для каждого конкурента определи:
                - Сильные стороны (что они делают хорошо).
                - Слабые стороны (где они могут улучшиться).
                - Ключевые темы и форматы контента.

                В конце, дай 3-5 конкретных, действенных рекомендаций для МОЕГО бренда, чтобы выделиться и превзойти этих конкурентов.

                Верни ответ СТРОГО в формате JSON.
            `;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    competitors: {
                        type: Type.ARRAY,
                        description: "Анализ по каждому конкуренту.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                url: { type: Type.STRING, description: "URL конкурента." },
                                strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Список сильных сторон." },
                                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Список слабых сторон." },
                                content_themes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Основные темы контента." },
                            },
                             required: ["url", "strengths", "weaknesses", "content_themes"],
                        }
                    },
                    recommendations: {
                        type: Type.ARRAY,
                        description: "Рекомендации для бренда пользователя.",
                        items: { type: Type.STRING }
                    }
                },
                required: ["competitors", "recommendations"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });
            
// Fix: Explicitly cast the result of JSON.parse to CompetitorAnalysisResult.
// The parsed object was being inferred as 'unknown', which is not assignable to the component's state type.
// Fix: Cast `response.text` to string for JSON.parse to resolve type error.
            const parsedResult = JSON.parse(response.text as string) as CompetitorAnalysisResult;
            setResult(parsedResult);

        } catch (err) {
            console.error('Ошибка при анализе конкурентов:', err);
            const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
            setError(`Произошла ошибка: ${message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div style={analyticsStyles.competitorAnalysisContainer}>
            <div style={analyticsStyles.competitorForm}>
                <h3 style={styles.cardTitle}>Анализ конкурентов</h3>
                <p style={styles.cardSubtitle}>Введите до 3 ссылок на профили ваших конкурентов в социальных сетех, чтобы получить AI-анализ и рекомендации.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {urls.map((url, index) => (
                        <input
                            key={index}
                            type="url"
                            style={styles.input}
                            placeholder={`https://... (${index + 1})`}
                            value={url}
                            onChange={(e) => handleUrlChange(index, e.target.value)}
                        />
                    ))}
                </div>
                <button
                    style={isLoading ? styles.buttonDisabled : styles.button}
                    onClick={handleAnalyze}
                    disabled={isLoading}
                >
                    {isLoading ? 'Анализ...' : '🔬 Анализировать'}
                </button>
            </div>

            {isLoading && <div style={styles.loader}></div>}
            {error && <p style={styles.errorText}>{error}</p>}

            {result && (
                <div style={analyticsStyles.competitorResults}>
                    <h3 style={{...styles.screenTitle, fontSize: '1.5rem'}}>Результаты анализа</h3>
                    {result.competitors.map((comp, index) => (
                        <div key={index} style={analyticsStyles.competitorCard}>
                            <h4 style={analyticsStyles.analysisTitle}>Анализ: <a href={comp.url} target="_blank" rel="noopener noreferrer">{comp.url}</a></h4>
                            <strong>Сильные стороны:</strong>
                            <ul style={analyticsStyles.analysisList}>
                                {comp.strengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                            <br/>
                            <strong>Слабые стороны:</strong>
                             <ul style={analyticsStyles.analysisList}>
                                {comp.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                            <br/>
                            <strong>Ключевые темы:</strong>
                             <ul style={analyticsStyles.analysisList}>
                                {comp.content_themes.map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                        </div>
                    ))}
                    <div style={analyticsStyles.recommendationCard}>
                         <h4 style={analyticsStyles.analysisTitle}>💡 Ваши рекомендации</h4>
                         <ul style={analyticsStyles.analysisList}>
                            {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};


const AnalyticsScreen = () => {
    const [activeRange, setActiveRange] = useState<DateRange>('30d');
    const [data, setData] = useState(generateMockAnalytics('30d'));
    const [activeTab, setActiveTab] = useState<'overview' | 'competitors'>('overview');
    
    useEffect(() => {
        if (activeTab === 'overview') {
            setData(generateMockAnalytics(activeRange));
        }
    }, [activeRange, activeTab]);

    const conicGradient = data.trafficSources.reduce((acc, source, index) => {
        const prevPercent = data.trafficSources.slice(0, index).reduce((sum, s) => sum + s.value, 0);
        const currentPercent = prevPercent + source.value;
        return `${acc}, ${source.color} ${prevPercent}% ${currentPercent}%`;
    }, '');

    return (
        <div style={analyticsStyles.container} className="analyticsLayout">
            <div style={analyticsStyles.header}>
                 <h2 style={styles.screenTitle}>Аналитика</h2>
                 {activeTab === 'overview' && (
                    <div style={analyticsStyles.dateRangePicker}>
                        {(['7d', '30d', 'month'] as DateRange[]).map(range => (
                            <button 
                                key={range}
                                style={activeRange === range ? analyticsStyles.dateRangeButtonActive : analyticsStyles.dateRangeButton}
                                onClick={() => setActiveRange(range)}
                            >
                                {range === '7d' && '7 дней'}
                                {range === '30d' && '30 дней'}
                                {range === 'month' && 'Этот месяц'}
                            </button>
                        ))}
                    </div>
                 )}
            </div>
            
             <div style={{...styles.authTabs, marginBottom: '24px'}}>
                <button
                  style={activeTab === 'overview' ? styles.authTabActive : styles.authTab}
                  onClick={() => setActiveTab('overview')}
                >
                  Обзор
                </button>
                <button
                  style={activeTab === 'competitors' ? styles.authTabActive : styles.authTab}
                  onClick={() => setActiveTab('competitors')}
                >
                  Анализ конкурентов
                </button>
            </div>

            {activeTab === 'overview' ? (
                <>
                    <div style={analyticsStyles.keyMetricsGrid}>
                        {Object.values(data.keyMetrics).map(metric => (
                            <div key={metric.title} style={analyticsStyles.metricCard}>
                                <p style={analyticsStyles.metricTitle}>{metric.title}</p>
                                <h3 style={analyticsStyles.metricValue}>{metric.value}</h3>
                                <p style={{
                                    ...analyticsStyles.metricChange,
                                    color: metric.isPositive ? '#28a745' : '#dc3545'
                                }}>
                                    {metric.isPositive ? '▲' : '▼'} {metric.change}
                                </p>
                            </div>
                        ))}
                    </div>
                    
                    <div style={analyticsStyles.mainGrid}>
                        <div style={{...styles.card, ...analyticsStyles.largeCard, gridArea: 'chart'}}>
                            <h3 style={analyticsStyles.cardTitle}>Динамика роста подписчиков</h3>
                            <div style={analyticsStyles.chartContainer}>
                                 <svg width="100%" height="100%" viewBox="0 0 500 150" preserveAspectRatio="none" style={{overflow: 'visible'}}>
                                    <defs>
                                        <linearGradient id="lineChartGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#007bff" stopOpacity="0.4"/>
                                        <stop offset="100%" stopColor="#007bff" stopOpacity="0"/>
                                        </linearGradient>
                                    </defs>
                                    <path d="M 0 120 C 50 80, 100 130, 150 100 C 200 70, 250 110, 300 90 C 350 70, 400 50, 450 60 L 500 40" stroke="#007bff" fill="none" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
                                    <path d="M 0 120 C 50 80, 100 130, 150 100 C 200 70, 250 110, 300 90 C 350 70, 400 50, 450 60 L 500 40 L 500 150 L 0 150 Z" fill="url(#lineChartGradient)" stroke="none"/>
                                </svg>
                            </div>
                        </div>
                        
                        <div style={{...styles.card, gridArea: 'posts'}}>
                            <h3 style={analyticsStyles.cardTitle}>Лучшие публикации</h3>
                            <div style={analyticsStyles.postList}>
                                {data.topPosts.map(post => {
                                   const platform = socialPlatforms.find(p => p.id === post.platformId);
                                   return (
                                     <div key={post.id} style={analyticsStyles.postItem}>
                                        <img src={platform?.icon} alt={platform?.name} style={analyticsStyles.postPlatformIcon} />
                                        <span style={analyticsStyles.postTopic}>{post.topic}</span>
                                        <span style={analyticsStyles.postMetric}>{post.metric}</span>
                                     </div>
                                   )
                                })}
                            </div>
                        </div>

                        <div style={{...styles.card, gridArea: 'traffic'}}>
                            <h3 style={analyticsStyles.cardTitle}>Источники трафика</h3>
                            <div style={analyticsStyles.doughnutLayout}>
                               <div style={{...analyticsStyles.doughnutChart, background: `conic-gradient(from 0deg ${conicGradient})`}}></div>
                               <div style={analyticsStyles.doughnutLegend}>
                                   {data.trafficSources.map(source => (
                                       <div key={source.source} style={analyticsStyles.legendItem}>
                                           <span style={{...analyticsStyles.legendMarker, backgroundColor: source.color}}></span>
                                           <span>{source.source}</span>
                                           <span style={analyticsStyles.legendValue}>{source.value}%</span>
                                       </div>
                                   ))}
                               </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <CompetitorAnalysis />
            )}
        </div>
    );
};

interface Comment {
    id: number;
    text: string;
    isGeneratingReplies?: boolean;
    replies?: string[];
}

interface BrandComplianceResult {
    score: number;
    feedback: string;
}

const PostDetailsDrawer = ({ post, onClose, onSave, onDelete, brandContextPrompt, addToast }: {
    post: Post;
    onClose: () => void;
    onSave: (updatedPost: Post) => void;
    onDelete: (postId: number) => void;
    brandContextPrompt: string;
    addToast: (message: string, type: 'success' | 'error') => void;
}) => {
    const [editedPost, setEditedPost] = useState(post);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');
    const [comments, setComments] = useState<Comment[]>([]);
    const [isGeneratingComments, setIsGeneratingComments] = useState(false);
    const [complianceResult, setComplianceResult] = useState<BrandComplianceResult | null>(null);
    const [isCheckingCompliance, setIsCheckingCompliance] = useState(false);

    useEffect(() => {
        setEditedPost(post);
        setComplianceResult(null); // Reset on new post
    }, [post]);

    const handleFieldChange = (field: keyof Post, value: string) => {
        setEditedPost(prev => ({ ...prev, [field]: value }));
    };

    const handleStatusChange = (status: Post['status']) => {
        setEditedPost(prev => ({ ...prev, status }));
    };

    const handleGenerateContent = async () => {
        setIsGenerating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const textPrompt = `Ты — профессиональный SMM-менеджер. Напиши яркий и вовлекающий пост для социальных сетей на русском языке.
                          \n\nТема: "${editedPost.topic}"
                          \nОписание: "${editedPost.description}"
                          \n\n${brandContextPrompt}
                          \n\nТвой пост должен быть структурированным, содержать призыв к действию и релевантные хэштеги.`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: textPrompt,
            });
            
            setEditedPost(prev => ({ ...prev, content: response.text }));
        } catch (error) {
            console.error("Ошибка при генерации контента в модальном окне:", error);
            setEditedPost(prev => ({ ...prev, content: "Не удалось сгенерировать контент. Попробуйте снова." }));
        } finally {
            setIsGenerating(false);
        }
    };
    
     const handleCheckBrandCompliance = async () => {
        if (!editedPost.content) {
            addToast('Сначала сгенерируйте или напишите контент для проверки.', 'error');
            return;
        }
        setIsCheckingCompliance(true);
        setComplianceResult(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Ты — AI Brand Guardian. Твоя задача — оценить, насколько текст поста соответствует гайдлайнам бренда.
            
            **Гайдлайны бренда:**
            ${brandContextPrompt}

            **Текст поста для анализа:**
            "${editedPost.content}"

            **Твоя задача:**
            1.  Оцени соответствие текста гайдлайнам по шкале от 1 до 100.
            2.  Дай краткий, но конструктивный фидбэк (2-3 пункта), что можно улучшить.

            Верни ответ СТРОГО в формате JSON.`;

            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER, description: "Оценка от 1 до 100" },
                    feedback: { type: Type.STRING, description: "Конструктивная обратная связь и предложения по улучшению." }
                },
                required: ["score", "feedback"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });

            const parsedResult = JSON.parse(response.text as string) as BrandComplianceResult;
            setComplianceResult(parsedResult);

        } catch (error) {
            addToast('Не удалось выполнить проверку на соответствие бренду.', 'error');
        } finally {
            setIsCheckingCompliance(false);
        }
    };

    const handleGenerateComments = async () => {
        if (!editedPost.content) return;
        setIsGeneratingComments(true);
        setComments([]);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Проанализируй следующий пост и сгенерируй 5-7 реалистичных комментариев от лица разных пользователей (вопросы, похвала, конструктивная критика). Верни результат в формате JSON-массива строк.
            
            **Пост:**
            ${editedPost.content}`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            });
// Fix: Cast `response.text` to string for JSON.parse to resolve "Argument of type 'unknown' is not assignable" error.
            const parsedComments: string[] = JSON.parse(response.text as string);
            setComments(parsedComments.map((text, i) => ({ id: i, text })));
        } catch (error) {
             addToast('Не удалось смоделировать комментарии.', 'error');
        } finally {
            setIsGeneratingComments(false);
        }
    };

    const handleGenerateReplies = async (commentId: number, commentText: string) => {
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, isGeneratingReplies: true, replies: [] } : c));
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Ты — SMM-менеджер. Тебе нужно предложить 3 варианта ответа на комментарий пользователя. Ответы должны быть вежливыми, полезными и соответствовать тону бренда.
            
            **Гайдлайны по стилю бренда:**
            ${brandContextPrompt}
            **Пост, к которому оставлен комментарий:** ${editedPost.content}
            **Комментарий пользователя:** "${commentText}"
            
            Верни результат в формате JSON-массива из 3 строк.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                 config: {
                    responseMimeType: "application/json",
                    responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            });
// Fix: Cast `response.text` to string for JSON.parse to resolve type error.
            const parsedReplies: string[] = JSON.parse(response.text as string);
             setComments(prev => prev.map(c => c.id === commentId ? { ...c, isGeneratingReplies: false, replies: parsedReplies } : c));
        } catch (error) {
            addToast('Не удалось сгенерировать ответы.', 'error');
            setComments(prev => prev.map(c => c.id === commentId ? { ...c, isGeneratingReplies: false } : c));
        }
    };
    
    const handleCopyReply = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast('Ответ скопирован в буфер обмена!', 'success');
    };

    const statusOptions: Post['status'][] = ['idea', 'scheduled', 'published'];
    const statusText: Record<Post['status'], string> = {
        idea: 'Идея',
        scheduled: 'Запланировано',
        published: 'Опубликовано',
    };
    
    const statusColor: Record<Post['status'], { bg: string, text: string, border: string }> = {
        idea: { bg: '#e9ecef', text: '#495057', border: '#ced4da' },
        scheduled: { bg: '#e7f1ff', text: '#004085', border: '#007bff' },
        published: { bg: '#d4edda', text: '#155724', border: '#28a745' },
    };


    return (
        <div style={styles.drawerOverlay} onClick={onClose}>
            <div style={{...styles.drawerContent, padding: '32px'}} onClick={(e) => e.stopPropagation()}>
                <button style={styles.modalCloseButton} onClick={onClose}>&times;</button>
                <div style={styles.modalHeader}>
                    <input 
                        type="text"
                        value={editedPost.topic}
                        onChange={(e) => handleFieldChange('topic', e.target.value)}
                        style={{...styles.input, fontSize: '1.5rem', fontWeight: 600, border: 'none', padding: '0 0 4px 0'}}
                    />
                </div>
                
                 <div style={styles.modalTabs}>
                    <button style={activeTab === 'details' ? styles.modalTabActive : styles.modalTab} onClick={() => setActiveTab('details')}>Детали поста</button>
                    <button style={activeTab === 'comments' ? styles.modalTabActive : styles.modalTab} onClick={() => setActiveTab('comments')}>Комментарии</button>
                </div>

                <div style={{...styles.modalBody, flex: 1}}>
                    {activeTab === 'details' ? (
                        <>
                             <div style={styles.formGroup}>
                                <label style={styles.label}>Статус</label>
                                <div style={styles.statusSelector}>
                                    {statusOptions.map(status => {
                                        const isActive = editedPost.status === status;
                                        const activeStyle = isActive ? { 
                                            backgroundColor: statusColor[status].bg, 
                                            color: statusColor[status].text,
                                            borderColor: statusColor[status].border,
                                            fontWeight: 600,
                                        } : {};
                                        return (
                                            <button 
                                                key={status}
                                                style={{...styles.statusButton, ...activeStyle}}
                                                onClick={() => handleStatusChange(status)}
                                            >
                                                {statusText[status]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                             <div style={styles.formGroup}>
                                <label style={styles.label} htmlFor="postDate">Дата публикации</label>
                                <input
                                    type="date"
                                    id="postDate"
                                    style={styles.input}
                                    value={editedPost.date || ''}
                                    onChange={(e) => handleFieldChange('date', e.target.value)}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label} htmlFor="postDescription">Описание / Заметки</label>
                                <textarea
                                    id="postDescription"
                                    style={styles.textarea}
                                    value={editedPost.description}
                                    onChange={(e) => handleFieldChange('description', e.target.value)}
                                />
                            </div>
                            <div style={{...styles.formGroup, flex: 1, display: 'flex', flexDirection: 'column'}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                                     <label style={styles.label}>Сгенерированный контент</label>
                                     <button onClick={handleCheckBrandCompliance} disabled={isCheckingCompliance || !editedPost.content} style={{...styles.button, padding: '6px 12px', fontSize: '0.9rem', background: '#6c757d'}}>
                                        {isCheckingCompliance ? '...' : '🛡️ Проверить'}
                                    </button>
                                </div>
                                <div style={{...styles.resultBox, flex: 1}}>
                                    {isGenerating && <div style={styles.loader}></div>}
                                    {!isGenerating && !editedPost.content && <p style={styles.placeholderText}>Контент еще не сгенерирован.</p>}
                                    {!isGenerating && editedPost.content && <p style={{whiteSpace: 'pre-wrap'}}>{editedPost.content}</p>}
                                </div>
                                {complianceResult && (
                                     <div style={{marginTop: '12px', padding: '12px', borderRadius: '8px', border: `1px solid ${complianceResult.score > 75 ? '#28a745' : complianceResult.score > 50 ? '#ffc107' : '#dc3545'}`}}>
                                        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                            <strong style={{fontSize: '1.2rem'}}>Оценка: {complianceResult.score}/100</strong>
                                        </div>
                                        <p style={{marginTop: '8px', fontSize: '0.9rem', whiteSpace: 'pre-wrap'}}>{complianceResult.feedback}</p>
                                     </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={styles.commentSection}>
                             <button style={isGeneratingComments ? styles.buttonDisabled : styles.button} disabled={!editedPost.content || isGeneratingComments} onClick={handleGenerateComments}>
                                {isGeneratingComments ? 'Моделирование...' : '🤖 Смоделировать комментарии'}
                            </button>
                            {comments.length === 0 && !isGeneratingComments && <p style={styles.placeholderText}>Смоделируйте комментарии, чтобы увидеть здесь примеры и сгенерировать ответы.</p>}

                            <div style={styles.commentList}>
                                {comments.map(comment => (
                                    <div key={comment.id} style={styles.commentItem}>
                                        <p style={styles.commentText}>"{comment.text}"</p>
                                        <button style={{...styles.button, ...styles.replyButton}} disabled={comment.isGeneratingReplies} onClick={() => handleGenerateReplies(comment.id, comment.text)}>
                                            {comment.isGeneratingReplies ? <div style={{...styles.miniLoader, borderTopColor: '#004085', border: '3px solid rgba(0, 64, 133, 0.3)'}}></div> : '💡'} Ответить с AI
                                        </button>
                                        {comment.replies && (
                                            <div style={styles.replyOptionsContainer}>
                                                {comment.replies.map((reply, i) => (
                                                    <button key={i} style={styles.replyOptionButton} onClick={() => handleCopyReply(reply)}>
                                                        {reply}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div style={styles.modalFooter}>
                    <button style={styles.deleteButtonFooter} onClick={() => onDelete(post.id)}>Удалить пост</button>
                    <div>
                         {activeTab === 'details' && (
                             <button 
                                style={isGenerating ? styles.buttonDisabled : styles.button}
                                onClick={handleGenerateContent}
                                disabled={isGenerating}
                             >
                                {isGenerating ? 'Генерация...' : '✨ Сгенерировать'}
                             </button>
                         )}
                         <button style={{...styles.button, marginLeft: '12px'}} onClick={() => onSave(editedPost)}>Сохранить</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const QuickCreatePostModal = ({ date, onClose, onSchedule, brandContextPrompt, addToast }: {
    date: string;
    onClose: () => void;
    onSchedule: (newPost: Omit<Post, 'id' | 'status'>) => void;
    brandContextPrompt: string;
    addToast: (message: string, type: 'success' | 'error') => void;
}) => {
    const [topic, setTopic] = useState('');
    const [content, setContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateContent = async () => {
        if (!topic) return;
        setIsGenerating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const textPrompt = `Ты — профессиональный SMM-менеджер. Напиши яркий и вовлекающий пост для социальных сетей на русском языке на тему "${topic}".\n\n${brandContextPrompt}`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: textPrompt,
            });
            
            setContent(response.text);
            addToast('Текст успешно сгенерирован!', 'success');
        } catch (error) {
            console.error("Ошибка при генерации контента:", error);
            setContent("Не удалось сгенерировать контент. Попробуйте снова.");
            addToast('Ошибка генерации текста.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSchedulePost = () => {
        if (!topic || !content) return;
        onSchedule({
            topic,
            content,
            postType: 'Пост',
            description: content.substring(0, 100) + '...',
            date,
        });
        onClose();
    };
    
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={{...styles.modalContent, maxWidth: '600px'}} onClick={(e) => e.stopPropagation()}>
                <button style={styles.modalCloseButton} onClick={onClose}>&times;</button>
                <div style={styles.modalHeader}>
                    <h2 style={styles.cardTitle}>Новый пост на {new Date(date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h2>
                </div>
                <div style={styles.modalBody}>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="quick-topic">Тема</label>
                        <input
                            id="quick-topic"
                            type="text"
                            style={styles.input}
                            placeholder="О чем будет пост?"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="quick-content">Текст поста</label>
                        <textarea
                            id="quick-content"
                            style={{...styles.textarea, minHeight: '200px'}}
                            placeholder="Напишите текст или сгенерируйте его с помощью AI"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleGenerateContent}
                        disabled={!topic || isGenerating}
                        style={!topic || isGenerating ? styles.buttonDisabled : {...styles.button, background: '#6c757d'}}
                    >
                         {isGenerating ? 'Генерация...' : '✨ Сгенерировать текст по теме'}
                    </button>
                </div>
                 <div style={{...styles.modalFooter, justifyContent: 'flex-end'}}>
                     <button
                        onClick={handleSchedulePost}
                        disabled={!topic || !content}
                        style={!topic || !content ? styles.buttonDisabled : styles.button}
                     >
                         Запланировать
                     </button>
                </div>
            </div>
        </div>
    );
};


const ContentPlanScreen = ({ allPosts, setAllPosts, brandContextPrompt, onOpenCampaignWizard, addToast }: {
    allPosts: Post[],
    setAllPosts: React.Dispatch<React.SetStateAction<Post[]>>,
    brandContextPrompt: string;
    onOpenCampaignWizard: () => void;
    addToast: (message: string, type: 'success' | 'error') => void;
}) => {
    const [currentDate, setCurrentDate] = useState(new Date(2025, 10, 1)); // November 2025
    const [draggedPostId, setDraggedPostId] = useState<number | null>(null);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    const [quickCreateDate, setQuickCreateDate] = useState<string | null>(null);

    const unscheduledPosts = useMemo(() => allPosts.filter(p => p.status === 'idea'), [allPosts]);

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, postId: number) => {
        setDraggedPostId(postId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, date: string) => {
        e.preventDefault();
        setDragOverDate(date);
    };
    
    const handleDragLeave = () => {
        setDragOverDate(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, date: string) => {
        e.preventDefault();
        if (draggedPostId) {
            setAllPosts(prevPosts =>
                prevPosts.map(p =>
                    p.id === draggedPostId
                        ? { ...p, status: 'scheduled', date: date }
                        : p
                )
            );
            setDraggedPostId(null);
        }
        setDragOverDate(null);
    };

    const handleSelectPost = (post: Post) => {
        setSelectedPost(post);
        setIsDrawerOpen(true);
    };
    
    const handleSavePost = (updatedPost: Post) => {
        setAllPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
        setIsDrawerOpen(false);
        addToast("Пост успешно сохранен!", 'success');
    };

    const handleDeletePost = (postId: number) => {
        setAllPosts(prev => prev.filter(p => p.id !== postId));
        setIsDrawerOpen(false);
        addToast("Пост удален.", 'success');
    };
    
    const handleScheduleQuickPost = (newPost: Omit<Post, 'id' | 'status'>) => {
        const fullPost: Post = {
            ...newPost,
            id: Date.now(),
            status: 'scheduled',
        };
        setAllPosts(prev => [...prev, fullPost]);
        addToast(`Пост "${newPost.topic}" запланирован!`, 'success');
    };

    const monthName = currentDate.toLocaleString('ru-RU', { month: 'long' });
    const year = currentDate.getFullYear();
    const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay(); // 0=Sun, 1=Mon
    const startDayOffset = (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1); // Make Monday the first day
    
    const calendarDays = Array.from({ length: startDayOffset + daysInMonth }, (_, i) => {
        if (i < startDayOffset) return null; // Empty days at the start
        const day = i - startDayOffset + 1;
        const date = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const postsForDay = allPosts.filter(p => p.date === date && p.status !== 'idea');
        return { day, date, posts: postsForDay };
    });

    return (
        <div style={{height: '100%'}}>
            <div style={styles.contentPlanLayout}>
                <div style={styles.contentPlanControls}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={styles.cardTitle}>Идеи для постов</h3>
                        <button style={{...styles.button, ...styles.newCampaignButton}} className="newCampaignButton" onClick={onOpenCampaignWizard}>
                            🚀 Новая кампания
                        </button>
                    </div>
                     {unscheduledPosts.length === 0 ? (
                         <EmptyState 
                            icon="💡"
                            title="Нет идей для постов"
                            description="Сгенерируйте идеи для постов, запустите мастера кампаний или добавьте их вручную."
                        />
                     ) : (
                        <div style={styles.planList}>
                            {unscheduledPosts.map(post => (
                                <div
                                    key={post.id}
                                    style={{
                                      ...styles.planCard, 
                                      ...styles.planCardDraggable, 
                                      ...(draggedPostId === post.id ? styles.planCardDragging : {})
                                    }}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, post.id)}
                                    onClick={() => handleSelectPost(post)}
                                >
                                    <strong style={styles.planCardTitle}>{post.topic}</strong>
                                    <span style={styles.planCardBadge}>{post.postType}</span>
                                    <p style={styles.planCardDescription}>{post.description}</p>
                                </div>
                            ))}
                        </div>
                     )}
                </div>
                <div style={styles.calendarContainer}>
                    <div style={styles.calendarHeader}>
                         <button style={styles.calendarNavButton} onClick={handlePrevMonth} className="calendarNavButton">&lt;</button>
                        <h3 style={styles.calendarTitle}>{monthName} {year}</h3>
                         <button style={styles.calendarNavButton} onClick={handleNextMonth} className="calendarNavButton">&gt;</button>
                    </div>
                    <div style={styles.calendarGrid}>
                        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                            <div key={day} style={styles.calendarWeekDay}>{day}</div>
                        ))}
                        {calendarDays.map((day, index) => {
                            if (!day) return <div key={`empty-${index}`} style={styles.calendarDayEmpty}></div>;

                            const isToday = new Date(day.date).toDateString() === new Date().toDateString();
                            const dayStyle = {
                                ...styles.calendarDay,
                                ...(isToday ? styles.calendarDayToday : {}),
                                ...(dragOverDate === day.date ? styles.calendarDayDragOver : {})
                            };

                            return (
                                <div
                                    key={day.date}
                                    style={dayStyle}
                                    onDragOver={(e) => handleDragOver(e, day.date)}
                                    onDrop={(e) => handleDrop(e, day.date)}
                                    onDragLeave={handleDragLeave}
                                >
                                    <span style={styles.calendarDayNumber}>{day.day}</span>
                                    <button className="calendarDayAddBtn" onClick={() => setQuickCreateDate(day.date)}>+</button>
                                    <div style={styles.scheduledPostsContainer}>
                                        {day.posts.map(post => (
                                            <div 
                                                key={post.id} 
                                                style={{
                                                  ...styles.scheduledPostItem, 
                                                  ...(post.status === 'published' ? styles.scheduledPostItemPublished : {})
                                                }}
                                                onClick={() => handleSelectPost(post)}
                                            >
                                                {post.topic}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
             {isDrawerOpen && selectedPost && (
                <PostDetailsDrawer 
                    post={selectedPost} 
                    onClose={() => setIsDrawerOpen(false)}
                    onSave={handleSavePost}
                    onDelete={handleDeletePost}
                    brandContextPrompt={brandContextPrompt}
                    addToast={addToast}
                />
            )}
             {quickCreateDate && (
                <QuickCreatePostModal 
                    date={quickCreateDate}
                    onClose={() => setQuickCreateDate(null)}
                    onSchedule={handleScheduleQuickPost}
                    brandContextPrompt={brandContextPrompt}
                    addToast={addToast}
                />
            )}
        </div>
    );
};

const SettingsScreen = ({ settings, files, onSaveSettings, team, onInvite, onRemoveMember, addToast }: {
    settings: Settings;
    files: AppFile[];
    onSaveSettings: (newSettings: Settings) => void,
    team: TeamMember[],
    onInvite: (email: string) => void,
    onRemoveMember: (id: number) => void;
    addToast: (message: string, type: 'success' | 'error') => void;
}) => {
    const [toneOfVoice, setToneOfVoice] = useState(settings.toneOfVoice);
    const [keywords, setKeywords] = useState(settings.keywords);
    const [targetAudience, setTargetAudience] = useState(settings.targetAudience);
    const [brandVoiceExamples, setBrandVoiceExamples] = useState<number[]>(settings.brandVoiceExamples);
    const [selectedPlatforms, setSelectedPlatforms] = useState(settings.platforms);
    const [inviteEmail, setInviteEmail] = useState('');
    
    const handleSave = () => {
        onSaveSettings({ toneOfVoice, keywords, platforms: selectedPlatforms, targetAudience, brandVoiceExamples });
    };

    const handlePlatformToggle = (platformId: string) => {
        setSelectedPlatforms(prev => 
            prev.includes(platformId) 
                ? prev.filter(id => id !== platformId) 
                : [...prev, platformId]
        );
    };
    
     const handleExampleFileToggle = (fileId: number) => {
        setBrandVoiceExamples(prev => {
            if (prev.includes(fileId)) {
                return prev.filter(id => id !== fileId);
            }
            if (prev.length >= 5) {
                addToast('Можно выбрать до 5 примеров.', 'error');
                return prev;
            }
            return [...prev, fileId];
        });
    };

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        if (inviteEmail) {
            onInvite(inviteEmail);
            setInviteEmail('');
        }
    };
    
    return (
        <div>
            <div style={styles.settingsLayout}>
                <div style={{...styles.card, gridColumn: 'span 2'}}>
                    <h3 style={styles.cardTitle}>🛡️ AI Brand Guardian</h3>
                    <p style={styles.cardSubtitle}>Чем больше деталей вы предоставите, тем точнее AI будет следовать вашему стилю. Эта информация будет использоваться во всех AI-инструментах.</p>
                     <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                        <div style={styles.formGroup}>
                            <label style={styles.label} htmlFor="tone">Тон голоса (Tone of Voice)</label>
                            <textarea 
                                id="tone"
                                style={styles.textarea}
                                placeholder="Например: Дружелюбный и экспертный, обращаемся на 'вы'."
                                value={toneOfVoice}
                                onChange={e => setToneOfVoice(e.target.value)}
                            />
                        </div>
                         <div style={styles.formGroup}>
                            <label style={styles.label} htmlFor="keywords">Ключевые и стоп-слова</label>
                            <textarea 
                                id="keywords"
                                style={styles.textarea}
                                placeholder="ключевые: #экокосметика; стоп-слова: дешевый, скидка"
                                value={keywords}
                                onChange={e => setKeywords(e.target.value)}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label} htmlFor="audience">Описание целевой аудитории</label>
                            <textarea
                                id="audience"
                                style={{...styles.textarea, minHeight: '100px'}}
                                placeholder="Опишите ваших идеальных клиентов: их возраст, интересы, ценности."
                                value={targetAudience}
                                onChange={(e) => setTargetAudience(e.target.value)}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Примеры контента (до 5)</label>
                             <p style={styles.cardSubtitle}>Выберите файлы из Базы Знаний, которые AI будет использовать как эталон вашего стиля.</p>
                            <div style={styles.fileSelectionGrid}>
                                {files.map(appFile => {
                                    const { icon, isImage } = getFileType(appFile.mimeType);
                                    const isSelected = brandVoiceExamples.includes(appFile.id);
                                    return (
                                        <div 
                                            key={appFile.id}
                                            onClick={() => handleExampleFileToggle(appFile.id)}
                                            style={{
                                                ...styles.fileSelectItem, 
                                                ...(isImage && {backgroundImage: `url(${appFile.url})`}),
                                                ...(isSelected && styles.fileSelectItemActive)
                                            }}
                                        >
                                            {!isImage && <div style={styles.fileSelectIcon}>{icon}</div>}
                                            <div style={styles.fileSelectOverlay}><span>{appFile.name}</span></div>
                                            {isSelected && <div style={styles.fileSelectCheck}>✔</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                 <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Подключенные платформы</h3>
                    <p style={styles.cardSubtitle}>Выберите, для каких социальных сетей вы планируете создавать контент.</p>
                    <div style={styles.platformGrid}>
                        {socialPlatforms.map(p => (
                            <div 
                                key={p.id} 
                                style={selectedPlatforms.includes(p.id) ? styles.platformCardActive : styles.platformCard}
                                onClick={() => handlePlatformToggle(p.id)}
                            >
                                <img src={p.icon} alt={p.name} style={styles.platformIcon} />
                                <span style={styles.platformName}>{p.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{...styles.card}}>
                    <h3 style={styles.cardTitle}>Команда</h3>
                    <p style={styles.cardSubtitle}>Пригласите членов вашей команды.</p>
                    <form style={styles.teamInviteForm} onSubmit={handleInvite}>
                        <input 
                            type="email" 
                            style={{...styles.input, flex: 1}} 
                            placeholder="Email нового участника"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                        />
                        <button type="submit" style={styles.inviteButton} className="inviteButton">Пригласить</button>
                    </form>
                    <table style={styles.teamTable}>
                        <thead>
                            <tr>
                                <th style={styles.teamTableTh}>Email</th>
                                <th style={styles.teamTableTh}>Роль</th>
                                <th style={styles.teamTableTh}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {team.map(member => (
                                <tr key={member.id}>
                                    <td style={styles.teamTableTd}>{member.email}</td>
                                    <td style={styles.teamTableTd}>{member.role}</td>
                                    <td style={styles.teamTableTd}>
                                        <button style={styles.teamRemoveButton} className="teamRemoveButton" onClick={() => onRemoveMember(member.id)}>Удалить</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end'}}>
                    <button style={styles.button} onClick={handleSave}>Сохранить изменения</button>
                </div>
            </div>
        </div>
    );
};

interface CampaignResult {
    campaign_name: string;
    target_audience: string;
    goals: string[];
    post_ideas: Omit<Post, 'id' | 'status' | 'date'>[];
}

const CampaignWizardModal = ({ onClose, onAddPostIdeas }: {
    onClose: () => void;
    onAddPostIdeas: (ideas: Omit<Post, 'id' | 'status' | 'date'>[]) => void;
}) => {
    const [step, setStep] = useState(1);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<CampaignResult | null>(null);

    const handleGenerateCampaign = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const fullPrompt = `Ты — SMM-стратег мирового уровня. Создай комплексную контент-кампанию.

            **Вводные данные от клиента:**
            "${prompt}"

            **Твоя задача:**
            1.  Придумать яркое название для кампании (\`campaign_name\`).
            2.  Четко определить целевую аудиторию (\`target_audience\`).
            3.  Сформулировать 2-3 ключевые цели кампании (\`goals\`).
            4.  Предложить 5-7 разнообразных и креативных идей для постов, которые раскрывают суть кампании. Каждая идея должна включать \`topic\`, \`postType\` и \`description\`.

            Верни ответ СТРОГО в формате JSON, без лишних символов или комментариев.`;

            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    campaign_name: { type: Type.STRING },
                    target_audience: { type: Type.STRING },
                    goals: { type: Type.ARRAY, items: { type: Type.STRING } },
                    post_ideas: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                topic: { type: Type.STRING },
                                postType: { type: Type.STRING },
                                description: { type: Type.STRING },
                            },
                            required: ["topic", "postType", "description"],
                        },
                    },
                },
                required: ["campaign_name", "target_audience", "goals", "post_ideas"],
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });

// Fix: Cast `response.text` to string for JSON.parse to resolve type error.
            const parsedResult = JSON.parse(response.text as string) as CampaignResult;
            setResult(parsedResult);
            setStep(2);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Произошла неизвестная ошибка.';
            setError(`Ошибка при генерации кампании: ${message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAddIdeas = () => {
        if (result?.post_ideas) {
            onAddPostIdeas(result.post_ideas);
            onClose();
        }
    };
    
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <button style={styles.modalCloseButton} onClick={onClose}>&times;</button>
                <div style={styles.modalHeader}>
                    <h2 style={styles.cardTitle}>🚀 Мастер создания кампаний</h2>
                    <p style={styles.cardSubtitle}>Опишите вашу цель, а AI разработает стратегию и предложит идеи.</p>
                </div>
                <div style={styles.modalBody}>
                    {step === 1 && (
                        <>
                            <div style={styles.formGroup}>
                                <label style={styles.label} htmlFor="campaign-prompt">Опишите вашу кампанию</label>
                                <textarea
                                    id="campaign-prompt"
                                    style={{...styles.textarea, minHeight: '150px'}}
                                    placeholder="Например: 'Запуск новой осенней коллекции пальто. Хотим создать ажиотаж и рассказать о качестве материалов. Кампания продлится 2 недели.'"
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                />
                            </div>
                            {error && <p style={styles.errorText}>{error}</p>}
                        </>
                    )}
                    {step === 2 && result && (
                        <div style={styles.campaignWizardResultSection}>
                            <h3 style={{...styles.cardTitle, fontSize: '1.2rem'}}>Кампания: {result.campaign_name}</h3>
                            <p><strong>Целевая аудитория:</strong> {result.target_audience}</p>
                            <p><strong>Цели:</strong></p>
                            <ul>{result.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
                            <h4 style={{marginTop: '20px', marginBottom: '10px'}}>Предложенные идеи:</h4>
                            <div style={{...styles.planList, maxHeight: '300px', overflowY: 'auto'}}>
                                {result.post_ideas.map((idea, i) => (
                                    <div key={i} style={{...styles.planCard, cursor: 'default'}}>
                                        <strong style={styles.planCardTitle}>{idea.topic}</strong>
                                        <span style={styles.planCardBadge}>{idea.postType}</span>
                                        <p style={styles.planCardDescription}>{idea.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div style={{...styles.modalFooter, justifyContent: 'flex-end'}}>
                    {step === 1 && (
                        <button style={isLoading ? styles.buttonDisabled : styles.button} onClick={handleGenerateCampaign} disabled={isLoading || !prompt}>
                            {isLoading ? <><div style={styles.miniLoader}></div> Анализ...</> : '✨ Сгенерировать кампанию'}
                        </button>
                    )}
                     {step === 2 && (
                        <div>
                             <button style={{...styles.button, background: '#6c757d'}} onClick={() => { setStep(1); setResult(null); }}>Назад</button>
                             <button style={{...styles.button, marginLeft: '12px'}} onClick={handleAddIdeas}>Добавить идеи в план</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const CommunityScreen = ({ allPosts, brandContextPrompt, addToast }: { allPosts: Post[], brandContextPrompt: string, addToast: (message: string, type: 'success' | 'error') => void }) => {
    type CommentCategory = 'Вопрос' | 'Позитив' | 'Негатив' | 'Спам' | 'Общее';
    type CommentStatus = 'needs-reply' | 'replied' | 'skipped';

    interface InboxComment {
        id: number;
        author: string;
        avatar: string;
        text: string;
        platform: 'instagram' | 'vk';
        postId: number;
        category?: CommentCategory;
        status: CommentStatus;
        replies?: string[];
        isWorking?: boolean;
    }

    const MOCK_COMMENTS: Omit<InboxComment, 'category' | 'status'>[] = [
        { id: 1, author: 'Елена_Стильная', avatar: 'https://i.pravatar.cc/150?u=elena', text: 'Какая красота! А из какой ткани сделано это пальто?', platform: 'instagram', postId: 202 },
        { id: 2, author: 'FashionLover_92', avatar: 'https://i.pravatar.cc/150?u=fashion', text: 'Обожаю ваши вещи! Уже купила свитер, он просто великолепен 😍', platform: 'instagram', postId: 202 },
        { id: 3, author: 'Максим Петров', avatar: 'https://i.pravatar.cc/150?u=maxim', text: 'Долго ждал заказ, немного расстроен сервисом.', platform: 'vk', postId: 203 },
        { id: 4, author: 'Anna_K', avatar: 'https://i.pravatar.cc/150?u=anna', text: 'Подскажите, пожалуйста, есть ли доставка в Казань?', platform: 'instagram', postId: 202 },
        { id: 5, author: 'Сергей Иванов', avatar: 'https://i.pravatar.cc/150?u=sergey', text: 'Круто!', platform: 'vk', postId: 203 },
        { id: 6, author: 'Виктория Модная', avatar: 'https://i.pravatar.cc/150?u=victoria', text: 'Участвую в розыгрыше! Очень хочу победить!', platform: 'instagram', postId: 202 },
        { id: 7, author: 'BuyNowBestDeals', avatar: 'https://i.pravatar.cc/150?u=spam', text: 'СУПЕР СКИДКИ ТОЛЬКО СЕГОДНЯ НА НАШЕМ САЙТЕ!', platform: 'vk', postId: 203 },
    ];

    const [comments, setComments] = useState<InboxComment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<CommentStatus | 'all'>('needs-reply');
    const [isAutopilotOn, setIsAutopilotOn] = useState(false);
    const [autopilotSettings, setAutopilotSettings] = useState<CommentCategory[]>(['Позитив']);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    const processCommentsInBatch = useCallback(async () => {
        setIsLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const commentsToAnalyze = MOCK_COMMENTS.map(c => ({ id: c.id, text: c.text }));
            const prompt = `Проанализируй и классифицируй следующие комментарии. Категории: "Вопрос", "Позитив", "Негатив", "Спам", "Общее".
            Верни ответ в формате JSON-массива объектов, где каждый объект содержит 'id' комментария и его 'category'.
            
            Комментарии: ${JSON.stringify(commentsToAnalyze)}`;

            const responseSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                    },
                    required: ["id", "category"],
                },
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });
            
            const categorizedResults: { id: number, category: CommentCategory }[] = JSON.parse(response.text as string);
            const categoryMap = new Map(categorizedResults.map(item => [item.id, item.category]));

            const updatedComments = MOCK_COMMENTS.map(comment => ({
                ...comment,
                category: categoryMap.get(comment.id) || 'Общее',
                status: 'needs-reply' as CommentStatus,
            }));
            
            setComments(updatedComments);

        } catch (error) {
            console.error("Failed to categorize comments in batch:", error);
            addToast("Не удалось проанализировать комментарии.", 'error');
            // Fallback to basic state
            setComments(MOCK_COMMENTS.map(c => ({ ...c, category: 'Общее', status: 'needs-reply' })));
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        processCommentsInBatch();
    }, [processCommentsInBatch]);

    const handleGenerateReplies = async (comment: InboxComment) => {
        setComments(prev => prev.map(c => c.id === comment.id ? { ...c, isWorking: true, replies: [] } : c));
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const post = allPosts.find(p => p.id === comment.postId);
            const prompt = `Ты — SMM-менеджер. Тебе нужно предложить 3 варианта ответа на комментарий пользователя. Ответы должны быть вежливыми, полезными и соответствовать тону бренда.

            **Гайдлайны по стилю бренда:**
            ${brandContextPrompt}
            **Пост, к которому оставлен комментарий:** ${post?.content || post?.description}
            **Комментарий пользователя:** "${comment.text}"

            Верни результат в формате JSON-массива из 3 строк.`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            });

            const parsedReplies: string[] = JSON.parse(response.text as string);
            setComments(prev => prev.map(c => c.id === comment.id ? { ...c, isWorking: false, replies: parsedReplies } : c));

        } catch (error) {
            addToast('Не удалось сгенерировать ответы.', 'error');
            setComments(prev => prev.map(c => c.id === comment.id ? { ...c, isWorking: false } : c));
        }
    };
    
    const handleReply = (commentId: number, replyText: string) => {
        // Simulate sending reply
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, status: 'replied' } : c));
        addToast("Ответ успешно 'отправлен'!", 'success');
    };

    const filteredComments = useMemo(() => {
        if (activeFilter === 'all') return comments;
        if(activeFilter === 'needs-reply') return comments.filter(c => c.status === 'needs-reply');
        if(activeFilter === 'replied') return comments.filter(c => c.status === 'replied');
        if(activeFilter === 'skipped') return comments.filter(c => c.status === 'skipped');
        return comments;
    }, [comments, activeFilter]);
    
    const categoryStyles: Record<CommentCategory, { bg: string, text: string }> = {
        'Вопрос': { bg: '#e7f1ff', text: '#004085' },
        'Позитив': { bg: '#d4edda', text: '#155724' },
        'Негатив': { bg: '#f8d7da', text: '#721c24' },
        'Спам': { bg: '#fff3cd', text: '#856404' },
        'Общее': { bg: '#e9ecef', text: '#495057' },
    };

    return (
        <div style={styles.communityLayout}>
            <div style={styles.communitySidebar}>
                <h3 style={{...styles.cardTitle, fontSize: '1.2rem'}}>Входящие</h3>
                {(['needs-reply', 'replied', 'skipped', 'all'] as const).map(filter => {
                    const filterText = {'needs-reply': 'Требуют ответа', 'replied': 'Отвечено', 'skipped': 'Пропущено', 'all': 'Все комментарии'}[filter];
                    return (
                        <button key={filter} 
                            style={{...styles.communityFilterButton, ...(activeFilter === filter ? styles.communityFilterButtonActive : {})}}
                            onClick={() => setActiveFilter(filter)}
                        >
                            {filterText}
                        </button>
                    )
                })}
            </div>
            <div style={{overflowY: 'auto', height: '100%'}}>
                 <div style={styles.communityHeader}>
                    <h2 style={styles.screenTitle}>Лента комментариев</h2>
                    <div style={styles.autopilotToggle}>
                        <span>🤖✨ Автопилот</span>
                        <label className="switch">
                            <input type="checkbox" checked={isAutopilotOn} onChange={() => setIsAutopilotOn(v => !v)} />
                            <span className="slider round"></span>
                        </label>
                        <button onClick={() => setIsSettingsModalOpen(true)} style={{background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer'}}>⚙️</button>
                    </div>
                </div>
                
                {isLoading ? <div style={styles.loader}></div> : (
                    <div style={styles.inboxFeed}>
                        {filteredComments.length === 0 && <EmptyState icon="🤫" title="Здесь пока тихо" description="Новые комментарии появятся в этой ленте." />}
                        {filteredComments.map(comment => {
                            const post = allPosts.find(p => p.id === comment.postId);
                            const platform = socialPlatforms.find(p => p.id === comment.platform);
                            const isAutopilotReply = isAutopilotOn && comment.category && autopilotSettings.includes(comment.category);

                            return (
                                <div key={comment.id} style={{...styles.inboxCard, opacity: comment.status !== 'needs-reply' ? 0.6 : 1}}>
                                    <div style={styles.inboxCardHeader}>
                                        <img src={comment.avatar} alt={comment.author} style={styles.inboxCardAvatar} />
                                        <div>
                                            <span style={styles.inboxCardAuthor}>{comment.author}</span>
                                            <p style={styles.inboxCardMeta}>
                                                прокомментировал(а) пост <a href="#" onClick={e => e.preventDefault()}>"{post?.topic}"</a> на 
                                                <img src={platform?.icon} style={{width: '14px', height: '14px', margin: '0 4px', verticalAlign: 'middle'}}/>
                                                {platform?.name}
                                            </p>
                                        </div>
                                        {comment.category && (
                                            <span style={{...styles.inboxCardAiTag, backgroundColor: categoryStyles[comment.category].bg, color: categoryStyles[comment.category].text}}>
                                                {comment.category}
                                            </span>
                                        )}
                                    </div>
                                    <p>{comment.text}</p>
                                    
                                    {comment.status === 'needs-reply' && !isAutopilotReply && (
                                        <div style={styles.inboxCardReplySection}>
                                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                                 <h4 style={styles.inboxCardReplyTitle}>AI-предложения</h4>
                                                 <button onClick={() => handleGenerateReplies(comment)} disabled={comment.isWorking} style={{...styles.button, padding: '4px 8px', fontSize: '0.8rem', background: '#6c757d'}}>
                                                    {comment.isWorking ? '...' : '🔄 Обновить'}
                                                </button>
                                            </div>
                                            
                                            {comment.isWorking && <div style={{...styles.miniLoader, margin: '16px auto'}}></div>}

                                            {!comment.isWorking && !comment.replies && (
                                                <button onClick={() => handleGenerateReplies(comment)} style={{...styles.button, width: '100%', marginTop: '10px'}}>
                                                    💡 Сгенерировать ответы
                                                </button>
                                            )}

                                            {comment.replies?.map((reply, i) => (
                                                <div key={i} style={styles.inboxCardReplyOption}>
                                                    <p style={{flex: 1, marginRight: '12px'}}>{reply}</p>
                                                    <button style={{...styles.button, ...styles.inboxCardReplyButton}} onClick={() => handleReply(comment.id, reply)}>Ответить</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {isAutopilotReply && comment.status === 'needs-reply' && (
                                        <div style={{...styles.inboxCardReplySection, textAlign: 'center', color: '#007bff'}}>
                                            <p>🤖✨ Ответ будет отправлен Автопилотом...</p>
                                        </div>
                                    )}

                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
             {isSettingsModalOpen && (
                 <div style={styles.modalOverlay} onClick={() => setIsSettingsModalOpen(false)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3 style={styles.cardTitle}>Настройки Автопилота</h3>
                        <p style={styles.cardSubtitle}>Выберите категории комментариев, на которые AI будет отвечать автоматически.</p>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                            {(['Позитив', 'Вопрос', 'Общее'] as CommentCategory[]).map(cat => (
                                <label key={cat} style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', cursor: 'pointer', background: autopilotSettings.includes(cat) ? '#f0f8ff' : '#fff'}}>
                                    <input 
                                        type="checkbox" 
                                        checked={autopilotSettings.includes(cat)} 
                                        onChange={() => {
                                            setAutopilotSettings(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
                                        }} 
                                    />
                                    {cat}
                                </label>
                            ))}
                        </div>
                         <button style={{...styles.button, marginTop: '20px'}} onClick={() => setIsSettingsModalOpen(false)}>Закрыть</button>
                    </div>
                 </div>
             )}
        </div>
    );
};

type Screen =
  | 'content-plan'
  | 'community'
  | 'analytics'
  | 'knowledge-base'
  | 'post-generator'
  | 'image-generator'
  | 'image-editor'
  | 'video-generator'
  | 'strategy-generator'
  | 'trend-spotter'
  | 'content-adapter'
  | 'settings'

type Toast = {
    id: number;
    message: string;
    type: 'success' | 'error';
};

interface Settings {
    toneOfVoice: string;
    keywords: string;
    targetAudience: string;
    brandVoiceExamples: number[];
    platforms: string[];
}

const App = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [activeScreen, setActiveScreen] = useState<Screen>('content-plan');
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
    const [isAiToolsOpen, setIsAiToolsOpen] = useState(true);
    const [allPosts, setAllPosts] = useState<Post[]>([]);
    const [files, setFiles] = useState<AppFile[]>([]);
    const [filesLoading, setFilesLoading] = useState(true);
    const [filesError, setFilesError] = useState('');
    const [team, setTeam] = useState(MOCK_TEAM);
    const [settings, setSettings] = useState<Settings>({
        toneOfVoice: "Дружелюбный и экспертный. Обращаемся к клиентам на 'вы', используем эмодзи для настроения.",
        keywords: "ключевые: #одеждаручнойработы, #натуральныеткани; стоп-слова: дешевый, скидка",
        targetAudience: "Женщины 25-45 лет, ценящие уют, натуральные материалы и ручную работу. Интересуются модой, но предпочитают классику и качество.",
        brandVoiceExamples: [],
        platforms: ['instagram', 'telegram', 'vk'],
    });
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [isCampaignWizardOpen, setIsCampaignWizardOpen] = useState(false);
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);
    
    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, 5000);
    }, []);

    const brandContextPrompt = useMemo(() => {
        const exampleFilesContent = files
            .filter(f => settings.brandVoiceExamples.includes(f.id))
            .map(f => `---Начало примера: ${f.name}---\n${f.description || f.name}\n---Конец примера---`)
            .join('\n\n');

        return `
Тон голоса (Tone of Voice): "${settings.toneOfVoice}"
Ключевые и стоп-слова: "${settings.keywords}"
Целевая аудитория: "${settings.targetAudience}"
${exampleFilesContent ? `\nПримеры контента для подражания:\n${exampleFilesContent}` : ''}
        `.trim();
    }, [settings, files]);

    const handleLoginSuccess = (token: string) => {
        localStorage.setItem('smm_ai_token', token);
        setIsLoggedIn(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('smm_ai_token');
        setIsLoggedIn(false);
        setActiveScreen('content-plan');
    };
    
    useEffect(() => {
      const handleResize = () => {
        if (window.innerWidth > 768) {
          setIsSidebarOpen(true);
        } else {
          setIsSidebarOpen(false);
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Check for token on initial load
    useEffect(() => {
        const token = localStorage.getItem('smm_ai_token');
        if (token) {
            setIsLoggedIn(true);
            // Here you would typically validate the token with the backend
        }
        
        // Setup force logout listener
        const forceLogoutHandler = () => handleLogout();
        window.addEventListener('forceLogout', forceLogoutHandler);
        return () => window.removeEventListener('forceLogout', forceLogoutHandler);
    }, []);

    const fetchPosts = useCallback(async () => {
        if (!isLoggedIn) return;
        try {
            // const response = await fetchWithAuth(`${API_BASE_URL}/api/posts`);
            // const data = await response.json();
            // setAllPosts(data);
             setAllPosts([...MOCK_SCHEDULED_POSTS, ...MOCK_UNSCHEDULED_POSTS]);
        } catch (error) {
            console.error("Failed to fetch posts:", error);
            addToast("Не удалось загрузить посты.", 'error');
            // Fallback to mock data on error
            setAllPosts([...MOCK_SCHEDULED_POSTS, ...MOCK_UNSCHEDULED_POSTS]);
        }
    }, [isLoggedIn, addToast]);

    const fetchFiles = useCallback(async () => {
        if (!isLoggedIn) return;
        setFilesLoading(true);
        setFilesError('');
        try {
            // Using a mock fetch since there's no backend
            await new Promise(res => setTimeout(res, 1000));
            // const response = await fetchWithAuth(`${API_BASE_URL}/api/files`);
            // const data = await response.json();
            // setFiles(data.map((f: any) => ({...f, isAnalyzing: false})));
            setFiles([]); // Start with empty files
        } catch (error) {
            console.error("Failed to fetch files:", error);
            const message = error instanceof Error ? error.message : "Не удалось загрузить файлы.";
            setFilesError(message);
            addToast(message, 'error');
        } finally {
            setFilesLoading(false);
        }
    }, [isLoggedIn, addToast]);


    useEffect(() => {
        if (isLoggedIn) {
            fetchPosts();
            fetchFiles();
        }
    }, [isLoggedIn, fetchPosts, fetchFiles]);
    
    const handleSaveSettings = (newSettings: Settings) => {
        setSettings(newSettings);
        addToast('Настройки сохранены!', 'success');
    };
    
    const handleInviteMember = (email: string) => {
        // Mock implementation
        const newMember: TeamMember = { id: Date.now(), email, role: 'Гость' };
        setTeam(prev => [...prev, newMember]);
        addToast(`Приглашение отправлено на ${email}`, 'success');
    };

    const handleRemoveMember = (id: number) => {
        // Mock implementation, prevent removing owner
        const memberToRemove = team.find(m => m.id === id);
        if (memberToRemove?.role === 'Владелец') {
            addToast('Нельзя удалить владельца.', 'error');
            return;
        }
        setTeam(prev => prev.filter(m => m.id !== id));
        addToast('Участник удален.', 'success');
    };

    const handleAddPostIdeas = (ideas: Omit<Post, 'id' | 'status'>[]) => {
        const newPosts: Post[] = ideas.map((idea, index) => ({
            ...idea,
            id: Date.now() + index,
            status: 'idea',
        }));
        setAllPosts(prev => [...prev, ...newPosts]);
        addToast(`${newPosts.length} идей добавлено в контент-план!`, 'success');
    };
    
    const handleFileUpload = useCallback(async (newFiles: File[]) => {
        const fileUploads = newFiles.map(file => {
            const tempId = Date.now() + Math.random();
            const url = URL.createObjectURL(file);
            setFiles(prev => [...prev, { id: tempId, name: file.name, url, mimeType: file.type, isAnalyzing: true }]);
            return { file, tempId, url };
        });

        for (const { file, tempId, url } of fileUploads) {
            try {
                // Mocking the backend call
                // In a real app, you would have something like:
                // const formData = new FormData();
                // formData.append('file', file);
                // const response = await fetchWithAuth(`${API_BASE_URL}/api/upload`, { method: 'POST', body: formData });
                // const savedFile = await response.json();
                
                // Mocking AI analysis
                await new Promise(res => setTimeout(res, 1500)); // Simulate analysis delay
                
                let tags = ['файл'];
                if (getFileType(file.type).isImage) {
                    tags = ['изображение', 'визуал', file.name.split('.')[0]];
                }
                
                const savedFile: AppFile = {
                    id: tempId,
                    name: file.name,
                    url: url,
                    mimeType: file.type,
                    tags,
                    description: `AI-сгенерированное описание для ${file.name}`
                };
                
                setFiles(prev => prev.map(f => f.id === tempId ? { ...savedFile, isAnalyzing: false } : f));
            } catch (error) {
                console.error("File upload failed:", error);
                addToast(`Не удалось загрузить ${file.name}`, 'error');
                setFiles(prev => prev.filter(f => f.id !== tempId));
                URL.revokeObjectURL(url); // Clean up
            }
        }
        addToast(`${newFiles.length} файл(ов) загружено!`, 'success');
    }, [addToast]);
    
    const handleDeleteFile = useCallback(async (id: number) => {
        const fileToDelete = files.find(f => f.id === id);
        if (!fileToDelete) return;

        setFiles(prev => prev.filter(f => f.id !== id));
        
        try {
            // await fetchWithAuth(`${API_BASE_URL}/api/files/${id}`, { method: 'DELETE' });
            URL.revokeObjectURL(fileToDelete.url);
            addToast(`Файл "${fileToDelete.name}" удален.`, 'success');
        } catch (error) {
            console.error("Failed to delete file:", error);
            addToast('Не удалось удалить файл на сервере.', 'error');
            setFiles(prev => [...prev, fileToDelete]); // Re-add if delete fails
        }
    }, [files, addToast]);
    
    const handleSaveGeneratedImage = useCallback(async (data: { base64: string, name: string }) => {
        try {
            // Mocking a file save by converting base64 to a blob URL and adding to state
            const byteString = atob(data.base64);
            const mimeString = 'image/jpeg';
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });
            const url = URL.createObjectURL(blob);
            
            const newFile: AppFile = {
                id: Date.now(),
                name: data.name,
                url,
                mimeType: mimeString,
                isAnalyzing: false,
                tags: ['ai-generated', 'imagen']
            };
            setFiles(prev => [newFile, ...prev]);
            addToast('Изображение сохранено в Базу знаний!', 'success');
        } catch (error) {
             addToast('Не удалось сохранить изображение.', 'error');
             throw error; // Re-throw to be caught by caller
        }
    }, [addToast]);

    if (!isLoggedIn) {
        return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
    }

    const screenMap: { [key in Screen]: { title: string; component: React.ReactNode } } = {
        'content-plan': { title: 'Контент-план', component: <ContentPlanScreen allPosts={allPosts} setAllPosts={setAllPosts} brandContextPrompt={brandContextPrompt} onOpenCampaignWizard={() => setIsCampaignWizardOpen(true)} addToast={addToast}/> },
        'community': { title: 'Сообщество', component: <CommunityScreen allPosts={allPosts} brandContextPrompt={brandContextPrompt} addToast={addToast} /> },
        'analytics': { title: 'Аналитика', component: <AnalyticsScreen /> },
        'knowledge-base': { title: 'База знаний', component: <KnowledgeBaseScreen files={files} isLoading={filesLoading} error={filesError} onUpload={handleFileUpload} onDelete={handleDeleteFile}/> },
        'post-generator': { title: 'Генератор постов', component: <PostGeneratorScreen files={files} brandContextPrompt={brandContextPrompt} onAddPostIdea={idea => handleAddPostIdeas([idea])} /> },
        'image-generator': { title: 'Генератор изображений', component: <ImageGeneratorScreen onSaveGeneratedImage={handleSaveGeneratedImage} /> },
        'image-editor': { title: 'Редактор изображений', component: <ImageEditorScreen files={files} onSaveGeneratedImage={handleSaveGeneratedImage} /> },
        'video-generator': { title: 'Генератор видео', component: <VideoGeneratorScreen files={files} onUpload={handleFileUpload} addToast={addToast} /> },
        'strategy-generator': { title: 'Генератор стратегий', component: <StrategyGeneratorScreen onAddPostIdeas={handleAddPostIdeas} brandContextPrompt={brandContextPrompt} /> },
        'trend-spotter': { title: 'Поиск трендов', component: <TrendSpotterScreen /> },
        'content-adapter': { title: 'Адаптер контента', component: <ContentAdapterScreen allPosts={allPosts} brandContextPrompt={brandContextPrompt} addToast={addToast} /> },
        'settings': { title: 'Настройки', component: <SettingsScreen settings={settings} files={files} onSaveSettings={handleSaveSettings} team={team} onInvite={handleInviteMember} onRemoveMember={handleRemoveMember} addToast={addToast}/> },
    };
    
    const navItems = [
        { id: 'content-plan', name: 'Контент-план', icon: '🗓️' },
        { id: 'community', name: 'Сообщество', icon: '💬' },
        { id: 'analytics', name: 'Аналитика', icon: '📊' },
        { id: 'knowledge-base', name: 'База знаний', icon: '📚' },
    ];
    
    const aiTools = [
        { id: 'post-generator', name: 'Генератор постов', icon: '✍️' },
        { id: 'image-generator', name: 'Генератор изображений', icon: '🎨' },
        { id: 'image-editor', name: 'Редактор изображений', icon: '🪄' },
        { id: 'video-generator', name: 'Генератор видео', icon: '🎬' },
        { id: 'strategy-generator', name: 'Генератор стратегий', icon: '🧠' },
        { id: 'trend-spotter', name: 'Поиск трендов', icon: '📈' },
        { id: 'content-adapter', name: 'Адаптер контента', icon: '🔄' },
    ];

    return (
        <div style={styles.dashboardLayout}>
            <div style={{...styles.sidebar, ...(isSidebarOpen ? {left: '0'} : {})}} className={isSidebarOpen ? 'sidebar open' : 'sidebar'}>
                <div>
                    <h1 style={styles.logo}>SMM AI</h1>
                    <nav style={styles.nav}>
                        {navItems.map(item => (
                             <button
                                key={item.id}
                                style={activeScreen === item.id ? styles.navButtonActive : styles.navButton}
                                onClick={() => setActiveScreen(item.id as Screen)}
                            >
                                <span style={styles.navIcon}>{item.icon}</span> {item.name}
                            </button>
                        ))}
                        <button
                            style={styles.navButton}
                            onClick={() => setIsAiToolsOpen(!isAiToolsOpen)}
                        >
                             <span style={styles.navIcon}>🤖</span> AI Инструменты
                             <span style={{...styles.chevron, ...(isAiToolsOpen ? styles.navChevronOpen : {})}}>▶</span>
                        </button>
                         <div style={{...styles.aiToolsContainer, maxHeight: isAiToolsOpen ? `${aiTools.length * 45}px` : '0px'}}>
                            {aiTools.map(item => (
                                 <button
                                    key={item.id}
                                    style={activeScreen === item.id ? styles.navButtonActive : styles.navButton}
                                    onClick={() => setActiveScreen(item.id as Screen)}
                                >
                                    <span style={styles.navIcon}>{item.icon}</span> {item.name}
                                </button>
                            ))}
                        </div>
                    </nav>
                </div>
                 <div>
                     <button
                        style={activeScreen === 'settings' ? styles.navButtonActive : styles.navButton}
                        onClick={() => setActiveScreen('settings')}
                    >
                        <span style={styles.navIcon}>⚙️</span> Настройки
                    </button>
                     <button style={styles.navButton} onClick={handleLogout}>
                        <span style={styles.navIcon}>🚪</span> Выйти
                    </button>
                </div>
            </div>

            <main style={styles.mainContent}>
                <div style={styles.topBar}>
                    <div style={styles.topBarLeft}>
                         <button style={{...styles.burgerButton}} className="burgerButton" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
                         <h2 style={styles.screenTitle}>{screenMap[activeScreen].title}</h2>
                    </div>
                </div>
                <div style={styles.screenContent}>
                    {screenMap[activeScreen].component}
                </div>
            </main>
            
            <button style={styles.copilotFab} onClick={() => setIsCopilotOpen(true)}>
                🎙️
            </button>
            
            {isCampaignWizardOpen && <CampaignWizardModal onClose={() => setIsCampaignWizardOpen(false)} onAddPostIdeas={handleAddPostIdeas} />}
            {isCopilotOpen && (
                <AICopilotModal 
                    onClose={() => setIsCopilotOpen(false)} 
                    onAddPostIdea={idea => handleAddPostIdeas([idea])}
                    onSaveGeneratedImage={handleSaveGeneratedImage}
                />
            )}
            
            <div className="toast-container" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast toast-${toast.type}`} style={{ ...styles.authMessage, ...(toast.type === 'success' ? styles.authMessageSuccess : styles.authMessageError), display: 'flex', alignItems: 'center', animation: 'toast-in-right 0.3s' }}>
                        <span style={{ fontSize: '1.5rem', marginRight: '12px' }}>{toast.type === 'success' ? '✅' : '❌'}</span>
                        <span style={{flex: 1}}>{toast.message}</span>
                        <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'inherit', marginLeft: '16px' }}>&times;</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
