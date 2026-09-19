import { afterEach, describe, expect, it } from 'vitest';
import * as apiRoute from '../src/app/api/[[...path]]/route';
import { GET as apiHealth } from '../src/app/api/health/route';
import { GET as cron } from '../src/app/api/cron/hourly/route';
import { POST as upload } from '../src/app/api/upload/route';
import { POST as signUpload } from '../src/app/api/upload/sign/route';
import { GET as healthz } from '../src/app/healthz/route';
import { GET as readyz } from '../src/app/readyz/route';
import { GET as download } from '../src/app/uploads/[filename]/route';

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

async function callApi(path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, 'http://route-handler.test');
  const method = (init.method || 'GET').toUpperCase() as keyof typeof apiRoute;
  const handler = apiRoute[method] as typeof apiRoute.GET;
  const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  return handler(new Request(url, init), { params: Promise.resolve({ path: segments }) });
}

describe('Next.js Route Handler boundary', () => {
  it('preserves health and readiness response contracts', async () => {
    expect(await (await apiHealth()).json()).toEqual({ Health: 'ok!' });
    expect(await (await healthz()).json()).toEqual({ status: 'ok' });
    const ready = await readyz();
    expect(ready.status).toBe(200);
    expect((await ready.json()).database).toBe('not_configured');
  });

  it('returns explicit 404 and 405 JSON responses', async () => {
    const missing = await callApi('/api/does-not-exist');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Not found' });

    const wrongMethod = await callApi('/api/users', { method: 'DELETE' });
    expect(wrongMethod.status).toBe(405);
    expect(await wrongMethod.json()).toEqual({ error: 'Method not allowed' });
  });

  it('rejects malformed JSON before invoking a controller', async () => {
    const response = await callApi('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON body.' });
  });

  it('protects the Vercel cron endpoint with CRON_SECRET', async () => {
    delete process.env.CRON_SECRET;
    expect((await cron(new Request('http://route-handler.test/api/cron/hourly'))).status).toBe(503);

    process.env.CRON_SECRET = 'test-cron-secret';
    expect((await cron(new Request('http://route-handler.test/api/cron/hourly', {
      headers: { Authorization: 'Bearer wrong-secret' },
    }))).status).toBe(401);
  });

  it('keeps upload validation and legacy download authorization at Route Handlers', async () => {
    const unauthorizedUpload = await upload(new Request('http://route-handler.test/api/upload', {
      method: 'POST',
      body: new FormData(),
    }));
    expect(unauthorizedUpload.status).toBe(401);

    const missingFile = await upload(new Request('http://route-handler.test/api/upload', {
      method: 'POST',
      headers: { 'X-User-Id': 'u1' },
      body: new FormData(),
    }));
    expect(missingFile.status).toBe(400);
    expect(await missingFile.json()).toEqual({ error: 'No file uploaded' });

    const unsigned = await signUpload(new Request('http://route-handler.test/api/upload/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'u1',
      },
      body: JSON.stringify({ name: 'receipt.pdf', size: 1024, type: 'application/pdf' }),
    }));
    expect(unsigned.status).toBe(503);
    expect(await unsigned.json()).toEqual({ error: 'Upload storage is not configured.' });

    const missingDownload = await download(
      new Request('http://route-handler.test/uploads/not-linked.pdf', {
        headers: { 'X-User-Id': 'u1' },
      }),
      { params: Promise.resolve({ filename: 'not-linked.pdf' }) },
    );
    expect(missingDownload.status).toBe(404);
  });
});
