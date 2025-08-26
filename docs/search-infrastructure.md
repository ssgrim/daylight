# Search Infrastructure & Geospatial Indexing

**Issue #112** - Implementation of enterprise-grade search capabilities with OpenSearch/Elasticsearch, geospatial indexing, and full-text search.

## Overview

This implementation provides comprehensive search infrastructure for the Daylight trip planning application, enabling fast POI (Point of Interest) discovery, geospatial queries, and full-text search capabilities.

## Architecture

### Components

1. **OpenSearch Cluster** - AWS managed OpenSearch service for search and indexing
2. **Search Service** - Core search functionality with geospatial capabilities
3. **Search Handler** - Public API endpoints for search operations
4. **Search Admin Handler** - Administrative operations for index management
5. **Search Indexing Service** - Data population and synchronization

### Infrastructure Features

- **Enterprise-grade OpenSearch cluster** with configurable instance types
- **Geospatial indexing** with geo_point mapping for location-based queries
- **Full-text search** with custom analyzers and multi-field mapping
- **Faceted search** with aggregations for filtering
- **Search suggestions** with completion suggester
- **Security** with IAM-based access control and encryption
- **Monitoring** with CloudWatch logging and health checks
- **VPC support** for production deployments

## API Endpoints

### Search API (`/search`)

#### Search Locations
```bash
GET /search?q=restaurant&lat=37.7749&lon=-122.4194&radius=5km&category=dining&facets=category,subcategory
```

#### Search Request Body (POST)
```json
{
  "action": "search",
  "query": {
    "query": "coffee shop",
    "location": {
      "lat": 37.7749,
      "lon": -122.4194,
      "radius": "2km"
    },
    "filters": {
      "category": ["dining"],
      "rating": { "min": 4.0 },
      "openNow": true
    },
    "sort": [{ "field": "_score", "order": "desc" }],
    "facets": ["category", "subcategory"],
    "limit": 20,
    "offset": 0
  }
}
```

#### Search Suggestions
```bash
GET /search?action=suggest&prefix=starbuc&limit=10
```

### Search Admin API (`/search/admin`)

Protected endpoints requiring Bearer token authentication.

#### Initialize Index
```bash
POST /search/admin
Authorization: Bearer <admin-token>
{
  "action": "initialize"
}
```

#### Reindex All Data
```bash
POST /search/admin
Authorization: Bearer <admin-token>
{
  "action": "reindex"
}
```

#### Index New Locations
```bash
POST /search
{
  "action": "index",
  "locations": [
    {
      "id": "location-123",
      "name": "Great Coffee Shop",
      "location": { "lat": 37.7749, "lon": -122.4194 },
      "category": "dining",
      "subcategory": "cafe",
      "tags": ["coffee", "wifi", "outdoor seating"],
      "rating": 4.5,
      "metadata": {
        "source": "manual",
        "lastUpdated": "2025-08-26T00:00:00Z",
        "verified": true
      }
    }
  ]
}
```

## Data Model

### SearchableLocation Interface

```typescript
interface SearchableLocation {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  description?: string;          // Description text
  location: {                    // Geospatial coordinates
    lat: number;
    lon: number;
  };
  address?: string;              // Full address
  category: string;              // Primary category
  subcategory?: string;          // Sub-category
  tags: string[];                // Searchable tags
  rating?: number;               // 0-5 rating
  priceLevel?: number;           // 1-4 price level
  openingHours?: {               // Operating hours
    [day: string]: { open: string; close: string } | null;
  };
  metadata: {                    // System metadata
    source: string;
    lastUpdated: string;
    verified: boolean;
  };
}
```

## Search Capabilities

### Full-Text Search
- Multi-field search across name, description, address, and tags
- Fuzzy matching with configurable fuzziness
- Boosted fields (name^3, description^2)
- Stop word filtering and normalization

### Geospatial Search
- Distance-based filtering with configurable radius
- Sort by distance from point
- Geo-bounds aggregations
- Support for km/mi units

### Faceted Search
- Category and subcategory facets
- Rating and price level ranges
- Tag-based filtering
- Dynamic aggregation counts

### Advanced Features
- **Auto-complete suggestions** with completion suggester
- **Search analytics** with aggregation statistics
- **Relevance scoring** with custom boost factors
- **Open now filtering** (time-aware, simplified implementation)

## Deployment

### Terraform Configuration

The search infrastructure is defined in `infra/terraform/search.tf` with the following resources:

- `aws_opensearch_domain.search` - OpenSearch cluster
- `aws_lambda_function.search` - Search API handler
- `aws_lambda_function.search_admin` - Admin operations handler
- `aws_cloudwatch_log_group.*` - Logging configuration
- Optional VPC resources for production security

### Environment Variables

#### Search Lambdas
```bash
OPENSEARCH_ENDPOINT=<opensearch-domain-endpoint>
OPENSEARCH_REGION=<aws-region>
TABLE_TRIPS=<dynamodb-table-name>
```

