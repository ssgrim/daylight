import { test, expect } from '@playwright/test';

test.describe('Smooth UI Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plan');
    // Wait for the page to load
    await expect(page.getByTestId('search-form')).toBeVisible();
  });

  test('should show debounced search with loading states', async ({ page }) => {
    const searchInput = page.getByTestId('search-input');
    
    // Start typing - should show character count
    await searchInput.fill('pasade');
    await expect(page.getByText('Auto-searching as you type... (6/120 characters)')).toBeVisible();
    
    // Should show loading skeleton after debounce delay
    await expect(page.getByTestId('search-results-skeleton')).toBeVisible({ timeout: 1000 });
    
    // Complete the search
    await searchInput.fill('pasadena coffee');
    
    // Should eventually show results or error
    await expect(page.getByTestId('loading-indicator').or(page.getByTestId('results-container')).or(page.getByTestId('error-message'))).toBeVisible({ timeout: 10000 });
  });

  test('should show skeleton loaders while fetching', async ({ page }) => {
    const searchInput = page.getByTestId('search-input');
    
    // Type search query
    await searchInput.fill('pasadena coffee');
    
    // Should show skeleton loaders
    await expect(page.getByTestId('search-results-skeleton')).toBeVisible({ timeout: 1000 });
    await expect(page.getByTestId('place-skeleton')).toBeVisible();
    
    // Skeleton should disappear when results load
    await expect(page.getByTestId('search-results-skeleton')).not.toBeVisible({ timeout: 10000 });
  });

  test('should show retry button on error', async ({ page }) => {
    // Mock a failing request
    await page.route('**/places*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('test query');
    
    // Should show error message with retry button
    await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 2000 });
    await expect(page.getByTestId('retry-button')).toBeVisible();
    
    // Should show error toast
    await expect(page.getByTestId('toast-error')).toBeVisible();
  });

  test('should handle retry functionality', async ({ page }) => {
    let requestCount = 0;
    
    // Mock first request to fail, second to succeed
    await page.route('**/places*', route => {
      requestCount++;
      if (requestCount === 1) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            query: 'test query',
            count: 1,
            results: [{
              name: 'Test Place',
              address: '123 Test St',
              place_id: 'test123',
              rating: 4.5
            }]
          })
        });
      }
    });
    
    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('test query');
    
    // Wait for error and retry button
    await expect(page.getByTestId('error-message')).toBeVisible();
    const retryButton = page.getByTestId('retry-button');
    await expect(retryButton).toBeVisible();
    
    // Click retry
    await retryButton.click();
    
    // Should show loading state on retry
    await expect(page.getByTestId('loading-spinner')).toBeVisible();
    
    // Should eventually show results
    await expect(page.getByTestId('results-container')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Test Place')).toBeVisible();
  });

  test('should show toast notifications', async ({ page }) => {
    // Mock successful response
    await page.route('**/places*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'coffee',
          count: 2,
          results: [
            { name: 'Coffee Shop 1', address: '123 Main St', place_id: 'test1' },
            { name: 'Coffee Shop 2', address: '456 Oak Ave', place_id: 'test2' }
          ]
        })
      });
    });
    
    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('coffee');
    
    // Should show success toast
    await expect(page.getByTestId('toast-success')).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Found 2 places for "coffee"')).toBeVisible();
    
    // Toast should auto-dismiss
    await expect(page.getByTestId('toast-success')).not.toBeVisible({ timeout: 4000 });
  });

  test('should show loading indicator in search input', async ({ page }) => {
    const searchInput = page.getByTestId('search-input');
    
    await searchInput.fill('pasadena coffee');
    
    // Should show spinner in the input field
    await expect(page.locator('input[data-testid="search-input"] + div svg')).toBeVisible({ timeout: 1000 });
  });

  test('should clear results when query is cleared', async ({ page }) => {
    // Mock successful response
    await page.route('**/places*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'coffee',
          count: 1,
          results: [{ name: 'Coffee Shop', address: '123 Main St', place_id: 'test1' }]
        })
      });
    });
    
    const searchInput = page.getByTestId('search-input');
    
    // Search for something
    await searchInput.fill('coffee');
    await expect(page.getByTestId('results-container')).toBeVisible({ timeout: 2000 });
    
    // Clear the search
    await searchInput.clear();
    
    // Results should be cleared immediately
    await expect(page.getByTestId('results-container')).not.toBeVisible();
    await expect(page.getByTestId('welcome-state')).toBeVisible();
  });

  test('should show welcome state initially', async ({ page }) => {
    await expect(page.getByTestId('welcome-state')).toBeVisible();
    await expect(page.getByText('Ready to explore?')).toBeVisible();
    await expect(page.getByText('Try searching for "pasadena coffee"')).toBeVisible();
  });

  test('should show proper no results state', async ({ page }) => {
    // Mock empty response
    await page.route('**/places*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'nonexistent place',
          count: 0,
          results: []
        })
      });
    });
    
    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('nonexistent place');
    
    // Should show no results state with retry option
    await expect(page.getByTestId('no-results')).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('No places found for "nonexistent place"')).toBeVisible();
    await expect(page.getByText('Search Again')).toBeVisible();
  });
});
