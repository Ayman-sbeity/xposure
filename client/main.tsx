import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
// Self-hosted variable fonts (OFL): no third-party font requests, no render-blocking @import.
import '@fontsource-variable/jost';
// Arabic pages. unicode-range means the file is only downloaded when Arabic text is on the page.
import '@fontsource-variable/noto-sans-arabic';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const app = (
  <StrictMode>
    <App path={window.location.pathname} />
  </StrictMode>
);

// Production pages are prerendered, so hydrate; the dev server serves an empty root.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
