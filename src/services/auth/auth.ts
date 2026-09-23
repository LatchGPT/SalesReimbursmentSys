import { config } from '../../server/config';
import { state } from '../../server/state';
import { syncUsersToDb } from '../../lib/db/usersRepo';
import { serverEnv } from '../../config/env';

function findUser(userId: string | null) {
  if (!userId) return null;
  return state.users.find(u => u.id === userId || u.entra_object_id === userId || u.user_principal_name === userId) || null;
}

const microsoftAuth = {
  tenantId: serverEnv.microsoftTenantId,
  clientId: serverEnv.microsoftClientId,
  clientSecret: serverEnv.microsoftClientSecret,
  redirectUri: serverEnv.microsoftRedirectUri,
};
const microsoftAuthConfigured = Object.values(microsoftAuth).every(Boolean);

export function getAuthConfig() {
  return {
    status: 200,
    body: {
      provider: 'microsoft',
      mode: config.authMode,
      demoModeEnabled: config.demoMode,
      demoLoginEnabled: config.enableDemoLogin,
      microsoft: {
        configured: microsoftAuthConfigured,
        loginUrl: '/api/auth/microsoft/start',
      },
    },
  };
}

export function getMicrosoftStart() {
  if (!microsoftAuthConfigured) {
    return {
      status: 503,
      body: {
        code: 'MICROSOFT_AUTH_NOT_CONFIGURED',
        message: "Microsoft sign-in is awaiting the organization's Entra app registration.",
      },
    };
  }
  return {
    status: 501,
    body: {
      code: 'MICROSOFT_AUTH_ADAPTER_REQUIRED',
      message: 'Entra settings are present. Install the approved OIDC session adapter before enabling Microsoft sign-in.',
    },
  };
}

export function listDemoUsers() {
  if (!config.enableDemoLogin) {
    return { status: 404, body: { error: 'Demo login is disabled.' } };
  }
  return {
    status: 200,
    body: state.users.map(({ id, name, email, role, department, job_title, avatar_url }) => ({
      id,
      name,
      email,
      role,
      department,
      job_title,
      avatar_url,
    })),
  };
}

export function loginUser(body: unknown) {
  const email = (body as { email?: string })?.email;
  const user = state.users.find(u => u.email === email);
  if (user) {
    return { status: 200, body: user };
  }
  return { status: 401, body: { error: 'User not found' } };
}

export function getCurrentUser(userId: string | null) {
  const user = findUser(userId);
  if (!user) return { status: 401, body: { error: 'Unauthorized' } };
  return { status: 200, body: user };
}

export async function updateNotificationPrefs(userId: string | null, prefs: unknown) {
  const user = findUser(userId);
  if (!user) return { status: 401, body: { error: 'Unauthorized' } };
  user.notification_prefs = prefs as any;
  try {
    await syncUsersToDb(state.users);
  } catch (err) {
    console.error('[db] Could not persist notification preferences to Postgres:', err);
  }
  return { status: 200, body: user.notification_prefs };
}
