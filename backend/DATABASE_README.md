# Production Database Layer & Data Architecture

## Overview

This implementation provides a comprehensive production-grade database infrastructure for the Daylight application, addressing Issue #111. The system includes:

- **Multi-database support** (DynamoDB primary, with SQLite for development)
- **Real-time monitoring** and performance tracking
- **Automated data retention** and archival policies
- **Database migration** system from existing SQLite setup
- **Connection pooling** and optimization
- **Health monitoring** and alerting
- **Security** and encryption features

## Architecture

### Core Components

1. **Database Configuration (`databaseConfig.ts`)**
   - Comprehensive configuration management
   - Environment-specific settings
   - Security and performance parameters

2. **Connection Management (`databaseConnections.ts`)**
   - Multi-database connection pooling
   - Health monitoring
   - Graceful connection handling

3. **Migration System (`databaseMigration.ts`)**
   - SQLite to DynamoDB migration
   - Schema management
   - Data integrity verification

4. **Monitoring (`databaseMonitoring.ts`)**
   - Real-time performance metrics
   - Query instrumentation
   - Alerting system

5. **Data Retention (`databaseRetention.ts`)**
   - Automated data lifecycle management
   - Archival to S3/Glacier
   - Compliance policies

6. **Database Service (`databaseService.ts`)**
   - Main integration layer
   - Unified API for all operations
   - Service management

## Quick Start

### 1. Installation

The database layer uses the existing dependencies in `package.json`. Make sure you have:

```bash
npm install
```

### 2. Environment Configuration

Copy the appropriate environment file:

```bash
# For development
cp .env.development .env

# For production
cp .env.production .env
```

Edit the `.env` file with your specific configuration:

```bash
# Essential settings
NODE_ENV=development
DATABASE_PRIMARY=dynamodb
AWS_REGION=us-east-1

# For local development with DynamoDB Local
DYNAMODB_ENDPOINT=http://localhost:8000
```

### 3. Database Migration

Run the migration script to set up the production database:

```bash
# Run full migration
npm run migrate

# Or use the migration script directly
node migrate-database.mjs
```

### 4. Integration with Application

Update your application to use the new database service:

```typescript
import { initializeDatabase, locationHistoryService, userService } from './src/database.js';

// Initialize at application startup
await initializeDatabase();

// Use the services
await locationHistoryService.addLocationHistory(userId, location, activity);
const user = await userService.getUserById(userId);
```

## Database Schema

### Tables Structure

#### Core Data Tables
- **users** - User account information
- **user_profiles** - Extended user profile data
- **user_sessions** - Active user sessions with TTL
- **plans** - User planning data
- **locations** - Location information
- **location_history** - Historical location data with TTL

#### Cache Tables
- **weather_cache** - Weather data with TTL
- **traffic_data** - Traffic information with TTL
- **events_cache** - Event data with TTL

#### Analytics Tables
- **usage_analytics** - User activity tracking
- **performance_metrics** - System performance data
- **error_logs** - Error tracking and logging

#### Security Tables (from existing framework)
- **auth_sessions** - Authentication sessions
- **audit_logs** - Security audit trail
- **roles** - User roles
- **permissions** - Permission definitions

#### API Management Tables (from existing framework)
- **api_keys** - API key management
- **api_usage** - API usage tracking
- **rate_limits** - Rate limiting data

### Data Retention Policies

#### Hot Data (Frequently Accessed)
- **user_sessions**: 30 days
- **location_history**: 90 days
- **weather_cache**: 7 days
- **traffic_data**: 30 days
- **events_cache**: 14 days
- **performance_metrics**: 30 days

#### Warm Data (Occasionally Accessed)
- **plans**: 365 days
- **usage_analytics**: 365 days
- **error_logs**: 90 days
- **api_usage**: 365 days

#### Cold Data (Archived but Retained)
- **audit_logs**: 2555 days (7 years for compliance)
- **user_profiles**: 2555 days
- **locations**: 1095 days (3 years)
- **users**: 2555 days

## Services API

### Location History Service

```typescript
import { locationHistoryService } from './src/database.js';

// Add location history
await locationHistoryService.addLocationHistory(userId, location, activity, metadata);

// Get user's location history
const history = await locationHistoryService.getUserLocationHistory(userId, limit);

// Get history by date range
const rangeHistory = await locationHistoryService.getLocationHistoryByDateRange(
  userId, startDate, endDate
);
```

### User Service

