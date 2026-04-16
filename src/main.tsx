import {createRoot} from 'react-dom/client';
import {Analytics} from '@vercel/analytics/react';
import App from './App.tsx';
import './index.css';
import { I18nProvider } from './i18n/index.tsx';

createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <App />
    <Analytics />
  </I18nProvider>
);
