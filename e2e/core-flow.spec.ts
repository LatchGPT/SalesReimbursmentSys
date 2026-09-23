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

  test('keeps approval rows stable and opens the last Actions menu above the viewport edge', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/?role=approver');
    await page.getByRole('link', { name: 'Approvals' }).click();

    const actionButtons = page.getByRole('button', { name: 'Actions' });
    await expect(actionButtons.first()).toBeVisible();
    const actionButton = actionButtons.last();
    await actionButton.scrollIntoViewIfNeeded();
    await actionButton.evaluate(button => {
      window.scrollBy(0, button.getBoundingClientRect().bottom - window.innerHeight + 16);
    });

    const row = actionButton.locator('xpath=ancestor::tr');
    const rowHeightBefore = await row.evaluate(element => element.getBoundingClientRect().height);
    const buttonBox = await actionButton.boundingBox();
    await actionButton.click();

    const menu = page.locator('body > [role="menu"]');
    await expect(menu).toBeVisible();
    expect(await row.evaluate(element => element.getBoundingClientRect().height)).toBe(rowHeightBefore);
    expect(await row.locator('[role="menu"]').count()).toBe(0);

    const menuBox = await menu.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(720);
    expect(menuBox!.y).toBeLessThan(buttonBox!.y);
  });
});
