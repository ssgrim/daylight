/**
 * Search Service - OpenSearch integration for geospatial and full-text search
 * Issue #112: Search Infrastructure & Geospatial Indexing
 */

import { Client } from '@opensearch-project/opensearch';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';

export interface SearchableLocation {
  id: string;
  name: string;
  description?: string;
  location: {
    lat: number;
    lon: number;
  };
  address?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  rating?: number;
  priceLevel?: number;
  openingHours?: {
    [day: string]: { open: string; close: string } | null;
  };
  metadata: {
    source: string;
    lastUpdated: string;
    verified: boolean;
  };
}

export interface SearchQuery {
  query?: string;
  location?: {
    lat: number;
    lon: number;
    radius?: string; // e.g., "5km", "10mi"
  };
  filters?: {
    category?: string[];
    subcategory?: string[];
    tags?: string[];
    rating?: { min?: number; max?: number };
    priceLevel?: { min?: number; max?: number };
    openNow?: boolean;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  }[];
  facets?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  hits: {
    total: number;
    results: Array<{
      score: number;
      source: SearchableLocation;
      distance?: string;
      explanation?: any;
    }>;
  };
  facets?: {
    [field: string]: Array<{
      value: string;
      count: number;
    }>;
  };
  aggregations?: any;
  took: number;
}

export class SearchService {
  private client: Client;
  private readonly indexName: string;

  constructor() {
    const endpoint = process.env.OPENSEARCH_ENDPOINT;
    const region = process.env.OPENSEARCH_REGION || 'us-west-1';
    
    if (!endpoint) {
      throw new Error('OPENSEARCH_ENDPOINT environment variable is required');
    }

    this.client = new Client({
      ...AwsSigv4Signer({
        region,
        service: 'es',
        getCredentials: () => defaultProvider()(),
      }),
      node: `https://${endpoint}`,
      requestTimeout: 30000,
      sniffOnStart: false,
    });

    this.indexName = 'daylight-locations';
  }

