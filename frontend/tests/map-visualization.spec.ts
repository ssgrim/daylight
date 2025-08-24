import { test, expect } from '@playwright/test';

// Test both list and map views
test('should visualize results on map with toggle', async ({ page }) => {
  // Start the frontend server
  await page.goto('http://localhost:5173/plan');

  // Verify initial page load
  await expect(page.getByTestId('search-input')).toBeVisible();

  // Search for places
  await page.fill('[data-testid="search-input"]', 'pasadena coffee');
  
  // Wait for search results
  await expect(page.getByTestId('results-container')).toBeVisible({ timeout: 10000 });
  
  // Verify we have results in list view by default
  const results = page.getByTestId('place-result');
  await expect(results.first()).toBeVisible();
  
  // Verify basic place information is displayed
  await expect(page.getByTestId('place-name').first()).toContainText(/coffee|cafe/i);
  await expect(page.getByTestId('place-address').first()).toBeVisible();

  // Test view toggle functionality
  const viewToggle = page.locator('[data-testid="view-toggle"]').or(
    page.locator('button').filter({ hasText: 'Map' })
  );
  
  // Switch to map view
  await viewToggle.click();
  
  // Verify map container is visible
  await expect(page.getByTestId('map-container')).toBeVisible();
  
  // Verify map is loaded (check for Mapbox canvas or container)
  const mapContainer = page.getByTestId('map-container');
  await expect(mapContainer).toBeVisible();
  
  // If Mapbox token is available, verify map loaded properly
  const hasMapboxToken = await page.evaluate(() => {
    return !!(window as any).import?.meta?.env?.VITE_MAPBOX_TOKEN;
  });
  
  if (hasMapboxToken) {
    // Check for Mapbox canvas element (indicates map loaded)
    await expect(mapContainer.locator('canvas')).toBeVisible({ timeout: 5000 });
    
    // Check for results count badge on map
    await expect(page.locator('text=/\\d+ of \\d+ locations/')).toBeVisible();
  } else {
    // Verify placeholder message when no token
    await expect(page.locator('text=Map requires Mapbox token')).toBeVisible();
  }
  
  // Switch back to list view
  const listButton = page.locator('button').filter({ hasText: 'List' });
  await listButton.click();
  
  // Verify we're back to list view
  await expect(page.getByTestId('place-result').first()).toBeVisible();
  
  // Verify that results persist across view changes
  const resultsCount = await page.getByTestId('place-result').count();
  expect(resultsCount).toBeGreaterThan(0);
});

// Test map without Mapbox token
test('should show placeholder when Mapbox token is missing', async ({ page }) => {
  // Mock missing Mapbox token
  await page.addInitScript(() => {
    Object.defineProperty(window, 'import', {
      value: {
        meta: {
          env: {
            VITE_MAPBOX_TOKEN: undefined
          }
        }
      }
    });
  });

  await page.goto('http://localhost:5173/plan');
  
  // Search for places
  await page.fill('[data-testid="search-input"]', 'coffee');
  
  // Wait for results
  await expect(page.getByTestId('results-container')).toBeVisible({ timeout: 10000 });
  
  // Switch to map view
  await page.locator('button').filter({ hasText: 'Map' }).click();
  
  // Verify placeholder is shown
  await expect(page.locator('text=Map requires Mapbox token')).toBeVisible();
  await expect(page.locator('text=Set VITE_MAPBOX_TOKEN in .env')).toBeVisible();
});

// Test map markers and popups (when token is available)
test('should show markers with popups on map', async ({ page }) => {
  const hasMapboxToken = process.env.VITE_MAPBOX_TOKEN;
  test.skip(!hasMapboxToken, 'Mapbox token required for this test');

  await page.goto('http://localhost:5173/plan');
  
  // Search for places
  await page.fill('[data-testid="search-input"]', 'pasadena coffee');
  
  // Wait for results
  await expect(page.getByTestId('results-container')).toBeVisible({ timeout: 10000 });
  
  // Switch to map view
  await page.locator('button').filter({ hasText: 'Map' }).click();
  
  // Wait for map to load
  await expect(page.getByTestId('map-container').locator('canvas')).toBeVisible({ timeout: 10000 });
  
  // Look for map markers (Mapbox markers have specific classes)
  const markers = page.locator('.mapboxgl-marker');
  await expect(markers.first()).toBeVisible({ timeout: 5000 });
  
  // Click on a marker to open popup
  await markers.first().click();
  
  // Verify popup appears with place information
  const popup = page.locator('.mapboxgl-popup');
  await expect(popup).toBeVisible({ timeout: 3000 });
  
  // Verify popup contains place information
  await expect(popup).toContainText(/coffee|cafe/i);
});
