/**
 * Unit Tests for Pagination, Sorting, and Category Filtering
 * 
 * Tests the parameter handling logic for the new search features.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../src/handlers/places.js';

// Mock the provider system
jest.mock('../src/providers/factory.js', () => ({
  initializeProvidersFromEnv: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/lib/places-service.js', () => ({
  createPlacesServiceFromEnv: jest.fn().mockReturnValue({
    searchPlaces: jest.fn().mockResolvedValue({
      data: {
        query: 'test',
        results: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalResults: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        },
        metadata: {
          provider: 'mock',
          duration: 100,
          cached: false
        }
      },
      headers: {}
    })
  })
}));

describe('Pagination, Sorting, and Category Filtering', () => {
  let mockSearchPlaces: jest.MockedFunction<any>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get the mock function
    const mockService = require('../src/lib/places-service.js').createPlacesServiceFromEnv();
    mockSearchPlaces = mockService.searchPlaces;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Parameter Extraction', () => {
    it('should extract basic search parameters', async () => {
      const event: Partial<APIGatewayProxyEventV2> = {
        requestContext: {
          http: { method: 'GET' }
        } as any,
        queryStringParameters: {
          query: 'coffee shops',
          page: '2',
          pageSize: '10',
          sort: 'rating',
          category: 'cafe'
        }
      };

      await handler(event as APIGatewayProxyEventV2);

      expect(mockSearchPlaces).toHaveBeenCalledWith({
        query: 'coffee shops',
        limit: 10,
        offset: 10, // (page - 1) * pageSize = (2 - 1) * 10
        sort: 'rating',
        category: 'cafe',
        language: undefined,
        location: undefined,
        radius: undefined,
        extra: undefined
      });
    });

    it('should use default values for missing parameters', async () => {
      const event: Partial<APIGatewayProxyEventV2> = {
        requestContext: {
          http: { method: 'GET' }
        } as any,
        queryStringParameters: {
          query: 'restaurants'
        }
      };

      await handler(event as APIGatewayProxyEventV2);

      expect(mockSearchPlaces).toHaveBeenCalledWith({
        query: 'restaurants',
        limit: 20, // default pageSize
        offset: 0, // default page 1
        sort: undefined,
        category: undefined,
        language: undefined,
        location: undefined,
        radius: undefined,
        extra: undefined
      });
    });

    it('should handle page-based pagination correctly', async () => {
      const testCases = [
        { page: '1', pageSize: '20', expectedOffset: 0 },
        { page: '2', pageSize: '20', expectedOffset: 20 },
        { page: '3', pageSize: '10', expectedOffset: 20 },
        { page: '5', pageSize: '50', expectedOffset: 200 }
      ];

      for (const testCase of testCases) {
        const event: Partial<APIGatewayProxyEventV2> = {
          requestContext: {
            http: { method: 'GET' }
          } as any,
          queryStringParameters: {
            query: 'test',
            page: testCase.page,
            pageSize: testCase.pageSize
          }
        };

        await handler(event as APIGatewayProxyEventV2);

        expect(mockSearchPlaces).toHaveBeenCalledWith(
          expect.objectContaining({
            offset: testCase.expectedOffset,
            limit: parseInt(testCase.pageSize)
          })
        );

        mockSearchPlaces.mockClear();
      }
    });

    it('should validate and constrain page size', async () => {
      const testCases = [
        { pageSize: '5', expected: 5 },
        { pageSize: '20', expected: 20 },
        { pageSize: '50', expected: 50 },
        { pageSize: '100', expected: 50 }, // Should be capped at 50
        { pageSize: '0', expected: 20 }, // Should default to 20
        { pageSize: '-5', expected: 20 }, // Should default to 20
        { pageSize: 'invalid', expected: 20 } // Should default to 20
      ];

      for (const testCase of testCases) {
        const event: Partial<APIGatewayProxyEventV2> = {
          requestContext: {
            http: { method: 'GET' }
          } as any,
          queryStringParameters: {
            query: 'test',
            pageSize: testCase.pageSize
          }
        };

        await handler(event as APIGatewayProxyEventV2);

        expect(mockSearchPlaces).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: testCase.expected
          })
        );

        mockSearchPlaces.mockClear();
      }
    });

    it('should validate sort options', async () => {
      const validSorts = ['relevance', 'rating', 'distance', 'name'];
      const invalidSorts = ['price', 'popularity', 'invalid', ''];

      for (const sort of validSorts) {
        const event: Partial<APIGatewayProxyEventV2> = {
          requestContext: {
            http: { method: 'GET' }
          } as any,
          queryStringParameters: {
            query: 'test',
            sort
          }
        };

        await handler(event as APIGatewayProxyEventV2);

        expect(mockSearchPlaces).toHaveBeenCalledWith(
          expect.objectContaining({
            sort
          })
        );

        mockSearchPlaces.mockClear();
      }

      for (const sort of invalidSorts) {
        const event: Partial<APIGatewayProxyEventV2> = {
          requestContext: {
            http: { method: 'GET' }
          } as any,
          queryStringParameters: {
            query: 'test',
            sort
          }
        };

        await handler(event as APIGatewayProxyEventV2);

        expect(mockSearchPlaces).toHaveBeenCalledWith(
          expect.objectContaining({
            sort: undefined // Invalid sorts should be filtered out
          })
        );

        mockSearchPlaces.mockClear();
      }
    });

    it('should validate category filters', async () => {
      const validCategories = [
        'restaurant', 'cafe', 'bar', 'hotel', 'attraction', 
        'shopping', 'entertainment', 'transportation', 'health', 'services', 'other'
      ];
      const invalidCategories = ['food', 'store', 'invalid', ''];

      for (const category of validCategories) {
        const event: Partial<APIGatewayProxyEventV2> = {
          requestContext: {
            http: { method: 'GET' }
          } as any,
          queryStringParameters: {
            query: 'test',
            category
          }
        };

        await handler(event as APIGatewayProxyEventV2);

        expect(mockSearchPlaces).toHaveBeenCalledWith(
          expect.objectContaining({
            category
          })
        );

        mockSearchPlaces.mockClear();
      }

      for (const category of invalidCategories) {
        const event: Partial<APIGatewayProxyEventV2> = {
          requestContext: {
            http: { method: 'GET' }
          } as any,
          queryStringParameters: {
            query: 'test',
            category
          }
        };

        await handler(event as APIGatewayProxyEventV2);

        expect(mockSearchPlaces).toHaveBeenCalledWith(
          expect.objectContaining({
            category: undefined // Invalid categories should be filtered out
          })
        );

        mockSearchPlaces.mockClear();
      }
    });

    it('should handle location parameters for distance sorting', async () => {
      const event: Partial<APIGatewayProxyEventV2> = {
        requestContext: {
          http: { method: 'GET' }
        } as any,
        queryStringParameters: {
          query: 'restaurants',
          lat: '37.7749',
          lng: '-122.4194',
          radius: '5000',
          sort: 'distance'
        }
      };

      await handler(event as APIGatewayProxyEventV2);

      expect(mockSearchPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          location: { lat: 37.7749, lng: -122.4194 },
          radius: 5000,
          sort: 'distance'
        })
      );
    });

    it('should ignore invalid location parameters', async () => {
      const invalidLocationCases = [
        { lat: 'invalid', lng: '-122.4194' },
        { lat: '37.7749', lng: 'invalid' },
        { lat: '91', lng: '-122.4194' }, // Invalid latitude
        { lat: '37.7749', lng: '181' }, // Invalid longitude
        { lat: '', lng: '' }
      ];

      for (const locationCase of invalidLocationCases) {
        const event: Partial<APIGatewayProxyEventV2> = {
          requestContext: {
            http: { method: 'GET' }
          } as any,
          queryStringParameters: {
            query: 'test',
            ...locationCase
          }
        };

        await handler(event as APIGatewayProxyEventV2);

        expect(mockSearchPlaces).toHaveBeenCalledWith(
          expect.objectContaining({
            location: undefined
          })
        );

        mockSearchPlaces.mockClear();
      }
    });
  });

  describe('Complex Parameter Combinations', () => {
    it('should handle all parameters together', async () => {
      const event: Partial<APIGatewayProxyEventV2> = {
        requestContext: {
          http: { method: 'GET' }
        } as any,
        queryStringParameters: {
          query: 'italian restaurants',
          page: '3',
          pageSize: '15',
          sort: 'rating',
          category: 'restaurant',
          lat: '37.7749',
          lng: '-122.4194',
          radius: '2000',
          language: 'en'
        }
      };

      await handler(event as APIGatewayProxyEventV2);

      expect(mockSearchPlaces).toHaveBeenCalledWith({
        query: 'italian restaurants',
        limit: 15,
        offset: 30, // (3 - 1) * 15
        sort: 'rating',
        category: 'restaurant',
        location: { lat: 37.7749, lng: -122.4194 },
        radius: 2000,
        language: 'en',
        extra: undefined
      });
    });

    it('should handle edge cases gracefully', async () => {
      const event: Partial<APIGatewayProxyEventV2> = {
        requestContext: {
          http: { method: 'GET' }
        } as any,
        queryStringParameters: {
          query: 'test',
          page: '0', // Should be treated as page 1
          pageSize: '1000', // Should be capped
          sort: 'RATING', // Case should be handled
          category: 'RESTAURANT' // Case should be handled
        }
      };

      await handler(event as APIGatewayProxyEventV2);

      expect(mockSearchPlaces).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 0, // page 0 should become page 1, offset 0
          limit: 50, // Should be capped at 50
          sort: undefined, // Case-sensitive validation should fail
          category: undefined // Case-sensitive validation should fail
        })
      );
    });
  });

  describe('Response Format', () => {
    it('should return paginated response format', async () => {
      mockSearchPlaces.mockResolvedValue({
        data: {
          query: 'test query',
          results: [
            {
              name: 'Test Place',
              address: '123 Test St',
              rating: 4.5,
              place_id: 'test_id',
              location: { lat: 37.7749, lng: -122.4194 },
              category: 'restaurant',
              distance: 500,
              price_level: 2
            }
          ],
          pagination: {
            page: 2,
            pageSize: 10,
            totalResults: 25,
            totalPages: 3,
            hasNextPage: true,
            hasPreviousPage: true
          },
          sort: 'rating',
          category: 'restaurant',
          metadata: {
            provider: 'google-places',
            duration: 250,
            cached: false
          }
        },
        headers: {
          'X-Cache': 'MISS'
        }
      });

      const event: Partial<APIGatewayProxyEventV2> = {
        requestContext: {
          http: { method: 'GET' }
        } as any,
        queryStringParameters: {
          query: 'test query',
          page: '2',
          pageSize: '10',
          sort: 'rating',
          category: 'restaurant'
        }
      };

      const result = await handler(event as APIGatewayProxyEventV2);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toEqual({
        query: 'test query',
        results: expect.arrayContaining([
          expect.objectContaining({
            name: 'Test Place',
            category: 'restaurant',
            distance: 500,
            price_level: 2
          })
        ]),
        pagination: {
          page: 2,
          pageSize: 10,
          totalResults: 25,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true
        },
        sort: 'rating',
        category: 'restaurant',
        metadata: expect.objectContaining({
          provider: 'google-places',
          duration: 250,
          cached: false
        })
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing query parameter', async () => {
      const event: Partial<APIGatewayProxyEventV2> = {
        requestContext: {
          http: { method: 'GET' }
        } as any,
        queryStringParameters: {
          page: '1',
          sort: 'rating'
          // Missing query parameter
        }
      };

      const result = await handler(event as APIGatewayProxyEventV2);

      expect(result.statusCode).toBe(400);
      expect(mockSearchPlaces).not.toHaveBeenCalled();
    });

    it('should handle empty query parameter', async () => {
      const event: Partial<APIGatewayProxyEventV2> = {
        requestContext: {
          http: { method: 'GET' }
        } as any,
        queryStringParameters: {
          query: '',
          page: '1'
        }
      };

      const result = await handler(event as APIGatewayProxyEventV2);

      expect(result.statusCode).toBe(400);
      expect(mockSearchPlaces).not.toHaveBeenCalled();
    });
  });
});
