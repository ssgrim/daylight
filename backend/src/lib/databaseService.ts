// Production Database Service - Main Integration
// Issue #111 - Complete database layer with monitoring, retention, and migration

import { initializeDatabases, shutdownDatabases, dbOperations } from './databaseConnections.js';
import { migrationManager, runProductionMigration } from './databaseMigration.js';
import { startDatabaseMonitoring, stopDatabaseMonitoring, getSystemMetrics } from './databaseMonitoring.js';
import { startDataRetention, stopDataRetention, getRetentionReport } from './databaseRetention.js';
import { DB_CONFIG, FINAL_CONFIG } from './databaseConfig.js';

// ===== Database Service Interfaces =====

interface DatabaseServiceStatus {
  initialized: boolean;
  connections: {
    [key: string]: boolean;
  };
  monitoring: {
    enabled: boolean;
    started: boolean;
  };
  retention: {
    enabled: boolean;
    started: boolean;
  };
  migration: {
    completed: boolean;
    currentVersion: string;
  };
  health: {
    overall: 'healthy' | 'warning' | 'critical';
    services: { [key: string]: boolean };
    lastCheck: string;
  };
}

interface DatabaseOperationOptions {
  userId?: string;
  timeout?: number;
  retries?: number;
  skipMonitoring?: boolean;
}

// ===== Main Database Service =====

export class ProductionDatabaseService {
  private isInitialized: boolean = false;
  private startupTime: Date | null = null;
  private shutdownHandlers: (() => Promise<void>)[] = [];

  constructor() {
    this.setupShutdownHandlers();
  }

  // ===== Initialization & Lifecycle =====

  async initialize(runMigrations: boolean = true): Promise<void> {
    if (this.isInitialized) {
      console.log('Database service already initialized');
      return;
    }

    console.log('Initializing Production Database Service...');
    this.startupTime = new Date();

    try {
      // Step 1: Initialize database connections
      console.log('1. Initializing database connections...');
      await initializeDatabases();

      // Step 2: Run migrations if requested
      if (runMigrations) {
        console.log('2. Running database migrations...');
        await runProductionMigration();
      } else {
        console.log('2. Skipping database migrations');
      }

      // Step 3: Start monitoring
      console.log('3. Starting database monitoring...');
      startDatabaseMonitoring();

      // Step 4: Start data retention service
      console.log('4. Starting data retention service...');
      await startDataRetention();

      // Step 5: Perform initial health check
      console.log('5. Performing initial health check...');
      const healthCheck = await this.getHealthStatus();
      if (healthCheck.overall === 'critical') {
        throw new Error('Database health check failed during initialization');
      }

      this.isInitialized = true;
      const initTime = Date.now() - this.startupTime.getTime();
      
      console.log(`✅ Production Database Service initialized successfully in ${initTime}ms`);
      console.log('📊 Database Configuration:', {
        environment: DB_CONFIG.environment,
        primary: DB_CONFIG.primary,
        multiDatabase: DB_CONFIG.enableMultiDatabase,
        monitoring: FINAL_CONFIG.monitoring?.enabled,
        retention: FINAL_CONFIG.environment === 'production'
      });

    } catch (error) {
      console.error('❌ Failed to initialize Production Database Service:', error);
      await this.cleanup();
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      console.log('Database service not initialized, nothing to shutdown');
      return;
    }

    console.log('Shutting down Production Database Service...');

    try {
      // Run shutdown handlers
      for (const handler of this.shutdownHandlers) {
        try {
          await handler();
        } catch (error) {
          console.error('Error in shutdown handler:', error);
        }
      }

      // Stop monitoring
      stopDatabaseMonitoring();

      // Stop retention service
      stopDataRetention();

      // Close database connections
      await shutdownDatabases();

      this.isInitialized = false;
      console.log('✅ Production Database Service shut down successfully');

    } catch (error) {
      console.error('❌ Error during database service shutdown:', error);
      throw error;
    }
  }

  // ===== Service Status & Health =====

  async getServiceStatus(): Promise<DatabaseServiceStatus> {
    const healthCheck = await dbOperations.healthCheck();
    const migrationStatus = await migrationManager.getMigrationStatus();
    const retentionStatus = await getRetentionReport();

    return {
      initialized: this.isInitialized,
      connections: healthCheck,
      monitoring: {
        enabled: FINAL_CONFIG.monitoring?.enabled || false,
        started: this.isInitialized
      },
      retention: {
        enabled: FINAL_CONFIG.environment === 'production',
        started: this.isInitialized
      },
      migration: {
        completed: migrationStatus.pending.length === 0,
        currentVersion: migrationStatus.current
      },
      health: await this.getHealthStatus()
    };
  }

  async getHealthStatus(): Promise<DatabaseServiceStatus['health']> {
    try {
      const healthCheck = await dbOperations.healthCheck();
      const allHealthy = Object.values(healthCheck).every(status => status);
      
      let overall: 'healthy' | 'warning' | 'critical';
      if (allHealthy) {
        overall = 'healthy';
      } else {
        const criticalServices = Object.entries(healthCheck)
          .filter(([_, status]) => !status)
          .map(([service, _]) => service);
        
        overall = criticalServices.includes('dynamodb') ? 'critical' : 'warning';
      }

      return {
        overall,
        services: healthCheck,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        overall: 'critical',
        services: {},
        lastCheck: new Date().toISOString()
      };
    }
  }

  async getDetailedMetrics(): Promise<any> {
    try {
      const [systemMetrics, retentionReport, serviceStatus] = await Promise.all([
        getSystemMetrics(),
        getRetentionReport(),
        this.getServiceStatus()
      ]);

      return {
        service: serviceStatus,
        performance: systemMetrics.performance,
        health: systemMetrics.health,
        slowQueries: systemMetrics.slowQueries,
        errors: systemMetrics.errors,
        retention: retentionReport,
        uptime: this.getUptime()
      };
    } catch (error) {
      console.error('Failed to get detailed metrics:', error);
      throw error;
    }
  }

