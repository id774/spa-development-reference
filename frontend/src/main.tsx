// frontend/src/main.tsx: browser entry point of the SPA
//
// Description:
// Bootstraps the React application in the browser. It loads and validates the
// runtime configuration served as /config.json, then renders the application
// inside the authentication provider and the router.
//
// Invalid runtime configuration stops the application with an error screen
// instead of running half configured. The styles of the shared UI package and
// of the application are imported here.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Build / Run:
//     npm run dev -w @spa-ref/frontend
//     npm run build -w @spa-ref/frontend
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - React 19
// - See frontend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

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
