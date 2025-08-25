// Database Integration Layer
// Issue #111 - Integration with existing Daylight application

import { databaseService, getTableName, queryTable, putItem, updateItem, deleteItem } from './lib/databaseService.js';

// ===== Location History Integration =====

export class LocationHistoryService {
  async addLocationHistory(userId: string, location: any, activity: string, metadata: any = {}) {
    const historyItem = {
      id: `history_${userId}_${Date.now()}`,
      userId,
      location,
      activity,
      metadata,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // TTL for automatic cleanup (90 days)
      ttl: Math.floor((Date.now() + (90 * 24 * 60 * 60 * 1000)) / 1000)
    };

    const tableName = getTableName('location_history');
    return await putItem(tableName, historyItem, userId);
  }

  async getUserLocationHistory(userId: string, limit: number = 50) {
    const tableName = getTableName('location_history');
    return await queryTable(tableName, {
      IndexName: 'UserTimestampIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Limit: limit,
      ScanIndexForward: false // Most recent first
    }, userId);
  }

  async getLocationHistoryByDateRange(userId: string, startDate: string, endDate: string) {
    const tableName = getTableName('location_history');
    return await queryTable(tableName, {
      IndexName: 'UserTimestampIndex',
      KeyConditionExpression: 'userId = :userId AND #timestamp BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':start': startDate,
        ':end': endDate
      }
    }, userId);
  }

  async deleteLocationHistory(historyId: string, userId: string) {
    const tableName = getTableName('location_history');
    return await deleteItem(tableName, { id: historyId }, userId);
  }
}

// ===== User Management Integration =====

export class UserService {
  async createUser(userData: any) {
    const user = {
      id: userData.id || `user_${Date.now()}`,
      email: userData.email,
      username: userData.username,
      passwordHash: userData.passwordHash,
      isActive: true,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: null
    };

    const tableName = getTableName('users');
    await putItem(tableName, user);

    // Create user profile
    const profile = {
      userId: user.id,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      avatar: userData.avatar || null,
      timezone: userData.timezone || 'UTC',
      preferences: userData.preferences || {},
      settings: userData.settings || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const profileTableName = getTableName('user_profiles');
    await putItem(profileTableName, profile);

    return { user, profile };
  }

  async getUserById(userId: string) {
    const tableName = getTableName('users');
    const result = await queryTable(tableName, {
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': userId
      }
    });

    return result.Items?.[0] || null;
  }

  async getUserByEmail(email: string) {
    const tableName = getTableName('users');
    const result = await queryTable(tableName, {
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    });

    return result.Items?.[0] || null;
  }

  async updateUser(userId: string, updates: any) {
    const tableName = getTableName('users');
    return await updateItem(tableName, { id: userId }, {
      UpdateExpression: 'SET #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
        ...Object.keys(updates).reduce((acc, key) => {
          acc[`#${key}`] = key;
          return acc;
        }, {} as any)
      },
      ExpressionAttributeValues: {
        ':updatedAt': new Date().toISOString(),
        ...Object.entries(updates).reduce((acc, [key, value]) => {
          acc[`:${key}`] = value;
          return acc;
        }, {} as any)
      }
    }, userId);
  }

  async getUserProfile(userId: string) {
    const profileTableName = getTableName('user_profiles');
    const result = await queryTable(profileTableName, {
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    return result.Items?.[0] || null;
  }

  async updateUserProfile(userId: string, profileUpdates: any) {
    const tableName = getTableName('user_profiles');
    return await updateItem(tableName, { userId }, {
      UpdateExpression: 'SET #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
        ...Object.keys(profileUpdates).reduce((acc, key) => {
          acc[`#${key}`] = key;
          return acc;
        }, {} as any)
      },
      ExpressionAttributeValues: {
        ':updatedAt': new Date().toISOString(),
        ...Object.entries(profileUpdates).reduce((acc, [key, value]) => {
          acc[`:${key}`] = value;
          return acc;
        }, {} as any)
      }
    }, userId);
  }
}

// ===== Planning Integration =====

