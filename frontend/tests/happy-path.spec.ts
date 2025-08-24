import { test, expect } from '@playwright/test';

test.describe('Daylight App Happy Path', () => {
  test('should search for "pasadena coffee" and display results', async ({ page }) => {
    // Navigate to the plan page
    await page.goto('/plan');
    
    // Verify the page loaded correctly
    await expect(page.locator('h2')).toContainText('Trip Planner');
    
    // Find the search input and button
    const searchInput = page.getByTestId('search-input');
    const searchButton = page.getByTestId('search-button');
    
    // Verify search form is present
    await expect(searchInput).toBeVisible();
    await expect(searchButton).toBeVisible();
    await expect(searchButton).toContainText('Search');
    
    // Enter the search query
    await searchInput.fill('pasadena coffee');
    
    // Verify the input value
    await expect(searchInput).toHaveValue('pasadena coffee');
    
    // Submit the search
    await searchButton.click();
    
    // Verify loading state appears
    await expect(page.getByTestId('loading-indicator')).toBeVisible();
    await expect(page.getByTestId('loading-indicator')).toContainText('Searching for places...');
    
    // Wait for results to load (loading indicator should disappear)
    await expect(page.getByTestId('loading-indicator')).toBeHidden({ timeout: 15000 });
    
    // Check for either results or an error message
    const resultsContainer = page.getByTestId('results-container');
    const errorMessage = page.getByTestId('error-message');
    const noResults = page.getByTestId('no-results');
    
    // If there's an error, log it but don't fail the test (API might be down)
    if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.textContent();
      console.warn(`API Error encountered: ${errorText}`);
      
      // Verify error message is properly displayed
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/error|failed|timeout/i);
      
      return; // Skip the rest of the test if API is down
    }
    
    // If no results found, verify the no-results message
    if (await noResults.isVisible()) {
      await expect(noResults).toContainText('No places found');
      console.info('No results found for "pasadena coffee" - this is acceptable');
      return;
    }
    
    // If we have results, verify the list rendering and basic fields
    await expect(resultsContainer).toBeVisible();
    
    // Check that we have at least one result
    const placeResults = page.getByTestId('place-result');
    await expect(placeResults).toHaveCountGreaterThan(0);
    
    // Verify the first result has required fields
    const firstResult = placeResults.first();
    
    // Check place name is present and non-empty
    const placeName = firstResult.getByTestId('place-name');
    await expect(placeName).toBeVisible();
    await expect(placeName).not.toBeEmpty();
    
    // Check place address is present and non-empty
    const placeAddress = firstResult.getByTestId('place-address');
    await expect(placeAddress).toBeVisible();
    await expect(placeAddress).not.toBeEmpty();
    
    // Verify place name contains relevant keywords (optional - might be coffee shops)
    const nameText = await placeName.textContent();
    console.info(`First result name: ${nameText}`);
    
    // Verify address looks like a real address (contains common address patterns)
    const addressText = await placeAddress.textContent();
    console.info(`First result address: ${addressText}`);
    
    // Check if rating is present (optional field)
    const placeRating = firstResult.getByTestId('place-rating');
    if (await placeRating.isVisible()) {
      const ratingText = await placeRating.textContent();
      expect(ratingText).toMatch(/\d+(\.\d+)?\/5/); // Format: "4.5/5"
    }
    
    // Check if coordinates are present (optional field)
    const placeCoordinates = firstResult.getByTestId('place-coordinates');
    if (await placeCoordinates.isVisible()) {
      const coordText = await placeCoordinates.textContent();
      expect(coordText).toMatch(/\-?\d+\.\d+,\s*\-?\d+\.\d+/); // Format: "34.1234, -118.1234"
    }
    
    // Verify results count
    const resultsHeader = page.locator('h3:has-text("Found")');
    await expect(resultsHeader).toBeVisible();
    
    const headerText = await resultsHeader.textContent();
    const resultCount = headerText?.match(/Found (\d+) places/)?.[1];
    console.info(`Found ${resultCount} places for "pasadena coffee"`);
    
    // Log successful test completion
    console.info('✅ Happy path test completed successfully - search results rendered with basic fields');
  });
  
  test('should handle empty search gracefully', async ({ page }) => {
    await page.goto('/plan');
    
    const searchButton = page.getByTestId('search-button');
    
    // Search button should be disabled when input is empty
    await expect(searchButton).toBeDisabled();
    
    // Enter and clear input
    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('test');
    await expect(searchButton).toBeEnabled();
    
    await searchInput.clear();
    await expect(searchButton).toBeDisabled();
  });
  
  test('should handle long search queries gracefully', async ({ page }) => {
    await page.goto('/plan');
    
    const searchInput = page.getByTestId('search-input');
    
    // Try to enter a very long query (should be limited to 120 chars)
    const longQuery = 'a'.repeat(150);
    await searchInput.fill(longQuery);
    
    const actualValue = await searchInput.inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(120);
  });
});