#### Search Admin Lambda
```bash
SEARCH_ADMIN_TOKEN=<admin-auth-token>
```

### Terraform Variables

```hcl
# Basic configuration
search_instance_type     = "t3.small.search"  # Instance type
search_instance_count    = 1                  # Number of instances
search_volume_size       = 20                 # EBS volume size (GB)

# Production settings
enable_vpc_search        = false              # Enable VPC (recommended for prod)
search_admin_token       = "secure-token"     # Admin authentication token
```

## Security

### Access Control
- IAM-based access with least privilege principle
- Separate roles for search operations and admin functions
- Bearer token authentication for admin endpoints
- CORS configuration for web client access

### Encryption
- Encryption at rest enabled
- Node-to-node encryption
- HTTPS enforced with TLS 1.2+

### Network Security
- Optional VPC deployment for network isolation
- Security groups with restricted access
- CloudWatch logging for audit trails

## Monitoring & Operations

### Health Checks
```bash
GET /search?action=health
```

Returns OpenSearch cluster health and connectivity status.

### Analytics
```bash
GET /search/admin?action=analytics
Authorization: Bearer <admin-token>
```

Provides search usage statistics, popular categories, and performance metrics.

### Logging
- CloudWatch log groups for index/search operations
- Slow query logging enabled
- Error logging for troubleshooting

## Performance Optimization

### Indexing Strategy
- Bulk indexing for efficient data loading
- Custom analyzers for optimized text processing
- Appropriate field mappings for query types

### Query Optimization
- Configurable result limits and pagination
- Efficient geo-distance sorting
- Caching-friendly response structure

### Scaling Considerations
- Multi-AZ deployment for high availability
- Configurable instance counts for load handling
- EBS optimization for storage performance

## Sample Data

The implementation includes sample San Francisco Bay Area locations for testing:

- Golden Gate Bridge
- Alcatraz Island
- Fisherman's Wharf
- Union Square
- Lombard Street
- Chinatown
- Crissy Field
- Mission Dolores
- Tartine Bakery
- Swan Oyster Depot

## Development & Testing

### Local Development
1. Deploy OpenSearch cluster with Terraform
2. Install dependencies: `npm install @opensearch-project/opensearch`
3. Build: `npm run build`
4. Initialize index: `POST /search/admin {"action": "initialize"}`

### Testing Search Operations
```bash
# Test basic search
curl "$API_BASE/search?q=bridge&lat=37.8199&lon=-122.4783"

# Test geospatial search
curl "$API_BASE/search?lat=37.7749&lon=-122.4194&radius=5km"

# Test faceted search
curl "$API_BASE/search?category=dining&facets=subcategory,rating"
```

## Future Enhancements

### Planned Features
- Real-time data synchronization from external APIs
- Machine learning-based search ranking
- Personalized search results
- Multi-language search support
- Voice search integration

### External Data Integration
- Google Places API connector
- Yelp Business API integration
- OpenStreetMap POI extraction
- Social media venue detection

### Advanced Search Features
- Semantic search with vector embeddings
- Image-based location search
- Route-aware search optimization
- Temporal search patterns

## Troubleshooting

### Common Issues

1. **OpenSearch cluster unreachable**
   - Check VPC configuration and security groups
   - Verify IAM permissions for Lambda functions
   - Confirm cluster status in AWS console

2. **Indexing failures**
   - Check CloudWatch logs for detailed errors
   - Verify data format matches SearchableLocation interface
   - Ensure sufficient cluster storage

3. **Slow search performance**
   - Review query complexity and filters
   - Check cluster resources and scaling
   - Optimize search queries and field mappings

### Monitoring Commands
```bash
# Check cluster health
curl "$API_BASE/search?action=health"

# Get index statistics
curl -H "Authorization: Bearer <token>" "$API_BASE/search/admin?action=analytics"

# View recent logs
aws logs tail /aws/opensearch/domains/daylight-search-*/index-slow --follow
```

## Acceptance Criteria Status

- ✅ **Elasticsearch/OpenSearch cluster setup** - AWS OpenSearch domain with proper configuration
- ✅ **Geospatial indexing and search** - geo_point mapping with distance-based queries
- ✅ **Full-text search across POIs and content** - Multi-field search with custom analyzers
- ✅ **Faceted search and aggregations** - Category, rating, and tag-based facets
- ✅ **Search result ranking and relevance** - Configurable scoring with field boosting
- ✅ **Search analytics and optimization** - Comprehensive analytics and health monitoring

## Related Issues

- **#111 Production Database Layer** - Dependency for persistent storage
- **#101 Rich POI Database** - Dependency for location data
- **#114 API Management** - Related API infrastructure

## Contributors

Implementation of Issue #112 by the Daylight development team as part of the comprehensive search infrastructure initiative.
