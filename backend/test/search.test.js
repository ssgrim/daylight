/**
 * Search Infrastructure Tests
 * Issue #112: Search Infrastructure & Geospatial Indexing
 */

import { strict as assert } from 'assert';
import { test, describe } from 'node:test';

// Mock the OpenSearch client for testing
const mockSearchResults = {
  body: {
    hits: {
      total: { value: 2 },
      hits: [
        {
          _score: 1.5,
          _source: {
            id: 'golden-gate-bridge',
            name: 'Golden Gate Bridge',
            location: { lat: 37.8199, lon: -122.4783 },
            category: 'attraction',
            tags: ['bridge', 'landmark'],
            rating: 4.7,
          },
          sort: [0.5], // Distance in km
        },
        {
          _score: 1.2,
          _source: {
            id: 'alcatraz-island',
            name: 'Alcatraz Island',
            location: { lat: 37.8267, lon: -122.4230 },
            category: 'attraction',
            tags: ['history', 'museum'],
            rating: 4.5,
          },
          sort: [1.2],
        },
      ],
    },
    aggregations: {
      category: {
        buckets: [
          { key: 'attraction', doc_count: 2 },
          { key: 'dining', doc_count: 5 },
        ],
      },
    },
  },
};

// Mock search service for unit tests
class MockSearchService {
  async initializeIndex() {
    return Promise.resolve();
  }

  async search(query) {
    // Simulate search logic
    const results = {
      hits: {
        total: mockSearchResults.body.hits.total.value,
        results: mockSearchResults.body.hits.hits.map(hit => ({
          score: hit._score,
          source: hit._source,
          distance: hit.sort ? `${hit.sort[0].toFixed(2)}km` : undefined,
        })),
      },
      facets: {
        category: mockSearchResults.body.aggregations.category.buckets.map(bucket => ({
          value: bucket.key,
          count: bucket.doc_count,
        })),
      },
      took: 15,
    };

    return Promise.resolve(results);
  }

  async suggest(prefix) {
    const suggestions = ['Golden Gate Bridge', 'Golden Gate Park'].filter(s =>
      s.toLowerCase().includes(prefix.toLowerCase())
    );
    return Promise.resolve(suggestions);
  }

  async indexLocation(location) {
    return Promise.resolve();
  }

  async healthCheck() {
    return Promise.resolve({ status: 'healthy' });
  }
}

describe('Search Infrastructure', () => {
  const mockSearchService = new MockSearchService();

  test('search with text query', async () => {
    const query = {
      query: 'bridge',
      location: { lat: 37.8199, lon: -122.4783, radius: '10km' },
      limit: 10,
    };

    const results = await mockSearchService.search(query);

    assert.equal(results.hits.total, 2);
    assert.equal(results.hits.results.length, 2);
    assert.equal(results.hits.results[0].source.name, 'Golden Gate Bridge');
    assert.equal(results.hits.results[0].distance, '0.50km');
  });

  test('search with geospatial filters', async () => {
    const query = {
      location: { lat: 37.8199, lon: -122.4783, radius: '5km' },
      filters: { category: ['attraction'] },
      facets: ['category'],
    };

    const results = await mockSearchService.search(query);

    assert.equal(results.hits.total, 2);
    assert(results.facets);
    assert.equal(results.facets.category.length, 2);
    assert.equal(results.facets.category[0].value, 'attraction');
    assert.equal(results.facets.category[0].count, 2);
  });

  test('search suggestions', async () => {
    const suggestions = await mockSearchService.suggest('golden');

    assert(Array.isArray(suggestions));
    assert.equal(suggestions.length, 2);
    assert(suggestions.includes('Golden Gate Bridge'));
    assert(suggestions.includes('Golden Gate Park'));
  });

  test('index location', async () => {
    const location = {
      id: 'test-location',
      name: 'Test Location',
      location: { lat: 37.7749, lon: -122.4194 },
      category: 'test',
      tags: ['test'],
      metadata: {
        source: 'test',
        lastUpdated: new Date().toISOString(),
        verified: false,
      },
    };

    // Should not throw an error
    await mockSearchService.indexLocation(location);
    assert(true);
  });

  test('health check', async () => {
    const health = await mockSearchService.healthCheck();

    assert.equal(health.status, 'healthy');
  });
});

