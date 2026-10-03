// License: The GPL version 3, or LGPL version 3 (Dual License).
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
      title="SPA Development Reference"
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
  const { signIn, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const returnPath = (location.state as { returnPath?: string } | null)?.returnPath ?? '/';
  useEffect(() => {
    if (status === 'signed-in') void navigate('/', { replace: true });
  }, [navigate, status]);
  return (
    <main className="signed-out">
      <h1>You are signed out</h1>
      <p>Sign in to continue.</p>
      <Button variant="primary" onClick={() => void signIn(returnPath)}>
        Sign in
      </Button>
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
      <main className="signed-out">
        <ErrorMessage title="Sign-in failed" detail="The sign-in could not be completed." />
        <Button variant="primary" onClick={() => void navigate('/signed-out', { replace: true })}>
          Back to sign in
        </Button>
      </main>
    );
  }
  return <LoadingIndicator label="Signing in" />;
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
