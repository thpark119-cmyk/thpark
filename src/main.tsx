import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Global error logging for mobile debugging
window.onerror = (msg, src, line, col, err) => {
  console.error('[Global Error]:', msg, 'at', src, ':', line, ':', col, err);
  // Optional: send to logging service
};

window.onunhandledrejection = (event) => {
  console.error('[Unhandled Rejection]:', event.reason);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
);