  /**
   * Initialize the search index with proper mappings
   */
  async initializeIndex(): Promise<void> {
    const indexExists = await this.client.indices.exists({
      index: this.indexName,
    });

    if (!indexExists.body) {
      await this.client.indices.create({
        index: this.indexName,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                location_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'asciifolding', 'stop'],
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: {
                type: 'text',
                analyzer: 'location_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                  suggest: {
                    type: 'completion',
                    analyzer: 'location_analyzer',
                  },
                },
              },
              description: {
                type: 'text',
                analyzer: 'location_analyzer',
              },
              location: { type: 'geo_point' },
              address: {
                type: 'text',
                analyzer: 'location_analyzer',
              },
              category: { type: 'keyword' },
              subcategory: { type: 'keyword' },
              tags: { type: 'keyword' },
              rating: { type: 'float' },
              priceLevel: { type: 'integer' },
              openingHours: {
                type: 'object',
                enabled: false, // Store as-is for complex querying
              },
              metadata: {
                properties: {
                  source: { type: 'keyword' },
                  lastUpdated: { type: 'date' },
                  verified: { type: 'boolean' },
                },
              },
            },
          },
        },
      });

      console.log(`Created search index: ${this.indexName}`);
    }
  }

  /**
   * Index a single location
   */
  async indexLocation(location: SearchableLocation): Promise<void> {
    await this.client.index({
      index: this.indexName,
      id: location.id,
      body: location,
      refresh: true,
    });
  }

  /**
   * Bulk index multiple locations
   */
  async bulkIndexLocations(locations: SearchableLocation[]): Promise<void> {
    if (locations.length === 0) return;

    const body = [];
    for (const location of locations) {
      body.push({ index: { _index: this.indexName, _id: location.id } });
      body.push(location);
    }

    const response = await this.client.bulk({
      body,
      refresh: true,
    });

    if (response.body.errors) {
      const errorItems = response.body.items.filter((item: any) => item.index?.error);
      console.error('Bulk indexing errors:', errorItems);
      throw new Error(`Bulk indexing failed for ${errorItems.length} items`);
    }

    console.log(`Successfully indexed ${locations.length} locations`);
  }

  /**
   * Search locations with full-text and geospatial capabilities
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();

    // Build the OpenSearch query
    const searchBody: any = {
      query: this.buildQuery(query),
      size: query.limit || 20,
      from: query.offset || 0,
    };

    // Add sorting
    if (query.sort && query.sort.length > 0) {
      searchBody.sort = query.sort.map(s => ({ [s.field]: { order: s.order } }));
    } else if (query.location) {
      // Default to distance sorting if location provided
      searchBody.sort = [
        {
          _geo_distance: {
            location: query.location,
            order: 'asc',
            unit: 'km',
          },
        },
      ];
    }

    // Add facets/aggregations
    if (query.facets && query.facets.length > 0) {
      searchBody.aggs = {};
      for (const facet of query.facets) {
        searchBody.aggs[facet] = {
          terms: { field: facet, size: 20 },
        };
      }
    }

    // Execute search
    const response = await this.client.search({
      index: this.indexName,
      body: searchBody,
    });

    const took = Date.now() - startTime;

    // Process results
    const hits = response.body.hits;
    const results = hits.hits.map((hit: any) => ({
      score: hit._score,
      source: hit._source,
      distance: hit.sort?.[0] ? `${(hit.sort[0] as number).toFixed(2)}km` : undefined,
      explanation: hit._explanation,
    }));

    // Process facets
    const facets: any = {};
    if (response.body.aggregations) {
      for (const [key, agg] of Object.entries(response.body.aggregations)) {
        facets[key] = (agg as any).buckets.map((bucket: any) => ({
          value: bucket.key,
          count: bucket.doc_count,
        }));
      }
    }

    return {
      hits: {
        total: hits.total.value || hits.total,
        results,
      },
      facets: Object.keys(facets).length > 0 ? facets : undefined,
      aggregations: response.body.aggregations,
      took,
    };
  }

  /**
   * Build OpenSearch query from search parameters
   */
  private buildQuery(query: SearchQuery): any {
    const must: any[] = [];
    const filter: any[] = [];

    // Text search
    if (query.query) {
      must.push({
        multi_match: {
          query: query.query,
          fields: ['name^3', 'description^2', 'address', 'tags'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Geospatial search
    if (query.location) {
      filter.push({
        geo_distance: {
          distance: query.location.radius || '50km',
          location: {
            lat: query.location.lat,
            lon: query.location.lon,
          },
        },
      });
    }

    // Category filters
    if (query.filters?.category && query.filters.category.length > 0) {
      filter.push({
        terms: { category: query.filters.category },
      });
    }

    if (query.filters?.subcategory && query.filters.subcategory.length > 0) {
      filter.push({
        terms: { subcategory: query.filters.subcategory },
      });
    }

    if (query.filters?.tags && query.filters.tags.length > 0) {
      filter.push({
        terms: { tags: query.filters.tags },
      });
    }

    // Rating filter
    if (query.filters?.rating) {
      const ratingFilter: any = { range: { rating: {} } };
      if (query.filters.rating.min !== undefined) {
        ratingFilter.range.rating.gte = query.filters.rating.min;
      }
      if (query.filters.rating.max !== undefined) {
        ratingFilter.range.rating.lte = query.filters.rating.max;
      }
      filter.push(ratingFilter);
    }

    // Price level filter
    if (query.filters?.priceLevel) {
      const priceFilter: any = { range: { priceLevel: {} } };
      if (query.filters.priceLevel.min !== undefined) {
        priceFilter.range.priceLevel.gte = query.filters.priceLevel.min;
      }
      if (query.filters.priceLevel.max !== undefined) {
        priceFilter.range.priceLevel.lte = query.filters.priceLevel.max;
      }
      filter.push(priceFilter);
    }

    // Open now filter (simplified - would need more complex time logic)
    if (query.filters?.openNow) {
      // This is a simplified implementation
      // In production, you'd want proper time zone handling and day-of-week logic
      filter.push({
        exists: { field: 'openingHours' },
      });
    }

    // Combine query parts
    if (must.length === 0 && filter.length === 0) {
      return { match_all: {} };
    }

    return {
      bool: {
        must: must.length > 0 ? must : undefined,
        filter: filter.length > 0 ? filter : undefined,
      },
    };
  }

  /**
   * Get search suggestions/autocomplete
   */
  async suggest(prefix: string, limit: number = 10): Promise<string[]> {
    const response = await this.client.search({
      index: this.indexName,
      body: {
        suggest: {
          location_suggest: {
            prefix,
            completion: {
              field: 'name.suggest',
              size: limit,
            },
          },
        },
      },
    });

    return response.body.suggest.location_suggest[0].options.map(
      (option: any) => option.text
    );
  }

  /**
   * Delete a location from the index
   */
  async deleteLocation(id: string): Promise<void> {
    await this.client.delete({
      index: this.indexName,
      id,
    });
  }

  /**
   * Get search analytics
   */
  async getAnalytics(): Promise<any> {
    const response = await this.client.search({
      index: this.indexName,
      body: {
        size: 0,
        aggs: {
          total_locations: { value_count: { field: 'id' } },
          categories: { terms: { field: 'category', size: 20 } },
          average_rating: { avg: { field: 'rating' } },
          location_bounds: { geo_bounds: { field: 'location' } },
        },
      },
    });

    return response.body.aggregations;
  }

  /**
   * Health check for the search service
   */
  async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      const response = await this.client.cluster.health();
      return {
        status: 'healthy',
        details: response.body,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: error,
      };
    }
  }
}

export const searchService = new SearchService();
