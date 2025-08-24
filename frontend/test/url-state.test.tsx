/**
 * Frontend Tests for URL State Management
 * 
 * Tests the URL parameter handling and state persistence for pagination, sorting, and filtering.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiBaseContext } from '../../src/main';
import Plan from '../../src/pages/Plan';

// Mock the API client
jest.mock('../../src/lib/apiClient', () => ({
  createApiClient: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({
      query: 'test',
      results: [
        {
          name: 'Test Place',
          address: '123 Test St',
          rating: 4.5,
          place_id: 'test_id',
          location: { lat: 37.7749, lng: -122.4194 },
          category: 'restaurant'
        }
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalResults: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      },
      metadata: {
        provider: 'mock',
        duration: 100,
        cached: false
      }
    })
  })),
  isRateLimitError: jest.fn(() => false),
  getRateLimitInfo: jest.fn(() => ({ isRateLimited: false }))
}));

// Mock other components
jest.mock('../../src/components/MapView', () => {
  return function MockMapView() {
    return <div data-testid="map-view">Map View</div>;
  };
});

jest.mock('../../src/hooks/useDebounce', () => ({
  useDebounce: jest.fn((value) => value)
}));

const renderPlanWithRouter = (initialUrl = '/plan') => {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <ApiBaseContext.Provider value="http://localhost:3000/api">
        <Plan />
      </ApiBaseContext.Provider>
    </MemoryRouter>
  );
};

describe('Plan Component URL State Management', () => {
  let mockApiGet: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    const { createApiClient } = require('../../src/lib/apiClient');
    const mockClient = createApiClient();
    mockApiGet = mockClient.get;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('URL Parameter Initialization', () => {
    it('should initialize search from URL query parameter', async () => {
      renderPlanWithRouter('/plan?q=coffee%20shops');

      await waitFor(() => {
        const searchInput = screen.getByTestId('search-input') as HTMLInputElement;
        expect(searchInput.value).toBe('coffee shops');
      });

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('query=coffee%20shops')
        );
      });
    });

    it('should initialize pagination from URL parameters', async () => {
      renderPlanWithRouter('/plan?q=restaurants&page=2&pageSize=10');

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('page=2&pageSize=10')
        );
      });
    });

    it('should initialize sort and category from URL parameters', async () => {
      renderPlanWithRouter('/plan?q=places&sort=rating&category=restaurant');

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('sort=rating')
        );
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('category=restaurant')
        );
      });

      // Check that the UI controls reflect the URL state
      const sortSelect = screen.getByTestId('sort-select') as HTMLSelectElement;
      const categorySelect = screen.getByTestId('category-select') as HTMLSelectElement;
      
      expect(sortSelect.value).toBe('rating');
      expect(categorySelect.value).toBe('restaurant');
    });
  });

  describe('URL Updates on User Interaction', () => {
    it('should update URL when changing sort option', async () => {
      const { container } = renderPlanWithRouter('/plan?q=test');

      // Wait for initial search
      await waitFor(() => {
        expect(screen.getByTestId('sort-select')).toBeInTheDocument();
      });

      // Change sort option
      const sortSelect = screen.getByTestId('sort-select');
      fireEvent.change(sortSelect, { target: { value: 'rating' } });

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('sort=rating')
        );
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('page=1') // Should reset to page 1
        );
      });
    });

    it('should update URL when changing category filter', async () => {
      renderPlanWithRouter('/plan?q=test');

      await waitFor(() => {
        expect(screen.getByTestId('category-select')).toBeInTheDocument();
      });

      const categorySelect = screen.getByTestId('category-select');
      fireEvent.change(categorySelect, { target: { value: 'restaurant' } });

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('category=restaurant')
        );
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('page=1') // Should reset to page 1
        );
      });
    });

    it('should update URL when changing page size', async () => {
      renderPlanWithRouter('/plan?q=test');

      await waitFor(() => {
        expect(screen.getByTestId('pagesize-select')).toBeInTheDocument();
      });

      const pageSizeSelect = screen.getByTestId('pagesize-select');
      fireEvent.change(pageSizeSelect, { target: { value: '50' } });

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('pageSize=50')
        );
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('page=1') // Should reset to page 1
        );
      });
    });

    it('should update URL when navigating pages', async () => {
      // Mock response with pagination
      mockApiGet.mockResolvedValue({
        query: 'test',
        results: Array.from({ length: 20 }, (_, i) => ({
          name: `Place ${i}`,
          address: `${i} Test St`,
          place_id: `place_${i}`,
          category: 'restaurant'
        })),
        pagination: {
          page: 1,
          pageSize: 20,
          totalResults: 100,
          totalPages: 5,
          hasNextPage: true,
          hasPreviousPage: false
        },
        metadata: {
          provider: 'mock',
          duration: 100,
          cached: false
        }
      });

      renderPlanWithRouter('/plan?q=test');

      await waitFor(() => {
        expect(screen.getByTestId('next-page-button')).toBeInTheDocument();
      });

      const nextButton = screen.getByTestId('next-page-button');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('page=2')
        );
      });
    });
  });

  describe('URL State Persistence', () => {
    it('should maintain all URL parameters when changing one', async () => {
      renderPlanWithRouter('/plan?q=restaurants&page=2&sort=rating&category=restaurant&pageSize=10');

      await waitFor(() => {
        expect(screen.getByTestId('sort-select')).toBeInTheDocument();
      });

      // Change only the sort option
      const sortSelect = screen.getByTestId('sort-select');
      fireEvent.change(sortSelect, { target: { value: 'distance' } });

      await waitFor(() => {
        const lastCall = mockApiGet.mock.calls[mockApiGet.mock.calls.length - 1][0];
        expect(lastCall).toContain('query=restaurants');
        expect(lastCall).toContain('sort=distance');
        expect(lastCall).toContain('category=restaurant');
        expect(lastCall).toContain('pageSize=10');
        expect(lastCall).toContain('page=1'); // Should reset page on sort change
      });
    });

    it('should clear URL parameters when search is cleared', async () => {
      renderPlanWithRouter('/plan?q=test&page=2&sort=rating');

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument();
      });

      // Clear the search input
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: '' } });

      await waitFor(() => {
        // Should not make API calls when query is empty
        expect(mockApiGet).not.toHaveBeenCalledWith(
          expect.stringContaining('query=')
        );
      });
    });
  });

  describe('Default Parameter Handling', () => {
    it('should use defaults for missing URL parameters', async () => {
      renderPlanWithRouter('/plan?q=test');

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('page=1&pageSize=20&sort=relevance')
        );
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.not.stringContaining('category=')
        );
      });

      // Check UI reflects defaults
      const sortSelect = screen.getByTestId('sort-select') as HTMLSelectElement;
      const categorySelect = screen.getByTestId('category-select') as HTMLSelectElement;
      const pageSizeSelect = screen.getByTestId('pagesize-select') as HTMLSelectElement;

      expect(sortSelect.value).toBe('relevance');
      expect(categorySelect.value).toBe('');
      expect(pageSizeSelect.value).toBe('20');
    });

    it('should handle invalid URL parameter values gracefully', async () => {
      renderPlanWithRouter('/plan?q=test&page=invalid&sort=invalid&category=invalid&pageSize=999');

      await waitFor(() => {
        const lastCall = mockApiGet.mock.calls[mockApiGet.mock.calls.length - 1][0];
        expect(lastCall).toContain('page=1'); // Invalid page should default to 1
        expect(lastCall).toContain('pageSize=20'); // Invalid pageSize should default to 20
        expect(lastCall).toContain('sort=relevance'); // Invalid sort should default to relevance
        expect(lastCall).not.toContain('category='); // Invalid category should be omitted
      });
    });
  });

  describe('Search Interaction', () => {
    it('should reset pagination when starting new search', async () => {
      renderPlanWithRouter('/plan?q=old-query&page=3&sort=rating');

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument();
      });

      // Type new search
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'new search query' } });

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('query=new%20search%20query')
        );
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('page=1') // Should reset to page 1
        );
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('sort=rating') // Should maintain other params
        );
      });
    });

    it('should handle manual search form submission', async () => {
      renderPlanWithRouter('/plan');

      const searchInput = screen.getByTestId('search-input');
      const searchButton = screen.getByTestId('search-button');

      fireEvent.change(searchInput, { target: { value: 'manual search' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('query=manual%20search')
        );
      });
    });
  });

  describe('Browser Navigation', () => {
    it('should work with browser back/forward navigation', async () => {
      // This test would require more complex setup with router history
      // For now, we verify that URL changes trigger the appropriate effects
      const { rerender } = renderPlanWithRouter('/plan?q=test&page=1');

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('page=1')
        );
      });

      // Simulate navigation to different URL
      rerender(
        <MemoryRouter initialEntries={['/plan?q=test&page=2']}>
          <ApiBaseContext.Provider value="http://localhost:3000/api">
            <Plan />
          </ApiBaseContext.Provider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          expect.stringContaining('page=2')
        );
      });
    });
  });
});
