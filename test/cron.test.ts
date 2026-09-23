import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runHourlyMaintenance } from '../src/services/jobs/hourlyMaintenance';

describe('cron: runHourlyMaintenance', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 503 when cronSecret is not configured', async () => {
    const original = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      const req = new Request('http://localhost:3000/api/cron/hourly', {
        headers: { authorization: 'Bearer some-secret' },
      });
      const res = await runHourlyMaintenance(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data).toEqual({ error: 'Cron is not configured.' });
    } finally {
      if (original !== undefined) process.env.CRON_SECRET = original;
      else delete process.env.CRON_SECRET;
    }
  });

  it('returns 401 when authorization header is missing or incorrect', async () => {
    const original = process.env.CRON_SECRET;
    try {
      process.env.CRON_SECRET = 'valid-cron-secret-123';
      const reqNoAuth = new Request('http://localhost:3000/api/cron/hourly');
      const resNoAuth = await runHourlyMaintenance(reqNoAuth);
      expect(resNoAuth.status).toBe(401);
      const dataNoAuth = await resNoAuth.json();
      expect(dataNoAuth).toEqual({ error: 'Unauthorized' });

      const reqWrongAuth = new Request('http://localhost:3000/api/cron/hourly', {
        headers: { authorization: 'Bearer wrong-secret' },
      });
      const resWrongAuth = await runHourlyMaintenance(reqWrongAuth);
      expect(resWrongAuth.status).toBe(401);
    } finally {
      if (original !== undefined) process.env.CRON_SECRET = original;
      else delete process.env.CRON_SECRET;
    }
  });

  it('runs hourly maintenance successfully with valid secret', async () => {
    const original = process.env.CRON_SECRET;
    try {
      process.env.CRON_SECRET = 'valid-cron-secret-123';
      const req = new Request('http://localhost:3000/api/cron/hourly', {
        headers: { authorization: 'Bearer valid-cron-secret-123' },
      });
      const res = await runHourlyMaintenance(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(typeof data.expiredDelegations).toBe('number');
      expect(typeof data.escalatedClaims).toBe('number');
    } finally {
      if (original !== undefined) process.env.CRON_SECRET = original;
      else delete process.env.CRON_SECRET;
    }
  });
});
