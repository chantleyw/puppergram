import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { installExternalLinkHandler } from './lib/desktop';
import './index.css';

// No-op in the browser; in the Tauri window it routes external links out to
// the user's real browser.
installExternalLinkHandler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
