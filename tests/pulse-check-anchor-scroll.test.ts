import { test, expect } from '@playwright/test';

// This test assumes you have Playwright set up and a running local dev server
// Adjust selectors and URLs as needed for your app

test('anchor scroll and metrics update after check-in', async ({ page }) => {
  // Go to the pulse-check5 page
  await page.goto('/pulse-check5');

  // Simulate a check-in (replace with actual UI interaction if needed)
  // Example: await page.click('button[data-testid="force-check-in"]');

  // Click the Cars metric tile
  await page.click('button:has-text("Cars")');

  // Should navigate to daily view and scroll to the current shop row
  await page.waitForSelector('tr[id^="shop-"]', { state: 'visible' });

  // Optionally, check that the row is highlighted
  const highlighted = await page.$('tr[id^="shop-"][data-highlighted="true"]');
  expect(highlighted).not.toBeNull();

  // Optionally, verify metrics updated (replace with actual metric selector)
  const carsValue = await page.textContent('tr[id^="shop-"] td[data-metric="cars"]');
  expect(Number(carsValue)).toBeGreaterThan(0);
});