```typescript
import { userService } from './src/database.js';

// Create user with profile
const { user, profile } = await userService.createUser(userData);

// Get user by ID or email
const user = await userService.getUserById(userId);
const user = await userService.getUserByEmail(email);

// Update user and profile
await userService.updateUser(userId, updates);
await userService.updateUserProfile(userId, profileUpdates);
```

### Planning Service

```typescript
import { planningService } from './src/database.js';

// Create and manage plans
await planningService.createPlan(userId, planData);
const plans = await planningService.getUserPlans(userId);
await planningService.updatePlan(planId, userId, updates);
```

### Cache Service

```typescript
import { cacheService } from './src/database.js';

// Weather caching
await cacheService.setWeatherCache(locationKey, weatherData, ttlMinutes);
const cachedWeather = await cacheService.getWeatherCache(locationKey);

// Traffic caching
await cacheService.setTrafficCache(routeKey, trafficData, ttlMinutes);
const cachedTraffic = await cacheService.getTrafficCache(routeKey);
```

### Analytics Service

```typescript
import { analyticsService } from './src/database.js';

// Record usage events
await analyticsService.recordUsageEvent(userId, eventType, eventData);

// Get analytics data
const userAnalytics = await analyticsService.getUserAnalytics(userId, days);
const dailyAnalytics = await analyticsService.getDailyAnalytics(date);
```

## Monitoring & Alerting

### Performance Monitoring

The system automatically tracks:
- Query response times
- Error rates
- Connection pool utilization
- Throughput metrics

### Health Checks

```bash
# Check database status
npm run db:status

# Manual health check
node -e "import('./src/database.js').then(({performDatabaseHealthCheck}) => performDatabaseHealthCheck().then(console.log))"
```

### Alerts

Configure alerting channels in your environment:

```bash
ALERT_EMAIL=admin@yourdomain.com
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/...
ALERT_SNS_TOPIC=arn:aws:sns:us-east-1:123456789:alerts
```

## Migration from SQLite

The system includes automatic migration from the existing SQLite database:

1. **Automatic Migration**: Set `MIGRATE_FROM_SQLITE=true` in your environment
2. **Manual Migration**: Run the migration script with SQLite data present
3. **Verification**: Check migration logs for data integrity

```bash
# Enable automatic migration during initialization
MIGRATE_FROM_SQLITE=true npm run migrate
```

## Production Deployment

### AWS Setup

1. **DynamoDB Tables**: Created automatically during migration
2. **IAM Permissions**: Ensure proper DynamoDB access
3. **VPC Configuration**: Configure for security if needed
4. **Backup Strategy**: Point-in-time recovery enabled
5. **Monitoring**: CloudWatch integration available

### Security

- **Encryption at rest** and in transit
- **IAM authentication** for production
- **VPC isolation** when configured
- **Key rotation** policies
- **Audit logging** for compliance

### Performance

- **Connection pooling** optimized for load
- **Read replicas** for scaling
- **Automatic indexing** for query optimization
- **Caching layers** for frequently accessed data
- **TTL policies** for automatic cleanup

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check AWS credentials
   - Verify region configuration
   - Test network connectivity

2. **Migration Errors**
   - Ensure SQLite database is accessible
   - Check table permissions
   - Verify data format compatibility

3. **Performance Issues**
   - Review slow query logs
   - Check connection pool settings
   - Monitor resource utilization

### Debug Commands

```bash
# Check service status
npm run db:status

# View migration logs
grep "migration" backend/dev-server.log

# Test database health
node -e "import('./src/lib/databaseService.js').then(({getDatabaseMetrics}) => getDatabaseMetrics().then(console.log))"
```

### Logs

Logs are structured and include:
- Query performance metrics
- Error tracking
- Migration progress
- Health check results
- Alert notifications

## Environment Variables Reference

See `.env.production` and `.env.development` for complete configuration options.

Key variables:
- `NODE_ENV`: Environment setting
- `DATABASE_PRIMARY`: Primary database type
- `AWS_REGION`: AWS region for DynamoDB
- `DB_METRICS_ENABLED`: Enable performance monitoring
- `DB_ALERTS_ENABLED`: Enable alerting system
- `MIGRATE_FROM_SQLITE`: Enable automatic SQLite migration

## Integration with Existing Code

The database layer is designed to integrate seamlessly with existing Daylight code:

1. **Backward Compatibility**: Maintains existing API patterns
2. **Service Layer**: Clean separation between database and business logic
3. **Error Handling**: Comprehensive error tracking and logging
4. **Performance**: Optimized for production workloads
5. **Monitoring**: Real-time visibility into database operations

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review environment configuration
3. Examine application logs
4. Verify AWS/DynamoDB setup
5. Test with development environment first
