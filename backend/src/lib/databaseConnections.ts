// Production Database Connection Manager
// Issue #111 - Multi-database connection management and pooling

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { 
  DB_CONFIG, 
  CONNECTION_CONFIG, 
  DATABASE_SCHEMAS, 
  PERFORMANCE_CONFIG 
} from './databaseConfig.js';

// ===== Connection Pool Interfaces =====

interface ConnectionPool {
  initialize(): Promise<void>;
  getConnection(): Promise<any>;
  releaseConnection(connection: any): Promise<void>;
  close(): Promise<void>;
  isHealthy(): Promise<boolean>;
  getStats(): Promise<ConnectionStats>;
}

interface ConnectionStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  pendingRequests: number;
  errorCount: number;
  avgResponseTime: number;
}

// ===== DynamoDB Connection Manager =====

class DynamoDBManager implements ConnectionPool {
  private client: DynamoDBClient | null = null;
  private docClient: DynamoDBDocumentClient | null = null;
  private stats: ConnectionStats;

  constructor() {
    this.stats = {
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
      pendingRequests: 0,
      errorCount: 0,
      avgResponseTime: 0
    };
  }

  async initialize(): Promise<void> {
    try {
      this.client = new DynamoDBClient({
        region: CONNECTION_CONFIG.dynamodb.region,
        endpoint: CONNECTION_CONFIG.dynamodb.endpoint,
        credentials: CONNECTION_CONFIG.dynamodb.accessKeyId ? {
          accessKeyId: CONNECTION_CONFIG.dynamodb.accessKeyId,
          secretAccessKey: CONNECTION_CONFIG.dynamodb.secretAccessKey!
        } : undefined,
        maxAttempts: CONNECTION_CONFIG.dynamodb.maxRetries,
        retryMode: 'adaptive'
      });

      this.docClient = DynamoDBDocumentClient.from(this.client, {
        marshallOptions: {
          convertEmptyValues: true,
          removeUndefinedValues: true,
          convertClassInstanceToMap: true
        },
        unmarshallOptions: {
          wrapNumbers: false
        }
      });

      console.log('DynamoDB connection initialized');
    } catch (error) {
      console.error('Failed to initialize DynamoDB:', error);
      throw error;
    }
  }

  async getConnection(): Promise<DynamoDBDocumentClient> {
    if (!this.docClient) {
      await this.initialize();
    }
    
    this.stats.activeConnections++;
    return this.docClient!;
  }

  async releaseConnection(connection: any): Promise<void> {
    this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.docClient = null;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.docClient) return false;
      // Simple health check - list tables with limit
      const response = await this.client!.send(new (await import('@aws-sdk/client-dynamodb')).ListTablesCommand({ Limit: 1 }));
      return response.$metadata.httpStatusCode === 200;
    } catch (error) {
      console.error('DynamoDB health check failed:', error);
      return false;
    }
  }

  async getStats(): Promise<ConnectionStats> {
    return { ...this.stats };
  }
}

// ===== SQLite Manager (for migration/development) =====

class SQLiteManager implements ConnectionPool {
  private db: any = null;
  private stats: ConnectionStats;

  constructor() {
    this.stats = {
      activeConnections: 0,
      idleConnections: 1,
      totalConnections: 1,
      pendingRequests: 0,
      errorCount: 0,
      avgResponseTime: 0
    };
  }

  async initialize(): Promise<void> {
    try {
      const sqlite3 = await import('sqlite3');
      const { open } = await import('sqlite');
      
      this.db = await open({
        filename: '/workspaces/daylight/backend/external_history.sqlite',
        driver: sqlite3.Database
      });
      
      console.log('SQLite connection initialized');
    } catch (error) {
      console.error('Failed to initialize SQLite:', error);
      throw error;
    }
  }

  async getConnection(): Promise<any> {
    if (!this.db) {
      await this.initialize();
    }
    
    this.stats.activeConnections++;
    return this.db;
  }

  async releaseConnection(connection: any): Promise<void> {
    this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.get('SELECT 1');
      return true;
    } catch (error) {
      console.error('SQLite health check failed:', error);
      return false;
    }
  }

  async getStats(): Promise<ConnectionStats> {
    return { ...this.stats };
  }
}

// ===== Connection Factory =====

class DatabaseConnectionFactory {
  private dynamoManager: DynamoDBManager;
  private sqliteManager: SQLiteManager;
  private initialized: boolean = false;

