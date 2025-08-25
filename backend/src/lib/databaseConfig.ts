// Production Database Architecture
// Issue #111 - Production Database Layer & Data Architecture

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// ===== Database Configuration =====

export interface DatabaseConfig {
  environment: 'development' | 'staging' | 'production';
  primary: 'dynamodb' | 'postgresql' | 'mongodb';
  enableMultiDatabase: boolean;
  connectionPooling: boolean;
  replication: {
    enabled: boolean;
    readReplicas: number;
    crossRegion: boolean;
  };
  backup: {
    pointInTimeRecovery: boolean;
    continuousBackup: boolean;
    retentionDays: number;
    crossRegionBackup: boolean;
  };
  monitoring: {
    slowQueryLogging: boolean;
    performanceInsights: boolean;
    cloudWatchIntegration: boolean;
  };
  security: {
    encryption: {
      atRest: boolean;
      inTransit: boolean;
      keyRotation: boolean;
    };
    access: {
      iamAuthentication: boolean;
      vpc: boolean;
      networkIsolation: boolean;
    };
  };
}

export const DB_CONFIG: DatabaseConfig = {
  environment: (process.env.NODE_ENV as any) || 'development',
  primary: (process.env.DATABASE_PRIMARY as any) || 'dynamodb',
  enableMultiDatabase: process.env.ENABLE_MULTI_DB === 'true',
  connectionPooling: process.env.CONNECTION_POOLING !== 'false',
  
  replication: {
    enabled: process.env.DB_REPLICATION_ENABLED === 'true',
    readReplicas: parseInt(process.env.DB_READ_REPLICAS || '2'),
    crossRegion: process.env.DB_CROSS_REGION_REPLICATION === 'true'
  },
  
  backup: {
    pointInTimeRecovery: process.env.DB_PITR_ENABLED !== 'false',
    continuousBackup: process.env.DB_CONTINUOUS_BACKUP === 'true',
    retentionDays: parseInt(process.env.DB_BACKUP_RETENTION_DAYS || '30'),
    crossRegionBackup: process.env.DB_CROSS_REGION_BACKUP === 'true'
  },
  
  monitoring: {
    slowQueryLogging: process.env.DB_SLOW_QUERY_LOG !== 'false',
    performanceInsights: process.env.DB_PERFORMANCE_INSIGHTS === 'true',
    cloudWatchIntegration: process.env.DB_CLOUDWATCH_INTEGRATION !== 'false'
  },
  
  security: {
    encryption: {
      atRest: process.env.DB_ENCRYPTION_AT_REST !== 'false',
      inTransit: process.env.DB_ENCRYPTION_IN_TRANSIT !== 'false',
      keyRotation: process.env.DB_KEY_ROTATION === 'true'
    },
    access: {
      iamAuthentication: process.env.DB_IAM_AUTH === 'true',
      vpc: process.env.DB_VPC_ENABLED !== 'false',
      networkIsolation: process.env.DB_NETWORK_ISOLATION === 'true'
    }
  }
};

// ===== Connection Configuration =====

export const CONNECTION_CONFIG = {
  // DynamoDB
  dynamodb: {
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    maxRetries: parseInt(process.env.DYNAMODB_MAX_RETRIES || '3'),
    retryDelayOptions: {
      base: parseInt(process.env.DYNAMODB_RETRY_BASE || '100')
    }
  },
  
  // PostgreSQL
  postgresql: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'daylight',
    username: process.env.POSTGRES_USER || 'daylight_user',
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false,
    pool: {
      min: parseInt(process.env.POSTGRES_POOL_MIN || '2'),
      max: parseInt(process.env.POSTGRES_POOL_MAX || '20'),
      acquireTimeoutMillis: parseInt(process.env.POSTGRES_ACQUIRE_TIMEOUT || '30000'),
      idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000')
    }
  },
  
  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/daylight',
    options: {
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '20'),
      minPoolSize: parseInt(process.env.MONGODB_POOL_MIN || '2'),
      maxIdleTimeMS: parseInt(process.env.MONGODB_IDLE_TIMEOUT || '30000'),
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_TIMEOUT || '5000'),
      retryWrites: true,
      w: 'majority'
    }
  },
  
  // RDS Data API (Aurora Serverless)
  rdsData: {
    region: process.env.AWS_REGION || 'us-east-1',
    resourceArn: process.env.RDS_CLUSTER_ARN,
    secretArn: process.env.RDS_SECRET_ARN,
    database: process.env.RDS_DATABASE || 'daylight'
  }
};

// ===== Table/Collection Schemas =====

