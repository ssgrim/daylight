# Daylight

Cloud-first trip planning and live re-planning engine.

## Documentation

For the full implementation plan and architecture details, see:

- [Daylight v1 Implementation Pack (AWS, React, Vite, Terraform, CI)](docs/daylight_v_1_implementation_pack_aws_react_vite_terraform_ci.md)

## Backend API Hardening

### Google Places API

The Google Places API fetch has been hardened with:

- **Timeout**: ≤ 8 seconds maximum request timeout
- **Retry Strategy**: 3 attempts with exponential backoff + jitter on 5xx/network errors
- **Fast-fail**: No retries on 4xx client errors
- **Error Mapping**: Meaningful HTTP status codes and error messages returned to API consumers

#### Implementation Details

- **File**: `backend/places.js`
- **Utilities**: `backend/src/lib/http-utils.js`
- **Retry Logic**: Exponential backoff (200ms base) with ±25% jitter
- **Timeout Handling**: AbortController with configurable timeout
- **Error Categories**:
  - 4xx → 400 (Bad request to external service)
  - 5xx → 502 (External service error)
  - Timeout → 504 (Gateway timeout)
  - Network → 502 (Network error)

## API Caching & Cost Reduction

### Multi-Layer Caching Strategy

The API implements a comprehensive caching strategy to reduce external API calls and costs:

1. **LRU In-Memory Cache** (per Lambda warm instance)
2. **Optional DynamoDB Table** with TTL for persistent caching
3. **Cache-Control Headers** for client-side caching

#### Caching Implementation

- **Files**:
  - `backend/src/lib/lru-cache.js` - LRU cache implementation
  - `backend/src/lib/cache-layer.js` - Multi-layer cache coordinator
  - `backend/places.js` - Google Places with caching
  - `backend/src/handlers/plan.ts` - Plan endpoint with caching

#### Cache Configuration

- **Places API**: 1 hour TTL (searches are relatively stable)
- **Plan API**: 30 minutes TTL (location-based results)
- **LRU Size**: 100 items per Lambda instance
- **DynamoDB**: Optional, enabled via `ENABLE_CACHE_DDB=true`

#### Environment Variables

```bash
# Enable DynamoDB caching (optional)
ENABLE_CACHE_DDB=true

# DynamoDB table name (optional, defaults to 'daylight-cache')
CACHE_TABLE_NAME=daylight-cache-dev
```

#### Cache Behavior

- **Cache Hit**: Returns cached data with `X-Cache: HIT` header
- **Cache Miss**: Fetches fresh data, caches it, returns with `X-Cache: MISS` header
- **TTL Expiration**: Automatic cleanup via DynamoDB TTL or LRU eviction
- **Fallback**: LRU → DynamoDB → Fresh API call

#### Cost Benefits

- **Google Places**: ~90% reduction in API calls for common searches
- **Lambda**: Faster response times from in-memory cache
- **DynamoDB**: Optional persistence across Lambda cold starts

## Input Validation & Output Schema

### Request Validation

All API endpoints implement comprehensive input validation:

- **Query Parameters**: Validated for type, length, and format
- **Coordinates**: Range validation (-90≤lat≤90, -180≤lng≤180)
- **Standardized Errors**: Consistent 400 responses with detailed error information

#### Validation Rules

**Places API (`/places`)**:

- `query`: Required string, 1-120 characters, non-empty after trimming

**Plan API (`/plan`)**:

- `lat`: Optional number, -90 to 90 degrees
- `lng`: Optional number, -180 to 180 degrees
- Both coordinates required if either is provided

#### Error Response Format

```json
{
  "error": "Validation failed",
  "message": "Query parameter must be 120 characters or less",
  "field": "query",
  "type": "validation_error"
}
```

### Output Schema Documentation

**API Documentation**: [OpenAPI Specification](docs/openapi/daylight-api.yaml)

**TypeScript Types**: [`backend/src/types/api-schemas.ts`](backend/src/types/api-schemas.ts)

#### Response Examples

**Places API Response**:

```json
{
  "query": "coffee shops",
  "count": 3,
  "results": [
    {
      "name": "Blue Bottle Coffee",
      "address": "66 Mint St, San Francisco, CA 94103",
      "rating": 4.5,
      "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "location": { "lat": 37.7749, "lng": -122.4194 }
    }
  ]
}
```

**Plan API Response**:

```json
[
  {
    "id": "1",
    "title": "Demo Stop near 37.775,-122.419",
    "start": "2025-08-24T15:30:00.000Z",
    "end": "2025-08-24T16:30:00.000Z",
    "score": 95,
    "location": { "lat": 37.775, "lng": -122.419 }
  }
]
```

#### Implementation Files

- **Validation**: `backend/src/lib/validation.cjs`
- **API Schema Types**: `backend/src/types/api-schemas.ts`
- **OpenAPI Spec**: `docs/openapi/daylight-api.yaml`

## Frontend Map Visualization

### Interactive Map View

The frontend provides toggleable list/map views for search results with interactive mapping features:

- **View Toggle**: Switch between list and map views
- **Interactive Markers**: Click markers to view place details in popups
- **Auto-fit Bounds**: Map automatically fits to show all search results
- **Responsive Design**: Map adapts to container size and device

#### Map Features

- **Marker Popups**: Show place name, address, and rating
- **Results Counter**: Display count of mapped vs total results  
- **Loading States**: Smooth loading experience with spinner
- **Fallback UI**: Graceful handling when Mapbox token is missing
- **Navigation Controls**: Zoom and pan controls built-in

#### Setup Requirements

**Mapbox Token**: Set `VITE_MAPBOX_TOKEN` in your environment

```bash
# Get token from: https://account.mapbox.com/access-tokens/
VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here
```

#### Map Implementation Files

- **Map Component**: `frontend/src/components/MapView.tsx`
- **View Toggle**: `frontend/src/components/ViewToggle.tsx`
- **Integration**: `frontend/src/pages/Plan.tsx`
- **Tests**: `frontend/tests/map-visualization.spec.ts`

## Frontend UI Enhancements

### Smooth User Experience

The frontend implements a polished, responsive interface with professional UX patterns:

#### Auto-Search with Debouncing

- **400ms debounce delay** - Searches automatically as user types
- **Character counter** - Shows typing progress (0/120 chars)
- **Immediate feedback** - Visual indicators during search
- **Smart clearing** - Results clear instantly when search is cleared

#### Loading States & Skeletons

- **Skeleton loaders** - Animated placeholders during fetch
- **In-field spinner** - Loading indicator inside search input
- **Progressive states** - Welcome → Searching → Results/Error
- **Smooth transitions** - CSS transitions for state changes

#### Error Handling & Recovery

- **Toast notifications** - Success/error messages with auto-dismiss
- **Retry functionality** - One-click retry with loading states
- **Persistent error toasts** - Critical errors stay until dismissed
- **Detailed error context** - Helpful error messages and recovery hints

#### UI Components

- **Search Input**: Auto-search with debounce, character limits, loading indicators
- **Toast System**: Success/error notifications with animations
- **Skeleton Loaders**: Animated placeholders matching content structure
- **Retry Buttons**: Loading states, icons, smart enabling/disabling
- **Result Cards**: Hover effects, smooth transitions, structured data display

#### Implementation Files

- **Debounce Hook**: `frontend/src/hooks/useDebounce.ts`
- **Toast System**: `frontend/src/components/Toast.tsx`
- **Skeleton Loaders**: `frontend/src/components/Skeleton.tsx`
- **Retry Button**: `frontend/src/components/RetryButton.tsx`
- **Enhanced Plan Page**: `frontend/src/pages/Plan.tsx`
- **UI Tests**: `frontend/tests/smooth-ui.spec.ts`

#### User Experience Features

```typescript
// Auto-search with debouncing
const debouncedQuery = useDebounce(query, 400);

// Toast notifications
showSuccess(`Found ${results.length} places`, 3000);
showError('Search failed: Network error', 0); // Persistent

// Loading states
{loading && <SearchResultsSkeleton count={3} />}

// Retry functionality
<RetryButton onRetry={handleRetry} loading={loading} />
```
