/** The mock-auth identity every API route reads. Set by AppContext on role switch. */
export const CURRENT_USER_KEY = 'mockUserId';

/**
 * Identity lives in sessionStorage, not localStorage, so each browser TAB
 * holds its own signed-in role. That's what lets a presenter open one tab per
 * role (Requestor, Approver, Custodian, Admin) against the same shared backend
 * and watch a claim flow between them — signing in as someone in one tab no
 * longer clobbers the others. sessionStorage survives an in-tab reload but is
 * scoped to the tab, which is exactly the demo behaviour we want.
 */
export const getCurrentUserId = () => sessionStorage.getItem(CURRENT_USER_KEY) || '';
export const setCurrentUserId = (id: string) => sessionStorage.setItem(CURRENT_USER_KEY, id);

/**
 * Distinct from CURRENT_USER_KEY (which always has a default so the API
 * layer never has no identity to send). This one tracks whether *this tab*
 * went through the explicit Login screen — see App.tsx's login gate.
 */
const SESSION_KEY = 'hasLoggedIn';
export const isLoggedIn = () => sessionStorage.getItem(SESSION_KEY) === 'true';
export const login = (userId: string, storage: Storage = sessionStorage) => {
  storage.setItem(CURRENT_USER_KEY, userId);
  storage.setItem(SESSION_KEY, 'true');
};
export const logout = () => {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(CURRENT_USER_KEY);
};

/**
 * Canonical demo account for each role, so a presenter can deep-link straight
 * into a role's tab (e.g. `/?role=approver`) without clicking through the
 * account picker. These ids match buildDefaultUsers() in server.ts.
 */
const ROLE_DEEP_LINK: Record<string, string> = {
  requestor: 'u1', // Alice Reyes
  approver: 'u2',  // Bob Santos (Alice's manager)
  custodian: 'u3', // Carol Ramos
  finance: 'u22',  // Sofia Lim
  admin: 'u4',     // Dave Lopez
};

/**
 * Honour a `?role=` or `?uid=` query param by signing this tab in as that
 * account, then strip the param from the URL so a reload doesn't force the
 * identity back. Returns true if it logged the tab in. Called once at startup
 * before the login gate is evaluated.
 */
export const applyDeepLinkLogin = (): boolean => {
  const demoDeepLinksEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';
  if (!demoDeepLinksEnabled) return false;

  const params = new URLSearchParams(window.location.search);
  const roleParam = params.get('role')?.toLowerCase();
  const uidParam = params.get('uid');
  const targetId = uidParam || (roleParam ? ROLE_DEEP_LINK[roleParam] : undefined);
  if (!targetId) return false;

  login(targetId);
  params.delete('role');
  params.delete('uid');
  const cleaned = params.toString();
  const url = window.location.pathname + (cleaned ? `?${cleaned}` : '') + window.location.hash;
  window.history.replaceState({}, '', url);
  return true;
};

export interface ApiError extends Error {
  status?: number;
  body?: any;
}

export async function apiFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const currentUserId = getCurrentUserId();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(currentUserId ? { 'X-User-Id': currentUserId } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({} as any));
    const err = new Error(body.message || body.error || `${options.method || 'GET'} ${url} failed (${res.status})`) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * Attachments are served by a route that gates on identity, and browsers don't
 * send custom headers for <img> src — so the uid rides along as a query param.
 */
export const uploadUrl = (url?: string) => {
  if (!url) return undefined;
  if (!url.startsWith('/uploads/')) return url;
  return `${url}?uid=${encodeURIComponent(getCurrentUserId())}`;
};

export async function uploadFile(file: File): Promise<{ url: string; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'X-User-Id': getCurrentUserId() },
    body: form,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}