export const DATABASE_SCHEMAS = {
  // Core Application Data
  users: {
    dynamodb: 'daylight-users',
    postgresql: 'users',
    mongodb: 'users'
  },
  
  user_profiles: {
    dynamodb: 'daylight-user-profiles',
    postgresql: 'user_profiles',
    mongodb: 'user_profiles'
  },
  
  user_sessions: {
    dynamodb: 'daylight-user-sessions',
    postgresql: 'user_sessions',
    mongodb: 'user_sessions'
  },
  
  // Planning & Location Data
  plans: {
    dynamodb: 'daylight-plans',
    postgresql: 'plans',
    mongodb: 'plans'
  },
  
  locations: {
    dynamodb: 'daylight-locations',
    postgresql: 'locations',
    mongodb: 'locations'
  },
  
  location_history: {
    dynamodb: 'daylight-location-history',
    postgresql: 'location_history',
    mongodb: 'location_history'
  },
  
  // External API Data
  weather_cache: {
    dynamodb: 'daylight-weather-cache',
    postgresql: 'weather_cache',
    mongodb: 'weather_cache'
  },
  
  traffic_data: {
    dynamodb: 'daylight-traffic-data',
    postgresql: 'traffic_data',
    mongodb: 'traffic_data'
  },
  
  events_cache: {
    dynamodb: 'daylight-events-cache',
    postgresql: 'events_cache',
    mongodb: 'events_cache'
  },
  
  // Analytics & Metrics
  usage_analytics: {
    dynamodb: 'daylight-usage-analytics',
    postgresql: 'usage_analytics',
    mongodb: 'usage_analytics'
  },
  
  performance_metrics: {
    dynamodb: 'daylight-performance-metrics',
    postgresql: 'performance_metrics',
    mongodb: 'performance_metrics'
  },
  
  error_logs: {
    dynamodb: 'daylight-error-logs',
    postgresql: 'error_logs',
    mongodb: 'error_logs'
  },
  
  // Security & Compliance (from existing security framework)
  auth_sessions: {
    dynamodb: 'daylight-auth-sessions',
    postgresql: 'auth_sessions',
    mongodb: 'auth_sessions'
  },
  
  audit_logs: {
    dynamodb: 'daylight-audit-logs',
    postgresql: 'audit_logs',
    mongodb: 'audit_logs'
  },
  
  roles: {
    dynamodb: 'daylight-roles',
    postgresql: 'roles',
    mongodb: 'roles'
  },
  
  permissions: {
    dynamodb: 'daylight-permissions',
    postgresql: 'permissions',
    mongodb: 'permissions'
  },
  
  // API Management (from existing API framework)
  api_keys: {
    dynamodb: 'daylight-api-keys',
    postgresql: 'api_keys',
    mongodb: 'api_keys'
  },
  
  api_usage: {
    dynamodb: 'daylight-api-usage',
    postgresql: 'api_usage',
    mongodb: 'api_usage'
  },
  
  rate_limits: {
    dynamodb: 'daylight-rate-limits',
    postgresql: 'rate_limits',
    mongodb: 'rate_limits'
  }
};

// ===== Data Retention Policies =====

export const DATA_RETENTION = {
  // Hot data (frequently accessed)
  hot: {
    user_sessions: 30, // days
    location_history: 90,
    weather_cache: 7,
    traffic_data: 30,
    events_cache: 14,
    performance_metrics: 30
  },
  
  // Warm data (occasionally accessed)
  warm: {
    plans: 365,
    usage_analytics: 365,
    error_logs: 90,
    api_usage: 365
  },
  
  // Cold data (archived but retained)
  cold: {
    audit_logs: 2555, // 7 years for compliance
    user_profiles: 2555,
    locations: 1095, // 3 years
    users: 2555
  },
  
  // Archive policies
  archive: {
    enabled: true,
    storage: 's3',
    compression: true,
    encryption: true
  }
};

// ===== Performance Optimization =====

export const PERFORMANCE_CONFIG = {
  // Caching
  caching: {
    redis: {
      enabled: process.env.REDIS_ENABLED === 'true',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ttl: parseInt(process.env.REDIS_TTL || '3600'),
      cluster: process.env.REDIS_CLUSTER === 'true'
    },
    
    memcached: {
      enabled: process.env.MEMCACHED_ENABLED === 'true',
      servers: process.env.MEMCACHED_SERVERS || 'localhost:11211',
      ttl: parseInt(process.env.MEMCACHED_TTL || '3600')
    },
    
    application: {
      enabled: true,
      maxSize: parseInt(process.env.APP_CACHE_SIZE || '1000'),
      ttl: parseInt(process.env.APP_CACHE_TTL || '300')
    }
  },
  
  // Read/Write Optimization
  optimization: {
    readPreference: 'secondary' as const,
    writeConcern: { w: 'majority', j: true },
    batchSize: parseInt(process.env.DB_BATCH_SIZE || '100'),
    parallelReads: parseInt(process.env.DB_PARALLEL_READS || '5'),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
    queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000')
  },
  
  // Indexing Strategy
  indexing: {
    autoIndex: process.env.DB_AUTO_INDEX !== 'false',
    backgroundIndex: process.env.DB_BACKGROUND_INDEX !== 'false',
    compactThreshold: parseFloat(process.env.DB_COMPACT_THRESHOLD || '0.3'),
    analyzeFrequency: process.env.DB_ANALYZE_FREQUENCY || 'daily'
  }
};

