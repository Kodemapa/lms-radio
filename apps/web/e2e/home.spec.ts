import { expect, test } from '@playwright/test';

test('redirects to the default locale and renders the landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('serves Hindi', async ({ page }) => {
  await page.goto('/hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
});

test('protected lessons redirect to sign-in', async ({ page }) => {
  await page.goto('/en/learn/certificate-course-in-fetal-medicine/6f1c2a3b-0000-4000-8000-000000000001');
  await expect(page).toHaveURL(/\/en\/login\?next=/);
});

test('skip link is the first focusable element', async ({ page }) => {
  await page.goto('/en');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /skip to main content/i })).toBeFocused();
});
