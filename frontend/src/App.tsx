'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type ReactNode } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AppProvider } from './components/AppContext';
import { ToastProvider } from './components/shared/ToastContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { Login } from './screens/Login';
import { isLoggedIn, applyDeepLinkLogin } from './lib/api';
import { AppRoutes } from './routes';

// A route that throws shouldn't white-screen the whole app, and navigating
// away from the broken page should recover automatically — keying the
// boundary by pathname remounts it (and clears the error) on every nav.
function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

export default function App() {
  // The account-picker Login screen is the entry point in every build, dev
  // included. Identity is per-tab (sessionStorage), so each tab can be signed
  // in as a different role against the same backend. A `?role=`/`?uid=` deep
  // link signs this tab straight in — see applyDeepLinkLogin — which is what
  // lets a presenter open one tab per role in a single click each.
  const [loggedIn, setLoggedIn] = useState(() => applyDeepLinkLogin() || isLoggedIn());

  if (!loggedIn) {
    return <Login onLoggedIn={() => setLoggedIn(true)} />;
  }

  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          <RouteErrorBoundary>
            <AppRoutes />
          </RouteErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}
