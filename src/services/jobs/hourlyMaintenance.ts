import { hydrateServerlessState } from '../../server/stateLoader';
import { syncDelegationStatuses } from '../../server/services/delegations';
import { runStaleApproverFallbackCheck } from '../../server/services/hierarchy';
import { withPersistenceScope } from '../../lib/db/persistenceScope';
import { serverEnv } from '../../config/env';

const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

export async function runHourlyMaintenance(request: Request): Promise<Response> {
  const secret = serverEnv.cronSecret;
  if (!secret) return json({ error: 'Cron is not configured.' }, 503);
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { expiredDelegations, escalatedClaims } = await withPersistenceScope(async () => {
      await hydrateServerlessState();
      const expired = await syncDelegationStatuses();
      const escalated = await runStaleApproverFallbackCheck(false, 'system');
      return { expiredDelegations: expired, escalatedClaims: escalated };
    });
    return json({
      ok: true,
      expiredDelegations,
      escalatedClaims: escalatedClaims.length,
    });
  } catch (error) {
    console.error('[cron] Hourly maintenance failed:', error);
    return json({ error: 'Hourly maintenance failed.' }, 500);
  }
}