  constructor() {
    this.dynamoManager = new DynamoDBManager();
    this.sqliteManager = new SQLiteManager();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize DynamoDB for production data
      await this.dynamoManager.initialize();
      
      // Initialize SQLite for development/migration
      if (DB_CONFIG.environment === 'development' || DB_CONFIG.enableMultiDatabase) {
        await this.sqliteManager.initialize();
      }

      this.initialized = true;
      console.log('Database connections initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database connections:', error);
      throw error;
    }
  }

  getDynamoConnection(): Promise<DynamoDBDocumentClient> {
    return this.dynamoManager.getConnection();
  }

  getSQLiteConnection(): Promise<any> {
    return this.sqliteManager.getConnection();
  }

  async getConnection(database: 'dynamodb' | 'sqlite' = 'dynamodb'): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    switch (database) {
      case 'dynamodb':
        return this.getDynamoConnection();
      case 'sqlite':
        return this.getSQLiteConnection();
      default:
        throw new Error(`Unsupported database type: ${database}`);
    }
  }

  async releaseConnection(connection: any, database: 'dynamodb' | 'sqlite' = 'dynamodb'): Promise<void> {
    switch (database) {
      case 'dynamodb':
        return this.dynamoManager.releaseConnection(connection);
      case 'sqlite':
        return this.sqliteManager.releaseConnection(connection);
    }
  }

  async closeAll(): Promise<void> {
    await Promise.all([
      this.dynamoManager.close(),
      this.sqliteManager.close()
    ]);
    this.initialized = false;
  }

  async healthCheck(): Promise<{ [key: string]: boolean }> {
    const health: { [key: string]: boolean } = {};
    
    health.dynamodb = await this.dynamoManager.isHealthy();
    
    if (DB_CONFIG.environment === 'development' || DB_CONFIG.enableMultiDatabase) {
      health.sqlite = await this.sqliteManager.isHealthy();
    }

    return health;
  }

  async getConnectionStats(): Promise<{ [key: string]: ConnectionStats }> {
    const stats: { [key: string]: ConnectionStats } = {};
    
    stats.dynamodb = await this.dynamoManager.getStats();
    
    if (DB_CONFIG.environment === 'development' || DB_CONFIG.enableMultiDatabase) {
      stats.sqlite = await this.sqliteManager.getStats();
    }

    return stats;
  }
}

// ===== Database Operations Helper =====

export class DatabaseOperations {
  private connectionFactory: DatabaseConnectionFactory;

  constructor() {
    this.connectionFactory = new DatabaseConnectionFactory();
  }

  async initialize(): Promise<void> {
    await this.connectionFactory.initialize();
  }

  // Connection Management
  async getConnection(database: 'dynamodb' | 'sqlite' = 'dynamodb'): Promise<any> {
    return this.connectionFactory.getConnection(database);
  }

  async getDynamoConnection(): Promise<DynamoDBDocumentClient> {
    return this.connectionFactory.getDynamoConnection();
  }

  async getSQLiteConnection(): Promise<any> {
    return this.connectionFactory.getSQLiteConnection();
  }

  // DynamoDB Operations
  async dynamoQuery(tableName: string, params: any): Promise<any> {
    const connection = await this.connectionFactory.getDynamoConnection();
    
    try {
      const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
      const command = new QueryCommand({
        TableName: tableName,
        ...params
      });
      
      const startTime = Date.now();
      const result = await connection.send(command);
      const endTime = Date.now();
      
      this.recordMetrics('query', endTime - startTime);
      return result;
    } catch (error) {
      this.recordError('dynamodb', 'query', error);
      throw error;
    } finally {
      await this.connectionFactory.releaseConnection(connection, 'dynamodb');
    }
  }

  async dynamoPut(tableName: string, item: any): Promise<any> {
    const connection = await this.connectionFactory.getDynamoConnection();
    
    try {
      const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
      const command = new PutCommand({
        TableName: tableName,
        Item: item
      });
      
      const startTime = Date.now();
      const result = await connection.send(command);
      const endTime = Date.now();
      
      this.recordMetrics('put', endTime - startTime);
      return result;
    } catch (error) {
      this.recordError('dynamodb', 'put', error);
      throw error;
    } finally {
      await this.connectionFactory.releaseConnection(connection, 'dynamodb');
    }
  }

