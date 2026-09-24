import { test, expect } from '@playwright/test';

test.describe('Sidebar Logo Toggle & Responsive Behavior', () => {
  test('displays full logo when expanded and Saturn icon when collapsed', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/?role=approver');

    const aside = page.locator('aside');
    await expect(aside).toBeVisible();

    const fullLogo = aside.locator('img[alt="Microgenesis"]').last();
    const saturnIcon = aside.locator('img[alt="Microgenesis"]').first();

    // 1. In expanded state: full logo should be visible
    await expect(fullLogo).toBeVisible();

    // 2. Click collapse toggle button
    const collapseButton = page.getByRole('button', { name: 'Collapse sidebar' });
    await expect(collapseButton).toBeVisible();
    await collapseButton.click();

    // 3. In collapsed state: Saturn icon should be visible
    await expect(saturnIcon).toBeVisible();
    const expandButton = page.getByRole('button', { name: 'Expand sidebar' });
    await expect(expandButton).toBeVisible();

    // Verify Saturn icon dimensions and exact vertical center alignment (header height = 64px, center = 32px)
    const iconBox = await saturnIcon.boundingBox();
    expect(iconBox).not.toBeNull();
    expect(iconBox!.width).toBe(48);
    expect(iconBox!.height).toBe(48);
    expect(iconBox!.y + iconBox!.height / 2).toBe(32);

    // 4. Click expand toggle button to restore
    await expandButton.click();
    await expect(fullLogo).toBeVisible();
  });

  test('handles narrow mobile viewport properly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/?role=approver');

    // On mobile, the hamburger menu is visible
    const menuButton = page.getByRole('button', { name: 'Toggle sidebar' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // When drawer opens, full logo is visible in sidebar drawer
    const aside = page.locator('aside');
    await expect(aside).toBeVisible();
    const fullLogo = aside.locator('img[alt="Microgenesis"]').last();
    await expect(fullLogo).toBeVisible();

    // Mobile close button is present
    const closeButton = page.getByRole('button', { name: 'Close sidebar' });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
  });
});
