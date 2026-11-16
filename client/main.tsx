import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
// Self-hosted variable fonts (OFL): no third-party font requests, no render-blocking @import.
import '@fontsource-variable/jost';
// Arabic pages. unicode-range means the file is only downloaded when Arabic text is on the page.
import '@fontsource-variable/noto-sans-arabic';
import App from './App';
import { applyContent, registerMedia } from './content/editable';
import { DATA_ELEMENT_ID, runtime, type PageData } from './runtime';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// Pages served by the Node server carry the content edited in the admin panel. Apply it
// before hydrating so the browser renders exactly what the server sent.
const dataElement = document.getElementById(DATA_ELEMENT_ID);
if (dataElement?.textContent) {
  try {
    const data = JSON.parse(dataElement.textContent) as PageData;
    runtime.api = Boolean(data.api);
    registerMedia(data.media ?? []);
    applyContent(data.content ?? {});
  } catch {
    /* malformed data: fall back to the built-in content */
  }
}

const app = (
  <StrictMode>
    <App path={window.location.pathname} />
  </StrictMode>
);

// Pages are rendered on the server (or prerendered), so hydrate; an empty root is rendered fresh.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
