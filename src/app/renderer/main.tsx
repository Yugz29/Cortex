import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './hooks/useTheme';
import { LocaleProvider } from './hooks/useLocale';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
    createRoot(rootElement).render(
        <ThemeProvider>
            <LocaleProvider>
                <App />
            </LocaleProvider>
        </ThemeProvider>
    );
}