  async dynamoUpdate(tableName: string, key: any, updates: any): Promise<any> {
    const connection = await this.connectionFactory.getDynamoConnection();
    
    try {
      const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
      const command = new UpdateCommand({
        TableName: tableName,
        Key: key,
        ...updates
      });
      
      const startTime = Date.now();
      const result = await connection.send(command);
      const endTime = Date.now();
      
      this.recordMetrics('update', endTime - startTime);
      return result;
    } catch (error) {
      this.recordError('dynamodb', 'update', error);
      throw error;
    } finally {
      await this.connectionFactory.releaseConnection(connection, 'dynamodb');
    }
  }

  async dynamoDelete(tableName: string, key: any): Promise<any> {
    const connection = await this.connectionFactory.getDynamoConnection();
    
    try {
      const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
      const command = new DeleteCommand({
        TableName: tableName,
        Key: key
      });
      
      const startTime = Date.now();
      const result = await connection.send(command);
      const endTime = Date.now();
      
      this.recordMetrics('delete', endTime - startTime);
      return result;
    } catch (error) {
      this.recordError('dynamodb', 'delete', error);
      throw error;
    } finally {
      await this.connectionFactory.releaseConnection(connection, 'dynamodb');
    }
  }

  // SQLite Operations (for migration/development)
  async sqliteQuery(sql: string, params: any[] = []): Promise<any> {
    const connection = await this.connectionFactory.getSQLiteConnection();
    
    try {
      const startTime = Date.now();
      const result = await connection.all(sql, params);
      const endTime = Date.now();
      
      this.recordMetrics('sqlite_query', endTime - startTime);
      return result;
    } catch (error) {
      this.recordError('sqlite', 'query', error);
      throw error;
    } finally {
      await this.connectionFactory.releaseConnection(connection, 'sqlite');
    }
  }

  async sqliteRun(sql: string, params: any[] = []): Promise<any> {
    const connection = await this.connectionFactory.getSQLiteConnection();
    
    try {
      const startTime = Date.now();
      const result = await connection.run(sql, params);
      const endTime = Date.now();
      
      this.recordMetrics('sqlite_run', endTime - startTime);
      return result;
    } catch (error) {
      this.recordError('sqlite', 'run', error);
      throw error;
    } finally {
      await this.connectionFactory.releaseConnection(connection, 'sqlite');
    }
  }

  // Health & Monitoring
  async healthCheck(): Promise<{ [key: string]: boolean }> {
    return this.connectionFactory.healthCheck();
  }

  async getConnectionStats(): Promise<{ [key: string]: ConnectionStats }> {
    return this.connectionFactory.getConnectionStats();
  }

  async close(): Promise<void> {
    await this.connectionFactory.closeAll();
  }

  // Metrics & Error Tracking
  private recordMetrics(operation: string, duration: number): void {
    // Record performance metrics
    console.log(`Database ${operation} completed in ${duration}ms`);
    
    // In production, send to monitoring system
    if (DB_CONFIG.environment === 'production') {
      // CloudWatch/DataDog integration would go here
    }
  }

  private recordError(database: string, operation: string, error: any): void {
    console.error(`Database error in ${database}.${operation}:`, error);
    
    // In production, send to error tracking system
    if (DB_CONFIG.environment === 'production') {
      // Sentry/Rollbar integration would go here
    }
  }
}

// ===== Singleton Instance =====

export const dbOperations = new DatabaseOperations();

// ===== Table Name Helper =====

export function getTableName(schema: keyof typeof DATABASE_SCHEMAS): string {
  const schemaConfig = DATABASE_SCHEMAS[schema];
  
  switch (DB_CONFIG.primary) {
    case 'dynamodb':
      return schemaConfig.dynamodb;
    case 'postgresql':
      return schemaConfig.postgresql;
    case 'mongodb':
      return schemaConfig.mongodb;
    default:
      return schemaConfig.dynamodb;
  }
}

// ===== Initialization Helper =====

export async function initializeDatabases(): Promise<void> {
  try {
    await dbOperations.initialize();
    console.log('All database connections initialized successfully');
  } catch (error) {
    console.error('Failed to initialize databases:', error);
    throw error;
  }
}

// ===== Graceful Shutdown =====

export async function shutdownDatabases(): Promise<void> {
  try {
    await dbOperations.close();
    console.log('All database connections closed gracefully');
  } catch (error) {
    console.error('Error during database shutdown:', error);
    throw error;
  }
}

// Export the connection factory for advanced use cases
export { DatabaseConnectionFactory };
