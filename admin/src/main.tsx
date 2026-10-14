import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/geist-sans';
import '../../src/index.css';
import '../../src/i18n';
import './style.css';
import { App } from './App';
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