export class PlanningService {
  async createPlan(userId: string, planData: any) {
    const plan = {
      id: planData.id || `plan_${userId}_${Date.now()}`,
      userId,
      title: planData.title,
      description: planData.description || '',
      location: planData.location,
      startTime: planData.startTime,
      endTime: planData.endTime,
      activities: planData.activities || [],
      preferences: planData.preferences || {},
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const tableName = getTableName('plans');
    return await putItem(tableName, plan, userId);
  }

  async getUserPlans(userId: string, limit: number = 20) {
    const tableName = getTableName('plans');
    return await queryTable(tableName, {
      IndexName: 'UserPlansIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Limit: limit,
      ScanIndexForward: false
    }, userId);
  }

  async getPlanById(planId: string, userId: string) {
    const tableName = getTableName('plans');
    const result = await queryTable(tableName, {
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': planId
      }
    }, userId);

    return result.Items?.[0] || null;
  }

  async updatePlan(planId: string, userId: string, updates: any) {
    const tableName = getTableName('plans');
    return await updateItem(tableName, { id: planId }, {
      UpdateExpression: 'SET #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#updatedAt': 'updatedAt',
        ...Object.keys(updates).reduce((acc, key) => {
          acc[`#${key}`] = key;
          return acc;
        }, {} as any)
      },
      ExpressionAttributeValues: {
        ':updatedAt': new Date().toISOString(),
        ...Object.entries(updates).reduce((acc, [key, value]) => {
          acc[`:${key}`] = value;
          return acc;
        }, {} as any)
      }
    }, userId);
  }

  async deletePlan(planId: string, userId: string) {
    const tableName = getTableName('plans');
    return await deleteItem(tableName, { id: planId }, userId);
  }
}

// ===== Cache Management =====

export class CacheService {
  async setWeatherCache(locationKey: string, weatherData: any, ttlMinutes: number = 60) {
    const cacheItem = {
      locationKey,
      data: weatherData,
      timestamp: new Date().toISOString(),
      ttl: Math.floor((Date.now() + (ttlMinutes * 60 * 1000)) / 1000)
    };

    const tableName = getTableName('weather_cache');
    return await putItem(tableName, cacheItem);
  }

  async getWeatherCache(locationKey: string) {
    const tableName = getTableName('weather_cache');
    const result = await queryTable(tableName, {
      KeyConditionExpression: 'locationKey = :key',
      ExpressionAttributeValues: {
        ':key': locationKey
      }
    });

    const item = result.Items?.[0];
    if (!item) return null;

    // Check if cache is still valid
    const now = Math.floor(Date.now() / 1000);
    if (item.ttl && item.ttl < now) {
      // Cache expired
      await this.deleteWeatherCache(locationKey);
      return null;
    }

    return item.data;
  }

  async deleteWeatherCache(locationKey: string) {
    const tableName = getTableName('weather_cache');
    return await deleteItem(tableName, { locationKey });
  }

  async setTrafficCache(routeKey: string, trafficData: any, ttlMinutes: number = 30) {
    const cacheItem = {
      routeKey,
      data: trafficData,
      timestamp: new Date().toISOString(),
      ttl: Math.floor((Date.now() + (ttlMinutes * 60 * 1000)) / 1000)
    };

    const tableName = getTableName('traffic_data');
    return await putItem(tableName, cacheItem);
  }

  async getTrafficCache(routeKey: string) {
    const tableName = getTableName('traffic_data');
    const result = await queryTable(tableName, {
      KeyConditionExpression: 'routeKey = :key',
      ExpressionAttributeValues: {
        ':key': routeKey
      }
    });

    const item = result.Items?.[0];
    if (!item) return null;

    // Check if cache is still valid
    const now = Math.floor(Date.now() / 1000);
    if (item.ttl && item.ttl < now) {
      return null;
    }

    return item.data;
  }
}

// ===== Analytics Service =====

