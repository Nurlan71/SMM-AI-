import React, { useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Toast as ToastType } from '../types';

const Toast = ({ toast, onRemove }: { toast: ToastType; onRemove: (id: number) => void; }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, 5000);
        return () => clearTimeout(timer);
    }, [toast, onRemove]);

    const toastStyle = toast.type === 'success' ? 'toast-success' : 'toast-error';
    const icon = toast.type === 'success' ? '✅' : '❌';

    return (
        <div className={`toast ${toastStyle}`}>
            <span className="toast-icon">{icon}</span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close-button" onClick={() => onRemove(toast.id)}>&times;</button>
        </div>
    );
};

export const ToastContainer = () => {
    const { state, dispatch } = useAppContext();
    const { toasts } = state;

    const removeToast = (id: number) => {
        dispatch({ type: 'REMOVE_TOAST', payload: id });
    };

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onRemove={removeToast} />
            ))}
        </div>
    );
};
