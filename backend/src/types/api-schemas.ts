// TypeScript type definitions for Daylight API schemas

/**
 * Standard API error response
 */
export interface ApiError {
  error: string;
  message?: string;
  field?: string;
  type?: 'validation_error' | 'external_service_error' | 'internal_error';
}

/**
 * Location coordinates
 */
export interface Location {
  lat: number;
  lng: number;
}

/**
 * Place categories for filtering
 */
export type PlaceCategory = 
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'hotel'
  | 'attraction'
  | 'shopping'
  | 'entertainment'
  | 'transportation'
  | 'health'
  | 'services'
  | 'other';

/**
 * Sort options for place results
 */
export type PlaceSortOption = 
  | 'relevance'
  | 'rating'
  | 'distance'
  | 'name';

/**
 * Google Places API result
 */
export interface PlaceResult {
  name: string;
  address: string;
  rating?: number;
  place_id: string;
  location?: Location;
  category?: PlaceCategory;
  distance?: number; // Distance in meters from search location
  price_level?: number; // 0-4 scale
  photos?: string[]; // Photo reference URLs
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Places API response with pagination
 */
export interface PlacesResponse {
  query: string;
  results: PlaceResult[];
  pagination: PaginationMeta;
  sort?: PlaceSortOption;
  category?: PlaceCategory;
  location?: Location;
  metadata: {
    provider: string;
    duration: number;
    cached: boolean;
  };
}

/**
 * Plan suggestion item
 */
export interface PlanSuggestion {
  id: string;
  title: string;
  start: string; // ISO 8601 timestamp
  end: string;   // ISO 8601 timestamp
  score: number; // 0-100
  location?: Location;
  description?: string;
}

/**
 * Plan API response
 */
export type PlanResponse = PlanSuggestion[];

/**
 * Cache metadata headers
 */
export interface CacheHeaders {
  'Cache-Control': string;
  'X-Cache': 'HIT' | 'MISS';
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  statusCode: number;
  headers: {
    'Content-Type': 'application/json';
    'Access-Control-Allow-Origin': string;
    'Access-Control-Allow-Methods': string;
  } & Partial<CacheHeaders>;
  body: string; // JSON stringified T | ApiError
}

/**
 * Query parameters for Places API with pagination and filtering
 */
export interface PlacesQueryParams {
  query: string; // Required, 1-120 characters
  page?: string | number; // Page number (1-based)
  pageSize?: string | number; // Results per page (1-50)
  sort?: PlaceSortOption; // Sort order
  category?: PlaceCategory; // Category filter
  lat?: string | number; // Latitude for distance sorting
  lng?: string | number; // Longitude for distance sorting
  radius?: string | number; // Search radius in meters
}

/**
 * Query parameters for Plan API
 */
export interface PlanQueryParams {
  lat?: string | number; // Optional latitude (-90 to 90)
  lng?: string | number; // Optional longitude (-180 to 180)
}

/**
 * Lambda event query string parameters
 */
export interface QueryStringParameters {
  [key: string]: string | undefined;
}
