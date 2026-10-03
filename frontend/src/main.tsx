// License: The GPL version 3, or LGPL version 3 (Dual License).
import '@spa-ref/ui/styles.css';
import './app/app.css';
import { ErrorMessage } from '@spa-ref/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App.js';
import { loadRuntimeConfig } from './app/config.js';
import { AuthProvider } from './shared/auth/AuthProvider.js';

const container = document.getElementById('root');
if (container === null) throw new Error('The root element is missing.');
const root = createRoot(container);

loadRuntimeConfig().then(
  (config) =>
    root.render(
      <StrictMode>
        <AuthProvider config={config}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </StrictMode>,
    ),
  (error: unknown) =>
    // Invalid runtime configuration stops the application instead of running half configured.
    root.render(
      <main className="auth-screen">
        <div className="auth-card">
          <ErrorMessage
            title="The application is not configured correctly."
            detail={error instanceof Error ? error.message : undefined}
          />
        </div>
      </main>,
    ),
);