export class AnalyticsService {
  async recordUsageEvent(userId: string, eventType: string, eventData: any = {}) {
    const analyticsItem = {
      id: `analytics_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      eventType,
      eventData,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0], // For date-based queries
      sessionId: eventData.sessionId || null,
      userAgent: eventData.userAgent || null
    };

    const tableName = getTableName('usage_analytics');
    return await putItem(tableName, analyticsItem, userId);
  }

  async getUserAnalytics(userId: string, days: number = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    const tableName = getTableName('usage_analytics');
    return await queryTable(tableName, {
      IndexName: 'UserAnalyticsIndex',
      KeyConditionExpression: 'userId = :userId AND #date BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#date': 'date'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':start': startDate,
        ':end': endDate
      }
    }, userId);
  }

  async getDailyAnalytics(date: string) {
    const tableName = getTableName('usage_analytics');
    return await queryTable(tableName, {
      IndexName: 'DateIndex',
      KeyConditionExpression: '#date = :date',
      ExpressionAttributeNames: {
        '#date': 'date'
      },
      ExpressionAttributeValues: {
        ':date': date
      }
    });
  }
}

// ===== Error Logging Service =====

export class ErrorLoggingService {
  async logError(error: Error, context: any = {}, userId?: string) {
    const errorItem = {
      id: `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      message: error.message,
      stack: error.stack || '',
      name: error.name,
      context,
      userId: userId || null,
      timestamp: new Date().toISOString(),
      severity: this.determineSeverity(error),
      resolved: false
    };

    const tableName = getTableName('error_logs');
    return await putItem(tableName, errorItem, userId);
  }

  async getErrorLogs(limit: number = 100, severity?: string) {
    const tableName = getTableName('error_logs');
    let params: any = {
      Limit: limit,
      ScanIndexForward: false
    };

    if (severity) {
      params.FilterExpression = 'severity = :severity';
      params.ExpressionAttributeValues = {
        ':severity': severity
      };
    }

    return await queryTable(tableName, params);
  }

  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('database') || message.includes('connection') || message.includes('timeout')) {
      return 'critical';
    }
    if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
      return 'high';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'medium';
    }
    return 'low';
  }
}

// ===== Service Instances =====

export const locationHistoryService = new LocationHistoryService();
export const userService = new UserService();
export const planningService = new PlanningService();
export const cacheService = new CacheService();
export const analyticsService = new AnalyticsService();
export const errorLoggingService = new ErrorLoggingService();

// ===== Backward Compatibility Layer =====

// For migration from existing SQLite-based history logging
export async function migrateFromSQLiteHistory() {
  try {
    console.log('Starting SQLite to DynamoDB history migration...');
    
    // This would integrate with the existing history.mjs file
    const existingHistory = await import('./history.mjs').catch(() => null);
    
    if (existingHistory && existingHistory.getRecentHistory) {
      console.log('Found existing SQLite history, migrating...');
      
      // Get all history from SQLite
      const sqliteHistory = await existingHistory.getRecentHistory(10000); // Large number to get all
      
      if (sqliteHistory && sqliteHistory.length > 0) {
        console.log(`Migrating ${sqliteHistory.length} history records...`);
        
        for (const record of sqliteHistory) {
          try {
            await locationHistoryService.addLocationHistory(
              record.user_id || 'unknown',
              JSON.parse(record.location || '{}'),
              record.activity || 'unknown',
              JSON.parse(record.metadata || '{}')
            );
          } catch (error) {
            console.error(`Failed to migrate record ${record.id}:`, error);
          }
        }
        
        console.log('SQLite history migration completed');
      }
    }
  } catch (error) {
    console.error('SQLite migration failed:', error);
  }
}

// ===== Database Service Health Check =====

export async function performDatabaseHealthCheck() {
  try {
    const status = await databaseService.getServiceStatus();
    return {
      healthy: status.health.overall === 'healthy',
      details: status
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

// ===== Initialize Database (to be called in app startup) =====

export async function initializeDatabase() {
  try {
    await databaseService.initialize(true);
    console.log('✅ Production database initialized successfully');
    
    // Run migration from SQLite if needed
    if (process.env.MIGRATE_FROM_SQLITE === 'true') {
      await migrateFromSQLiteHistory();
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// ===== Export database service for advanced usage =====

export { databaseService } from './lib/databaseService.js';