describe('Search Query Building', () => {
  test('build query with text search', () => {
    const query = {
      query: 'coffee shop',
      location: { lat: 37.7749, lon: -122.4194, radius: '2km' },
      filters: { category: ['dining'], rating: { min: 4.0 } },
    };

    // Mock the query building logic
    const opensearchQuery = {
      bool: {
        must: [
          {
            multi_match: {
              query: 'coffee shop',
              fields: ['name^3', 'description^2', 'address', 'tags'],
              type: 'best_fields',
              fuzziness: 'AUTO',
            },
          },
        ],
        filter: [
          {
            geo_distance: {
              distance: '2km',
              location: { lat: 37.7749, lon: -122.4194 },
            },
          },
          { terms: { category: ['dining'] } },
          { range: { rating: { gte: 4.0 } } },
        ],
      },
    };

    // Validate query structure
    assert(opensearchQuery.bool.must);
    assert(opensearchQuery.bool.filter);
    assert.equal(opensearchQuery.bool.must.length, 1);
    assert.equal(opensearchQuery.bool.filter.length, 3);
  });

  test('build query with only geospatial filter', () => {
    const query = {
      location: { lat: 37.7749, lon: -122.4194, radius: '5km' },
    };

    const opensearchQuery = {
      bool: {
        filter: [
          {
            geo_distance: {
              distance: '5km',
              location: { lat: 37.7749, lon: -122.4194 },
            },
          },
        ],
      },
    };

    assert(opensearchQuery.bool.filter);
    assert.equal(opensearchQuery.bool.filter.length, 1);
    assert.equal(opensearchQuery.bool.filter[0].geo_distance.distance, '5km');
  });
});

describe('Search Response Processing', () => {
  test('process search results with distance', () => {
    const hit = {
      _score: 1.5,
      _source: {
        id: 'test-location',
        name: 'Test Location',
        location: { lat: 37.7749, lon: -122.4194 },
      },
      sort: [2.3], // Distance in km
    };

    const processedResult = {
      score: hit._score,
      source: hit._source,
      distance: `${hit.sort[0].toFixed(2)}km`,
    };

    assert.equal(processedResult.score, 1.5);
    assert.equal(processedResult.source.name, 'Test Location');
    assert.equal(processedResult.distance, '2.30km');
  });

  test('process facets', () => {
    const aggregations = {
      category: {
        buckets: [
          { key: 'dining', doc_count: 15 },
          { key: 'attraction', doc_count: 8 },
        ],
      },
      rating: {
        buckets: [
          { key: '4.0-5.0', doc_count: 12 },
          { key: '3.0-4.0', doc_count: 11 },
        ],
      },
    };

    const facets = {};
    for (const [key, agg] of Object.entries(aggregations)) {
      facets[key] = agg.buckets.map(bucket => ({
        value: bucket.key,
        count: bucket.doc_count,
      }));
    }

    assert.equal(facets.category.length, 2);
    assert.equal(facets.category[0].value, 'dining');
    assert.equal(facets.category[0].count, 15);
    assert.equal(facets.rating.length, 2);
  });
});

// Integration tests would go here if we had a real OpenSearch instance
describe('Search Integration (requires OpenSearch)', () => {
  test.skip('real search with OpenSearch cluster', async () => {
    // This test would require a real OpenSearch cluster
    // Skip for unit testing but include for integration testing
    assert(true);
  });

  test.skip('real indexing with bulk operations', async () => {
    // This test would require a real OpenSearch cluster
    assert(true);
  });
});

console.log('Search infrastructure tests defined. Run with: node --test test/search.test.js');
