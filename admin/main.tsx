import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/jost';
import '@fontsource-variable/noto-sans-arabic';
import { App } from './App';
import './admin.css';

const root = document.getElementById('admin-root');
if (!root) throw new Error('Missing #admin-root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