// ===== Monitoring & Alerting =====

export const MONITORING_CONFIG = {
  metrics: {
    enabled: process.env.DB_METRICS_ENABLED !== 'false',
    interval: parseInt(process.env.DB_METRICS_INTERVAL || '60'),
    retention: parseInt(process.env.DB_METRICS_RETENTION || '30'),
    
    thresholds: {
      connectionUtilization: parseFloat(process.env.DB_CONN_THRESHOLD || '0.8'),
      queryLatency: parseInt(process.env.DB_LATENCY_THRESHOLD || '1000'),
      errorRate: parseFloat(process.env.DB_ERROR_THRESHOLD || '0.05'),
      diskUtilization: parseFloat(process.env.DB_DISK_THRESHOLD || '0.8'),
      cpuUtilization: parseFloat(process.env.DB_CPU_THRESHOLD || '0.8')
    }
  },
  
  alerts: {
    enabled: process.env.DB_ALERTS_ENABLED !== 'false',
    channels: {
      email: process.env.ALERT_EMAIL,
      slack: process.env.ALERT_SLACK_WEBHOOK,
      pagerduty: process.env.ALERT_PAGERDUTY_KEY,
      sns: process.env.ALERT_SNS_TOPIC
    },
    
    severityLevels: {
      critical: ['connection_failure', 'data_corruption', 'security_breach'],
      warning: ['high_latency', 'connection_limit', 'disk_space'],
      info: ['backup_complete', 'maintenance_window', 'index_rebuild']
    }
  },
  
  logging: {
    level: process.env.DB_LOG_LEVEL || 'info',
    structured: process.env.DB_STRUCTURED_LOGGING !== 'false',
    aggregation: process.env.DB_LOG_AGGREGATION !== 'false',
    retention: parseInt(process.env.DB_LOG_RETENTION || '30')
  }
};

// ===== Migration & Deployment =====

export const MIGRATION_CONFIG = {
  versioning: {
    enabled: true,
    table: 'schema_migrations',
    lockTimeout: parseInt(process.env.MIGRATION_LOCK_TIMEOUT || '300'),
    rollbackSupport: true
  },
  
  deployment: {
    blueGreen: process.env.DEPLOYMENT_STRATEGY === 'blue-green',
    canary: process.env.DEPLOYMENT_STRATEGY === 'canary',
    rollback: {
      automatic: process.env.AUTO_ROLLBACK === 'true',
      healthCheck: process.env.ROLLBACK_HEALTH_CHECK !== 'false',
      timeout: parseInt(process.env.ROLLBACK_TIMEOUT || '600')
    }
  },
  
  validation: {
    dataIntegrity: true,
    performanceRegression: true,
    schemaCompatibility: true,
    backupVerification: true
  }
};

// ===== Environment-Specific Overrides =====

export function getEnvironmentConfig(): Partial<DatabaseConfig> {
  switch (DB_CONFIG.environment) {
    case 'development':
      return {
        replication: { enabled: false, readReplicas: 0, crossRegion: false },
        backup: { pointInTimeRecovery: false, continuousBackup: false, retentionDays: 7, crossRegionBackup: false },
        monitoring: { slowQueryLogging: true, performanceInsights: false, cloudWatchIntegration: false },
        security: {
          encryption: { atRest: false, inTransit: false, keyRotation: false },
          access: { iamAuthentication: false, vpc: false, networkIsolation: false }
        }
      };
      
    case 'staging':
      return {
        replication: { enabled: false, readReplicas: 1, crossRegion: false },
        backup: { pointInTimeRecovery: true, continuousBackup: false, retentionDays: 14, crossRegionBackup: false },
        monitoring: { slowQueryLogging: true, performanceInsights: true, cloudWatchIntegration: true },
        security: {
          encryption: { atRest: true, inTransit: true, keyRotation: false },
          access: { iamAuthentication: true, vpc: true, networkIsolation: false }
        }
      };
      
    case 'production':
      return {
        replication: { enabled: true, readReplicas: 3, crossRegion: true },
        backup: { pointInTimeRecovery: true, continuousBackup: true, retentionDays: 30, crossRegionBackup: true },
        monitoring: { slowQueryLogging: true, performanceInsights: true, cloudWatchIntegration: true },
        security: {
          encryption: { atRest: true, inTransit: true, keyRotation: true },
          access: { iamAuthentication: true, vpc: true, networkIsolation: true }
        }
      };
      
    default:
      return {};
  }
}

// ===== Export Configuration =====

export const FINAL_CONFIG = {
  ...DB_CONFIG,
  ...getEnvironmentConfig()
};