  // ===== Data Operations with Monitoring =====

  async query(tableName: string, params: any, options?: DatabaseOperationOptions): Promise<any> {
    this.ensureInitialized();
    
    const operation = async () => {
      return await dbOperations.dynamoQuery(tableName, params);
    };

    if (options?.skipMonitoring) {
      return await operation();
    } else {
      const { dbInstrumentation } = await import('./databaseMonitoring.js');
      return await dbInstrumentation.instrumentQuery(
        tableName,
        'query',
        operation,
        options?.userId
      );
    }
  }

  async put(tableName: string, item: any, options?: DatabaseOperationOptions): Promise<any> {
    this.ensureInitialized();
    
    const operation = async () => {
      return await dbOperations.dynamoPut(tableName, item);
    };

    if (options?.skipMonitoring) {
      return await operation();
    } else {
      const { dbInstrumentation } = await import('./databaseMonitoring.js');
      return await dbInstrumentation.instrumentQuery(
        tableName,
        'put',
        operation,
        options?.userId
      );
    }
  }

  async update(tableName: string, key: any, updates: any, options?: DatabaseOperationOptions): Promise<any> {
    this.ensureInitialized();
    
    const operation = async () => {
      return await dbOperations.dynamoUpdate(tableName, key, updates);
    };

    if (options?.skipMonitoring) {
      return await operation();
    } else {
      const { dbInstrumentation } = await import('./databaseMonitoring.js');
      return await dbInstrumentation.instrumentQuery(
        tableName,
        'update',
        operation,
        options?.userId
      );
    }
  }

  async delete(tableName: string, key: any, options?: DatabaseOperationOptions): Promise<any> {
    this.ensureInitialized();
    
    const operation = async () => {
      return await dbOperations.dynamoDelete(tableName, key);
    };

    if (options?.skipMonitoring) {
      return await operation();
    } else {
      const { dbInstrumentation } = await import('./databaseMonitoring.js');
      return await dbInstrumentation.instrumentQuery(
        tableName,
        'delete',
        operation,
        options?.userId
      );
    }
  }

  // ===== Batch Operations =====

  async batchWrite(operations: Array<{ tableName: string; operation: 'put' | 'delete'; item?: any; key?: any }>): Promise<void> {
    this.ensureInitialized();

    // Process in batches of 25 (DynamoDB limit)
    const batchSize = 25;
    const batches = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const promises = batch.map(async (op) => {
        if (op.operation === 'put') {
          return this.put(op.tableName, op.item!, { skipMonitoring: true });
        } else {
          return this.delete(op.tableName, op.key!, { skipMonitoring: true });
        }
      });

      await Promise.all(promises);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // ===== Migration Management =====

  async runMigrations(): Promise<void> {
    this.ensureInitialized();
    await runProductionMigration();
  }

  async getMigrationStatus(): Promise<any> {
    this.ensureInitialized();
    return await migrationManager.getMigrationStatus();
  }

  // ===== Manual Operations =====

  async runManualRetention(tableName?: string): Promise<any> {
    this.ensureInitialized();
    const { runManualRetention } = await import('./databaseRetention.js');
    return await runManualRetention(tableName);
  }

  async getRetentionStatus(): Promise<any> {
    this.ensureInitialized();
    return await getRetentionReport();
  }

  // ===== Utility Methods =====

  getUptime(): number {
    if (!this.startupTime) return 0;
    return Date.now() - this.startupTime.getTime();
  }

  getConfiguration(): typeof FINAL_CONFIG {
    return FINAL_CONFIG;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized. Call initialize() first.');
    }
  }

  private async cleanup(): Promise<void> {
    try {
      stopDatabaseMonitoring();
      stopDataRetention();
      await shutdownDatabases();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  private setupShutdownHandlers(): void {
    // Graceful shutdown on process signals
    const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    shutdownSignals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`Received ${signal}, initiating graceful shutdown...`);
        await this.shutdown();
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  // ===== Add Custom Shutdown Handler =====

  addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }
}

// ===== Table Name Helper Export =====

export { getTableName } from './databaseConnections.js';

// ===== Singleton Instance =====

export const databaseService = new ProductionDatabaseService();

// ===== Convenience Functions =====

export async function initializeProductionDatabase(runMigrations: boolean = true): Promise<void> {
  await databaseService.initialize(runMigrations);
}

export async function shutdownProductionDatabase(): Promise<void> {
  await databaseService.shutdown();
}

export async function getDatabaseStatus(): Promise<DatabaseServiceStatus> {
  return await databaseService.getServiceStatus();
}

export async function getDatabaseMetrics(): Promise<any> {
  return await databaseService.getDetailedMetrics();
}

// ===== Query Helpers =====

export async function queryTable(tableName: string, params: any, userId?: string): Promise<any> {
  return await databaseService.query(tableName, params, { userId });
}

export async function putItem(tableName: string, item: any, userId?: string): Promise<any> {
  return await databaseService.put(tableName, item, { userId });
}

export async function updateItem(tableName: string, key: any, updates: any, userId?: string): Promise<any> {
  return await databaseService.update(tableName, key, updates, { userId });
}

export async function deleteItem(tableName: string, key: any, userId?: string): Promise<any> {
  return await databaseService.delete(tableName, key, { userId });
}

export async function batchWrite(operations: Array<{ tableName: string; operation: 'put' | 'delete'; item?: any; key?: any }>): Promise<void> {
  return await databaseService.batchWrite(operations);
}

// ===== Default Export =====

export default databaseService;
