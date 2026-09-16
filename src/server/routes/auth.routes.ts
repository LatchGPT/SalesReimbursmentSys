import { Router } from 'express';
import { config } from '../config';
import { state } from '../state';
import { getUser } from '../middleware/auth';
import { syncUsersToDb } from '../../db/usersRepo';

export const authRouter = Router();

const microsoftAuth = {
  tenantId: process.env.MICROSOFT_TENANT_ID || process.env.TENANT_ID || '',
  clientId: process.env.MICROSOFT_CLIENT_ID || process.env.CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || process.env.CLIENT_SECRET || '',
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || process.env.OAUTH_REDIRECT_URI || '',
};
const microsoftAuthConfigured = Object.values(microsoftAuth).every(Boolean);

authRouter.get('/auth/config', (_req, res) => {
  res.json({
    provider: 'microsoft',
    mode: config.authMode,
    demoModeEnabled: config.demoMode,
    demoLoginEnabled: config.enableDemoLogin,
    microsoft: {
      configured: microsoftAuthConfigured,
      loginUrl: '/api/auth/microsoft/start',
    },
  });
});

authRouter.get('/auth/microsoft/start', (_req, res) => {
  if (!microsoftAuthConfigured) {
    return res.status(503).json({
      code: 'MICROSOFT_AUTH_NOT_CONFIGURED',
      message: 'Microsoft sign-in is awaiting the organization\'s Entra app registration.',
    });
  }
  return res.status(501).json({
    code: 'MICROSOFT_AUTH_ADAPTER_REQUIRED',
    message: 'Entra settings are present. Install the approved OIDC session adapter before enabling Microsoft sign-in.',
  });
});

authRouter.get('/demo-users', (_req, res) => {
  if (!config.enableDemoLogin) {
    return res.status(404).json({ error: 'Demo login is disabled.' });
  }
  res.json(state.users.map(({ id, name, email, role, department, job_title, avatar_url }) => ({
    id,
    name,
    email,
    role,
    department,
    job_title,
    avatar_url,
  })));
});

authRouter.post('/login', (req, res) => {
  const { email } = req.body;
  const user = state.users.find(u => u.email === email);
  if (user) {
    res.json(user);
  } else {
    res.status(401).json({ error: 'User not found' });
  }
});

authRouter.get('/me', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(user);
});

authRouter.put('/me/notification-prefs', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  user.notification_prefs = req.body;
  try {
    await syncUsersToDb(state.users);
  } catch (err) {
    console.error('[db] Could not persist notification preferences to Postgres:', err);
  }
  res.json(user.notification_prefs);
});
