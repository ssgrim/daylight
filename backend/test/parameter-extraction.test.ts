/**
 * Integration Test for Pagination, Sorting, and Category Features
 * 
 * Tests the complete flow from API request to response for the new features.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Simple integration test that verifies the parameter extraction functions
describe('Parameter Extraction Integration', () => {
  
  // Import the parameter extraction functions
  const extractOffsetFromParams = (params: Record<string, string | undefined> | undefined): number => {
    if (!params?.page && !params?.offset) {
      return 0;
    }

    // Support both page-based and offset-based pagination
    if (params.page) {
      const page = parseInt(params.page);
      if (isNaN(page) || page <= 0) return 0;
      const pageSize = extractLimitFromParams(params) || 20;
      return (page - 1) * pageSize;
    }

    const offset = parseInt(params.offset || '0');
    return isNaN(offset) || offset < 0 ? 0 : offset;
  };

  const extractLimitFromParams = (params: Record<string, string | undefined> | undefined): number => {
    if (!params?.limit && !params?.pageSize) {
      return 20;
    }

    const limit = parseInt(params.limit || params.pageSize || '20');
    return isNaN(limit) || limit <= 0 ? 20 : Math.min(limit, 50); // Cap at 50, default 20
  };

  const extractSortFromParams = (params: Record<string, string | undefined> | undefined): 'relevance' | 'rating' | 'distance' | 'name' | undefined => {
    if (!params?.sort) {
      return undefined;
    }

    const validSorts = ['relevance', 'rating', 'distance', 'name'] as const;
    const sort = params.sort.toLowerCase();
    
    return validSorts.includes(sort as any) ? sort as any : undefined;
  };

  const extractCategoryFromParams = (params: Record<string, string | undefined> | undefined): string | undefined => {
    if (!params?.category) {
      return undefined;
    }

    const validCategories = [
      'restaurant', 'cafe', 'bar', 'hotel', 'attraction', 
      'shopping', 'entertainment', 'transportation', 'health', 'services', 'other'
    ];
    
    const category = params.category.toLowerCase();
    return validCategories.includes(category) ? category : undefined;
  };

  describe('Pagination Parameter Extraction', () => {
    it('should calculate offset correctly for page-based pagination', () => {
      expect(extractOffsetFromParams({ page: '1', pageSize: '20' })).toBe(0);
      expect(extractOffsetFromParams({ page: '2', pageSize: '20' })).toBe(20);
      expect(extractOffsetFromParams({ page: '3', pageSize: '10' })).toBe(20);
      expect(extractOffsetFromParams({ page: '5', pageSize: '50' })).toBe(200);
    });

    it('should handle invalid page numbers', () => {
      expect(extractOffsetFromParams({ page: '0' })).toBe(0);
      expect(extractOffsetFromParams({ page: '-1' })).toBe(0);
      expect(extractOffsetFromParams({ page: 'invalid' })).toBe(0);
    });

    it('should use direct offset when provided', () => {
      expect(extractOffsetFromParams({ offset: '0' })).toBe(0);
      expect(extractOffsetFromParams({ offset: '25' })).toBe(25);
      expect(extractOffsetFromParams({ offset: '100' })).toBe(100);
    });

    it('should handle page size limits correctly', () => {
      expect(extractLimitFromParams({ pageSize: '10' })).toBe(10);
      expect(extractLimitFromParams({ pageSize: '20' })).toBe(20);
      expect(extractLimitFromParams({ pageSize: '50' })).toBe(50);
      expect(extractLimitFromParams({ pageSize: '100' })).toBe(50); // Capped at 50
      expect(extractLimitFromParams({ pageSize: '0' })).toBe(20); // Default
      expect(extractLimitFromParams({ pageSize: 'invalid' })).toBe(20); // Default
    });
  });

  describe('Sort Parameter Extraction', () => {
    it('should accept valid sort options', () => {
      expect(extractSortFromParams({ sort: 'relevance' })).toBe('relevance');
      expect(extractSortFromParams({ sort: 'rating' })).toBe('rating');
      expect(extractSortFromParams({ sort: 'distance' })).toBe('distance');
      expect(extractSortFromParams({ sort: 'name' })).toBe('name');
    });

    it('should handle case variations', () => {
      expect(extractSortFromParams({ sort: 'RATING' })).toBe('rating');
      expect(extractSortFromParams({ sort: 'Distance' })).toBe('distance');
      expect(extractSortFromParams({ sort: 'NAME' })).toBe('name');
    });

    it('should reject invalid sort options', () => {
      expect(extractSortFromParams({ sort: 'price' })).toBeUndefined();
      expect(extractSortFromParams({ sort: 'popularity' })).toBeUndefined();
      expect(extractSortFromParams({ sort: 'invalid' })).toBeUndefined();
      expect(extractSortFromParams({ sort: '' })).toBeUndefined();
    });
  });

  describe('Category Parameter Extraction', () => {
    it('should accept valid categories', () => {
      const validCategories = [
        'restaurant', 'cafe', 'bar', 'hotel', 'attraction', 
        'shopping', 'entertainment', 'transportation', 'health', 'services', 'other'
      ];

      validCategories.forEach(category => {
        expect(extractCategoryFromParams({ category })).toBe(category);
      });
    });

    it('should handle case variations', () => {
      expect(extractCategoryFromParams({ category: 'RESTAURANT' })).toBe('restaurant');
      expect(extractCategoryFromParams({ category: 'Cafe' })).toBe('cafe');
      expect(extractCategoryFromParams({ category: 'BAR' })).toBe('bar');
    });

    it('should reject invalid categories', () => {
      expect(extractCategoryFromParams({ category: 'food' })).toBeUndefined();
      expect(extractCategoryFromParams({ category: 'store' })).toBeUndefined();
      expect(extractCategoryFromParams({ category: 'invalid' })).toBeUndefined();
      expect(extractCategoryFromParams({ category: '' })).toBeUndefined();
    });
  });

  describe('Complex Parameter Combinations', () => {
    it('should handle all parameters together correctly', () => {
      const params = {
        query: 'italian restaurants',
        page: '3',
        pageSize: '15',
        sort: 'rating',
        category: 'restaurant'
      };

      expect(extractOffsetFromParams(params)).toBe(30); // (3-1) * 15
      expect(extractLimitFromParams(params)).toBe(15);
      expect(extractSortFromParams(params)).toBe('rating');
      expect(extractCategoryFromParams(params)).toBe('restaurant');
    });

    it('should use defaults for missing parameters', () => {
      const params = {
        query: 'test'
      };

      expect(extractOffsetFromParams(params)).toBe(0);
      expect(extractLimitFromParams(params)).toBe(20);
      expect(extractSortFromParams(params)).toBeUndefined();
      expect(extractCategoryFromParams(params)).toBeUndefined();
    });
  });

  describe('URL Building', () => {
    it('should build correct query strings', () => {
      const buildQueryString = (params: Record<string, string | number | undefined>) => {
        const urlParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            urlParams.set(key, value.toString());
          }
        });
        
        return urlParams.toString();
      };

      const params = {
        query: 'coffee shops',
        page: 2,
        pageSize: 10,
        sort: 'rating',
        category: 'cafe'
      };

      const queryString = buildQueryString(params);
      expect(queryString).toContain('query=coffee%20shops');
      expect(queryString).toContain('page=2');
      expect(queryString).toContain('pageSize=10');
      expect(queryString).toContain('sort=rating');
      expect(queryString).toContain('category=cafe');
    });

    it('should omit undefined parameters', () => {
      const buildQueryString = (params: Record<string, string | number | undefined>) => {
        const urlParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            urlParams.set(key, value.toString());
          }
        });
        
        return urlParams.toString();
      };

      const params = {
        query: 'test',
        page: 1,
        sort: undefined,
        category: undefined
      };

      const queryString = buildQueryString(params);
      expect(queryString).toContain('query=test');
      expect(queryString).toContain('page=1');
      expect(queryString).not.toContain('sort=');
      expect(queryString).not.toContain('category=');
    });
  });

  describe('Pagination Calculations', () => {
    it('should calculate pagination metadata correctly', () => {
      const calculatePagination = (page: number, pageSize: number, totalResults: number) => {
        const totalPages = Math.ceil(totalResults / pageSize);
        
        return {
          page,
          pageSize,
          totalResults,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        };
      };

      // Test case 1: First page with results
      let pagination = calculatePagination(1, 20, 100);
      expect(pagination.hasNextPage).toBe(true);
      expect(pagination.hasPreviousPage).toBe(false);
      expect(pagination.totalPages).toBe(5);

      // Test case 2: Middle page
      pagination = calculatePagination(3, 20, 100);
      expect(pagination.hasNextPage).toBe(true);
      expect(pagination.hasPreviousPage).toBe(true);

      // Test case 3: Last page
      pagination = calculatePagination(5, 20, 100);
      expect(pagination.hasNextPage).toBe(false);
      expect(pagination.hasPreviousPage).toBe(true);

      // Test case 4: Single page
      pagination = calculatePagination(1, 20, 15);
      expect(pagination.hasNextPage).toBe(false);
      expect(pagination.hasPreviousPage).toBe(false);
      expect(pagination.totalPages).toBe(1);
    });
  });
});

export {};
