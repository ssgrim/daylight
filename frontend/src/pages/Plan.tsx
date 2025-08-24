
import React, { useContext, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiBaseContext } from '../main';
import { useDebounce } from '../hooks/useDebounce';
import { ToastContainer, useToast } from '../components/Toast';
import { SearchResultsSkeleton } from '../components/Skeleton';
import { RetryButton } from '../components/RetryButton';
import MapView from '../components/MapView';
import ViewToggle from '../components/ViewToggle';
import RateLimitNotification from '../components/RateLimitNotification';
import { SearchErrorBoundary } from '../components/SearchErrorBoundary';
import { createApiClient, isRateLimitError, getRateLimitInfo, type RateLimitInfo } from '../lib/apiClient';
import { logError, logInfo } from '../lib/errorHandling';

type PlaceCategory = 
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

type PlaceSortOption = 
  | 'relevance'
  | 'rating'
  | 'distance'
  | 'name';

interface PlaceResult {
  name: string;
  address: string;
  rating?: number;
  place_id: string;
  location?: { lat: number; lng: number };
  category?: PlaceCategory;
  distance?: number;
  price_level?: number;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PlacesResponse {
  query: string;
  results: PlaceResult[];
  pagination: PaginationMeta;
  sort?: PlaceSortOption;
  category?: PlaceCategory;
  location?: { lat: number; lng: number };
  metadata: {
    provider: string;
    duration: number;
    cached: boolean;
  };
}

export default function Plan() {
  const apiBase = useContext(ApiBaseContext);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Search state
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  
  // UI state
  const [view, setView] = useState<'list' | 'map'>('list');
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({ isRateLimited: false });
  
  // Filter and sort state (managed via URL)
  const currentPage = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const sortOption = (searchParams.get('sort') || 'relevance') as PlaceSortOption;
  const categoryFilter = searchParams.get('category') as PlaceCategory | null;
  
  // Debounce the search query (300-500ms as requested)
  const debouncedQuery = useDebounce(query, 400);
  
  // Toast notifications
  const { toasts, removeToast, showError, showSuccess } = useToast();
  
  // Create API client instance
  const apiClient = apiBase ? createApiClient(apiBase, { timeout: 30000 }) : null;

  const searchPlaces = useCallback(async (
    searchQuery: string, 
    page: number = 1, 
    size: number = 20, 
    sort: PlaceSortOption = 'relevance', 
    category: PlaceCategory | null = null
  ) => {
    if (!searchQuery.trim() || !apiClient) return;
    
    setLoading(true);
    setError(null);
    setRateLimitInfo({ isRateLimited: false });
    setLastSearchQuery(searchQuery);
    
    // Log the search attempt
    logInfo('Starting place search', { 
      query: searchQuery, 
      page, 
      pageSize: size, 
      sort, 
      category 
    });
    
    try {
      // Build query parameters
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        page: page.toString(),
        pageSize: size.toString(),
        sort
      });
      
      if (category) {
        params.set('category', category);
      }
      
      const data: PlacesResponse = await apiClient.get(`/places?${params.toString()}`);
      
      setResults(data.results || []);
      setPagination(data.pagination);
      
      // Log successful search
      logInfo('Search completed successfully', { 
        query: searchQuery, 
        resultCount: data.results?.length || 0,
        totalResults: data.pagination?.totalResults || 0,
        page,
        totalPages: data.pagination?.totalPages || 0
      });
      
      // Show success toast for successful searches
      if (data.results && data.results.length > 0) {
        showSuccess(
          `Found ${data.pagination?.totalResults || data.results.length} places for "${searchQuery}"`, 
          3000
        );
      }
    } catch (err) {
      // Handle rate limit errors specially
      if (isRateLimitError(err)) {
        const rateLimitData = getRateLimitInfo(err);
        setRateLimitInfo(rateLimitData);
        setError(null); // Don't show generic error for rate limits
        
        logInfo('Rate limit encountered', { 
          query: searchQuery,
          retryAfter: rateLimitData.retryAfter 
        });
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to search places';
        setError(errorMessage);
        setResults([]);
        setPagination(null);
        setRateLimitInfo({ isRateLimited: false });
        
        // Log the error with correlation ID
        logError(err, {
          component: 'Plan',
          action: 'search_places',
          additionalData: { query: searchQuery, page, sort, category }
        });
        
        // Show error toast for non-rate-limit errors
        showError(`Search failed: ${errorMessage}`, 0); // 0 = persistent until manually closed
      }
    } finally {
      setLoading(false);
    }
  }, [apiClient, showError, showSuccess]);

  // URL state management
  const updateSearchParams = useCallback((updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Auto-search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim() && debouncedQuery !== lastSearchQuery) {
      // Update URL with new query and reset pagination
      updateSearchParams({ 
        q: debouncedQuery, 
        page: '1' // Reset to first page on new search
      });
      
      searchPlaces(debouncedQuery, 1, pageSize, sortOption, categoryFilter);
    }
  }, [debouncedQuery, searchPlaces, lastSearchQuery, pageSize, sortOption, categoryFilter, updateSearchParams]);

  // Search when URL params change (but not query - that's handled above)
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery && urlQuery === query && urlQuery === lastSearchQuery) {
      // Only search if the query hasn't changed but other params have
      searchPlaces(urlQuery, currentPage, pageSize, sortOption, categoryFilter);
    }
  }, [currentPage, pageSize, sortOption, categoryFilter, searchParams, query, lastSearchQuery, searchPlaces]);

  // Initialize query from URL
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery && urlQuery !== query) {
      setQuery(urlQuery);
    }
  }, []);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      updateSearchParams({ q: query, page: '1' });
      searchPlaces(query, 1, pageSize, sortOption, categoryFilter);
    }
  };

  const handleRetry = () => {
    if (lastSearchQuery) {
      searchPlaces(lastSearchQuery, currentPage, pageSize, sortOption, categoryFilter);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    // Clear results immediately when query is cleared
    if (!newQuery.trim()) {
      setResults([]);
      setPagination(null);
      setError(null);
      setRateLimitInfo({ isRateLimited: false });
      setLastSearchQuery('');
      updateSearchParams({ q: null, page: null });
    }
  };

  const handlePageChange = (newPage: number) => {
    updateSearchParams({ page: newPage.toString() });
  };

  const handleSortChange = (newSort: PlaceSortOption) => {
    updateSearchParams({ sort: newSort, page: '1' }); // Reset to first page
  };

  const handleCategoryChange = (newCategory: PlaceCategory | null) => {
    updateSearchParams({ 
      category: newCategory, 
      page: '1' // Reset to first page
    });
  };

  const handlePageSizeChange = (newPageSize: number) => {
    updateSearchParams({ 
      pageSize: newPageSize.toString(), 
      page: '1' // Reset to first page
    });
  };

  const handleRateLimitDismiss = () => {
    setRateLimitInfo({ isRateLimited: false });
  };

  const handleRateLimitRetry = () => {
    if (lastSearchQuery) {
      searchPlaces(lastSearchQuery);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Trip Planner</h1>
      </header>
      
      {/* Rate Limit Notification */}
      {rateLimitInfo.isRateLimited && (
        <RateLimitNotification
          rateLimitInfo={rateLimitInfo}
          onRetry={handleRateLimitRetry}
          onDismiss={handleRateLimitDismiss}
          className="mb-4"
        />
      )}
      
      <main>
        {/* Search functionality wrapped in error boundary */}
        <SearchErrorBoundary>
          {/* Search Form */}
          <section aria-labelledby="search-heading">
            <h2 id="search-heading" className="sr-only">Search for places</h2>
            <form onSubmit={handleManualSearch} className="mb-6" data-testid="search-form" role="search">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <label htmlFor="place-search" className="sr-only">
                    Search for places like restaurants, attractions, or coffee shops
                  </label>
                  <input
                    id="place-search"
                    type="text"
                    value={query}
                    onChange={handleQueryChange}
                    placeholder="Search for places (e.g., pasadena coffee)"
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent pr-10 text-gray-900"
                    data-testid="search-input"
                    maxLength={120}
                    aria-describedby="search-hint search-status"
                    aria-invalid={error ? 'true' : 'false'}
                    autoComplete="off"
                  />
                  {/* Search indicator */}
                  {loading && (
                    <div 
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      aria-hidden="true"
                    >
                      <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                  data-testid="search-button"
                  aria-describedby="search-status"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
              
              {/* Search hints and status */}
              <div id="search-hint" className="mt-2 text-sm text-gray-600">
                {query.length > 0 && (
                  <span>Auto-searching as you type... ({query.length}/120 characters)</span>
                )}
                {query.length === 0 && (
                  <span>Start typing to search for places automatically</span>
                )}
              </div>
              <div id="search-status" className="sr-only" aria-live="polite">
                {loading && 'Searching for places...'}
                {!loading && results.length > 0 && `Found ${results.length} places`}
                {!loading && results.length === 0 && lastSearchQuery && 'No places found'}
                {error && `Search error: ${error}`}
              </div>
            </form>
          </section>

          {/* Search Controls */}
          {(results.length > 0 || lastSearchQuery) && (
            <section className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex flex-wrap gap-4 items-center">
                {/* Sort Control */}
                <div className="flex items-center gap-2">
                  <label htmlFor="sort-select" className="text-sm font-medium text-gray-700">
                    Sort by:
                  </label>
                  <select
                    id="sort-select"
                    value={sortOption}
                    onChange={(e) => handleSortChange(e.target.value as PlaceSortOption)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    data-testid="sort-select"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="rating">Rating</option>
                    <option value="distance">Distance</option>
                    <option value="name">Name</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2">
                  <label htmlFor="category-select" className="text-sm font-medium text-gray-700">
                    Category:
                  </label>
                  <select
                    id="category-select"
                    value={categoryFilter || ''}
                    onChange={(e) => handleCategoryChange(e.target.value as PlaceCategory || null)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    data-testid="category-select"
                  >
                    <option value="">All Categories</option>
                    <option value="restaurant">Restaurants</option>
                    <option value="cafe">Cafes</option>
                    <option value="bar">Bars</option>
                    <option value="hotel">Hotels</option>
                    <option value="attraction">Attractions</option>
                    <option value="shopping">Shopping</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="transportation">Transportation</option>
                    <option value="health">Health</option>
                    <option value="services">Services</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Page Size Control */}
                <div className="flex items-center gap-2">
                  <label htmlFor="pagesize-select" className="text-sm font-medium text-gray-700">
                    Per page:
                  </label>
                  <select
                    id="pagesize-select"
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    data-testid="pagesize-select"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                {/* Results Info */}
                {pagination && (
                  <div className="text-sm text-gray-600 ml-auto">
                    Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, pagination.totalResults)} of {pagination.totalResults} results
                  </div>
                )}
              </div>
            </section>
          )}
          {error && !loading && (
            <section role="alert" className="mb-4 p-4 bg-red-50 border-2 border-red-200 text-red-800 rounded-lg flex items-center justify-between" data-testid="error-message">
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Search Error</h3>
                <p>{error}</p>
              </div>
              <RetryButton onRetry={handleRetry} loading={loading} />
            </section>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <section aria-labelledby="loading-heading" className="mb-4" data-testid="loading-indicator">
              <h3 id="loading-heading" className="sr-only">Loading search results</h3>
              <SearchResultsSkeleton count={3} />
            </section>
          )}

          {/* Results */}
          {!loading && results.length > 0 && (
            <section aria-labelledby="results-heading" data-testid="results-container">
              <div className="flex items-center justify-between mb-4">
                <h3 id="results-heading" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-green-600 text-xl" aria-hidden="true">✓</span>
                  Found {pagination?.totalResults || results.length} places for "{lastSearchQuery}"
                  {categoryFilter && <span className="text-sm font-normal text-gray-600"> in {categoryFilter}</span>}
                </h3>
                <ViewToggle view={view} onViewChange={setView} />
              </div>

              {/* Pagination - Top */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center mb-6" data-testid="pagination-top">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!pagination.hasPreviousPage}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      data-testid="prev-page-button"
                    >
                      Previous
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const startPage = Math.max(1, currentPage - 2);
                        const pageNum = startPage + i;
                        if (pageNum > pagination.totalPages) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-1 border rounded-md text-sm ${
                              pageNum === currentPage 
                                ? 'bg-blue-600 text-white border-blue-600' 
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                            data-testid={`page-${pageNum}-button`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!pagination.hasNextPage}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                      data-testid="next-page-button"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              
              {view === 'list' ? (
                <div className="grid gap-4" role="list" aria-label="Search results">
                  {results.map((place, index) => (
                    <article
                      key={place.place_id}
                      role="listitem"
                      tabIndex={0}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:shadow-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-200 hover:border-blue-300 cursor-pointer"
                      data-testid="place-result"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          // Handle place selection if needed
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-lg text-gray-900" data-testid="place-name">
                          {place.name}
                        </h4>
                        {place.category && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full capitalize">
                            {place.category}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-700 mt-1" data-testid="place-address">
                        <span className="sr-only">Address: </span>
                        {place.address}
                      </p>
                      
                      <div className="flex items-center gap-4 mt-2">
                        {place.rating && (
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-500 text-lg" aria-hidden="true">★</span>
                            <span className="text-sm text-gray-700" data-testid="place-rating">
                              <span className="sr-only">Rating: </span>
                              {place.rating} out of 5 stars
                            </span>
                          </div>
                        )}
                        
                        {place.price_level !== undefined && (
                          <div className="flex items-center gap-1">
                            <span className="text-green-600 text-sm">
                              {'$'.repeat(place.price_level + 1)}
                            </span>
                          </div>
                        )}
                        
                        {place.distance !== undefined && (
                          <div className="text-sm text-gray-600">
                            {place.distance < 1000 
                              ? `${place.distance}m away`
                              : `${(place.distance / 1000).toFixed(1)}km away`
                            }
                          </div>
                        )}
                        
                        {place.opening_hours?.open_now !== undefined && (
                          <div className={`text-sm font-medium ${
                            place.opening_hours.open_now ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {place.opening_hours.open_now ? 'Open Now' : 'Closed'}
                          </div>
                        )}
                      </div>
                      
                      {place.location && (
                        <div className="mt-2 text-xs text-gray-600" data-testid="place-coordinates">
                          <span className="sr-only">Coordinates: </span>
                          {place.location.lat.toFixed(4)}, {place.location.lng.toFixed(4)}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="h-96 w-full border-2 border-gray-200 rounded-lg overflow-hidden" data-testid="map-container" role="img" aria-label={`Map showing ${results.length} search results`}>
                  <MapView results={results} className="h-full" />
                </div>
              )}

              {/* Pagination - Bottom */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center mt-6" data-testid="pagination-bottom">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!pagination.hasPreviousPage}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {pagination.totalPages}
                    </span>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!pagination.hasNextPage}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* No Results */}
          {!loading && !error && results.length === 0 && lastSearchQuery && (
            <section className="text-center py-8" data-testid="no-results" role="status">
              <div className="text-gray-400 text-4xl mb-2" aria-hidden="true">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No places found</h3>
              <p className="text-gray-700 mb-2">No places found for "{lastSearchQuery}"</p>
              <p className="text-gray-600 text-sm mb-4">Try a different search term or check your spelling</p>
              <div className="mt-4">
                <RetryButton onRetry={handleRetry} loading={loading}>
                  Search Again
                </RetryButton>
              </div>
            </section>
          )}

          {/* Welcome State */}
          {!loading && !error && results.length === 0 && !lastSearchQuery && (
            <section className="text-center py-12" data-testid="welcome-state">
              <div className="text-gray-400 text-5xl mb-4" aria-hidden="true">🗺️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to explore?</h3>
              <p className="text-gray-700 mb-4">
                Search for places to get started with your trip planning
              </p>
              <p className="text-sm text-gray-600">
                Try searching for "pasadena coffee" or "restaurants near me"
              </p>
            </section>
          )}
        </SearchErrorBoundary>
      </main>

      {/* API Base Info */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <div className="text-xs text-slate-400">
          API Base: {apiBase || 'Not configured'} | 
          Auto-search delay: 400ms | 
          {loading && ' Searching...'} 
          {!loading && lastSearchQuery && ` Last search: "${lastSearchQuery}"`}
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
