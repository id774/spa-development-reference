// frontend/src/app/App.tsx: application routes and screens
//
// Description:
// Declares the route structure of the SPA, the signed-out and sign-in screens,
// the OAuth callback route, and the navigation shell.
//
// Route protection and role gates here are presentation only: a protected
// route needs an in-memory session, and a reload lands on the signed-out
// screen. The backend remains the authorization authority.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
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

import type { SessionRole } from '@spa-ref/api-client';
import {
  AppShell,
  Button,
  EmptyState,
  ErrorMessage,
  LoadingIndicator,
  type NavItem,
} from '@spa-ref/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router';
import { AuditPage } from '../features/administration/AuditPage.js';
import { ApprovalQueuePage } from '../features/approvals/ApprovalQueuePage.js';
import { RequestDetailPage } from '../features/requests/RequestDetailPage.js';
import { RequestListPage } from '../features/requests/RequestListPage.js';
import { RequestNewPage } from '../features/requests/RequestNewPage.js';
import { useAuth } from '../shared/auth/AuthProvider.js';
import { LOCAL_DEMO_ROLES } from '../shared/auth/local-demo.js';

const APP_TITLE = 'SPA Development Reference';

const ROLE_SUMMARY: Readonly<Record<SessionRole, string>> = {
  Requester: 'Create and submit requests',
  Approver: 'Review submitted requests',
  Administrator: 'Inspect requests and audit history',
};

const NO_ROLE_MESSAGE =
  'Your account has no application role. Ask an administrator to grant access.';

/** Protected routes need an in-memory session; a reload lands on the signed-out screen. */
function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'signed-out') {
    return (
      <Navigate
        to="/signed-out"
        replace
        state={{ returnPath: location.pathname + location.search }}
      />
    );
  }
  return <Outlet />;
}

/** Presentation gate only. The backend remains the authorization authority. */
function RequireRole({ anyOf, children }: { anyOf: SessionRole[]; children: ReactNode }) {
  const { roles } = useAuth();
  if (roles.length === 0) return <EmptyState title={NO_ROLE_MESSAGE} />;
  if (!anyOf.some((role) => roles.includes(role))) {
    return <EmptyState title="You do not have access to this page." />;
  }
  return <>{children}</>;
}

function Layout() {
  const { roles, session, signOut } = useAuth();
  const link = (to: string, label: string): NavItem => ({
    key: to,
    label,
    element: <NavLink to={to}>{label}</NavLink>,
  });
  const navigation: NavItem[] = [];
  if (roles.includes('Requester') || roles.includes('Administrator')) {
    navigation.push(
      link('/requests', roles.includes('Requester') ? 'My Requests' : 'All Requests'),
    );
  }
  if (roles.includes('Approver')) navigation.push(link('/approvals', 'Approval Queue'));
  if (roles.includes('Administrator')) navigation.push(link('/admin/audit', 'Audit'));
  return (
    <AppShell
      title={APP_TITLE}
      navigation={navigation}
      account={
        <>
          <span>{session?.subject}</span>
          <Button onClick={signOut}>Sign out</Button>
        </>
      }
    >
      {roles.length === 0 ? <EmptyState title={NO_ROLE_MESSAGE} /> : <Outlet />}
    </AppShell>
  );
}

function Home() {
  const { roles } = useAuth();
  if (roles.includes('Requester') || roles.includes('Administrator'))
    return <Navigate to="/requests" replace />;
  if (roles.includes('Approver')) return <Navigate to="/approvals" replace />;
  return <EmptyState title={NO_ROLE_MESSAGE} />;
}

function SignedOutPage() {
  const { authMode, signIn, signInLocal, status } = useAuth();
  const [localFailed, setLocalFailed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const returnPath = (location.state as { returnPath?: string } | null)?.returnPath ?? '/';
  useEffect(() => {
    if (status === 'signed-in') void navigate('/', { replace: true });
  }, [navigate, status]);
  const brand = (
    <div className="auth-brand">
      <span className="ui-shell__mark" aria-hidden="true" />
      {APP_TITLE}
    </div>
  );
  if (authMode === 'local') {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          {brand}
          <p className="auth-mode">Local demo mode</p>
          <div className="auth-intro">
            <h1>You are signed out</h1>
            <p>Local demo: choose a role to continue. No external service is used.</p>
          </div>
          {localFailed ? (
            <ErrorMessage
              title="The local demo backend did not accept the selection."
              detail="Check that npm run demo is running."
            />
          ) : null}
          <ul className="role-list">
            {LOCAL_DEMO_ROLES.map((role) => (
              <li key={role} className="role-card">
                <span className="role-card__avatar" aria-hidden="true">
                  {role.slice(0, 2)}
                </span>
                <div>
                  <p className="role-card__name">{role}</p>
                  <p className="role-card__description" id={`role-${role}-description`}>
                    {ROLE_SUMMARY[role]}
                  </p>
                </div>
                <Button
                  variant="primary"
                  aria-describedby={`role-${role}-description`}
                  onClick={() => {
                    setLocalFailed(false);
                    signInLocal(role).catch(() => setLocalFailed(true));
                  }}
                >
                  Continue as {role}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    );
  }
  return (
    <main className="auth-screen">
      <div className="auth-card">
        {brand}
        <div className="auth-intro">
          <h1>You are signed out</h1>
          <p>Sign in to continue.</p>
        </div>
        <Button variant="primary" onClick={() => void signIn(returnPath)}>
          Sign in
        </Button>
      </div>
    </main>
  );
}

function CallbackPage() {
  const { completeSignIn } = useAuth();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // The authorization code and the transaction state are single use.
    if (started.current) return;
    started.current = true;
    completeSignIn(search).then(
      (path) => void navigate(path, { replace: true }),
      () => setFailed(true),
    );
  }, [completeSignIn, navigate, search]);

  if (failed) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <ErrorMessage title="Sign-in failed" detail="The sign-in could not be completed." />
          <Button variant="primary" onClick={() => void navigate('/signed-out', { replace: true })}>
            Back to sign in
          </Button>
        </div>
      </main>
    );
  }
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <LoadingIndicator label="Signing in" />
      </div>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/signed-out" element={<SignedOutPage />} />
      <Route path="/auth/callback" element={<CallbackPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route
            path="requests"
            element={
              <RequireRole anyOf={['Requester', 'Administrator']}>
                <RequestListPage />
              </RequireRole>
            }
          />
          <Route
            path="requests/new"
            element={
              <RequireRole anyOf={['Requester']}>
                <RequestNewPage />
              </RequireRole>
            }
          />
          <Route
            path="requests/:requestId"
            element={
              <RequireRole anyOf={['Requester', 'Approver', 'Administrator']}>
                <RequestDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="approvals"
            element={
              <RequireRole anyOf={['Approver']}>
                <ApprovalQueuePage />
              </RequireRole>
            }
          />
          <Route
            path="admin/audit"
            element={
              <RequireRole anyOf={['Administrator']}>
                <AuditPage />
              </RequireRole>
            }
          />
          <Route path="*" element={<EmptyState title="Page not found." />} />
        </Route>
      </Route>
    </Routes>
  );
}
