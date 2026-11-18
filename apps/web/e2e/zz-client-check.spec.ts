import { expect, test } from '@playwright/test';

// Temporary check (deleted after running): client render must have no errors.
test('pages and admin sidebar render in the browser without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon|hydrat/i.test(m.text())) errors.push('console: ' + m.text());
  });

  for (const path of ['/en', '/en/courses', '/en/login']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  await page.getByLabel(/email or mobile/i).fill('admin@example.com');
  await page.getByLabel(/^password/i).fill(process.env.ADMIN_PW ?? '');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/en\/admin$/, { timeout: 30_000 });

  const links = ['Users', 'Categories', 'Audit', 'Inbox', 'Languages', 'Settings', 'Dashboard'];
  for (const name of links) {
    await page.getByRole('navigation').getByRole('link', { name: new RegExp(name, 'i') }).first().click();
    await page.waitForLoadState('networkidle');
  }
  await expect(page.getByRole('button', { name: /theme/i })).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});
