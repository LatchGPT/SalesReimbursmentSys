import { test, expect } from '@playwright/test';

test.describe('Next.js MVC Application and API', () => {
  test('serves health and readiness checks', async ({ request }) => {
    const health = await request.get('/healthz');
    expect(health.status()).toBe(200);
    const healthJson = await health.json();
    expect(healthJson.status).toBe('ok');

    const ready = await request.get('/readyz');
    expect([200, 503]).toContain(ready.status());
    const readyJson = await ready.json();
    expect(readyJson).toHaveProperty('status');
    expect(readyJson).toHaveProperty('database');
  });

  test('serves auth config endpoint', async ({ request }) => {
    const authConfig = await request.get('/api/auth/config');
    expect(authConfig.status()).toBe(200);
    const json = await authConfig.json();
    expect(json.provider).toBe('microsoft');
  });

  test('loads the web application interface', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sales Reimbursement|Reimbursement/i);
  });
});
