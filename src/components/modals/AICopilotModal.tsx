import React from 'react';
import { useAppContext } from '../../contexts/AppContext';

export const AICopilotModal = () => {
  const { dispatch } = useAppContext();
  const handleClose = () => dispatch({ type: 'SET_COPILOT_OPEN', payload: false });
  // Placeholder component
  return (
    <div 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
        onClick={handleClose}
    >
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px' }} onClick={e => e.stopPropagation()}>
        <h2>AI Copilot Modal (Placeholder)</h2>
        <p>This modal will contain the AI Copilot interface.</p>
         <button onClick={handleClose}>Close</button>
      </div>
    </div>
  );
};