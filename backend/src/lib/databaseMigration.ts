// Production Database Migration System
// Issue #111 - Data migration and schema management

import { dbOperations, getTableName } from './databaseConnections.js';
import { DATABASE_SCHEMAS, DATA_RETENTION, DB_CONFIG } from './databaseConfig.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== Migration Interfaces =====

interface Migration {
  version: string;
  name: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
  dependencies?: string[];
  estimatedDuration?: number;
}

interface MigrationRecord {
  version: string;
  name: string;
  appliedAt: string;
  executionTime: number;
  checksum: string;
}

interface MigrationStatus {
  applied: MigrationRecord[];
  pending: Migration[];
  current: string;
  canRollback: boolean;
}

// ===== SQLite to DynamoDB Migration =====

class SQLiteToDynamoMigrator {
  private sourceDb: any;
  private migrationLog: MigrationRecord[] = [];

  async initialize(): Promise<void> {
    try {
      this.sourceDb = await dbOperations.sqliteQuery('SELECT name FROM sqlite_master WHERE type="table"', []);
      console.log('SQLite migration source initialized');
    } catch (error) {
      console.error('Failed to initialize SQLite migrator:', error);
      throw error;
    }
  }

  async migrateHistoryData(): Promise<void> {
    console.log('Starting SQLite history data migration to DynamoDB...');
    
    try {
      // Get all history records from SQLite
      const historyRecords = await dbOperations.sqliteQuery(`
        SELECT 
          id,
          user_id,
          location,
          activity,
          timestamp,
          metadata,
          created_at,
          updated_at
        FROM location_history 
        ORDER BY timestamp DESC
      `);

      console.log(`Found ${historyRecords.length} history records to migrate`);

      // Batch process records to avoid memory issues
      const batchSize = 25; // DynamoDB batch write limit
      const batches = [];
      
      for (let i = 0; i < historyRecords.length; i += batchSize) {
        batches.push(historyRecords.slice(i, i + batchSize));
      }

      let migratedCount = 0;
      const tableName = getTableName('location_history');

      for (const batch of batches) {
        const batchPromises = batch.map(async (record) => {
          try {
            // Transform SQLite record to DynamoDB format
            const dynamoRecord = {
              id: record.id,
              userId: record.user_id,
              location: JSON.parse(record.location || '{}'),
              activity: record.activity,
              timestamp: new Date(record.timestamp).toISOString(),
              metadata: record.metadata ? JSON.parse(record.metadata) : {},
              createdAt: new Date(record.created_at).toISOString(),
              updatedAt: new Date(record.updated_at).toISOString(),
              ttl: this.calculateTTL(record.timestamp)
            };

            await dbOperations.dynamoPut(tableName, dynamoRecord);
            migratedCount++;
            
            if (migratedCount % 100 === 0) {
              console.log(`Migrated ${migratedCount} / ${historyRecords.length} records`);
            }
          } catch (error) {
            console.error(`Failed to migrate record ${record.id}:`, error);
            throw error;
          }
        });

        await Promise.all(batchPromises);
        
        // Add small delay between batches to avoid throttling
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`Successfully migrated ${migratedCount} history records`);
      
      // Record migration
      this.recordMigration('001', 'sqlite_history_migration', migratedCount);
      
    } catch (error) {
      console.error('History data migration failed:', error);
      throw error;
    }
  }

  async migrateUserData(): Promise<void> {
    console.log('Starting user data migration...');
    
    try {
      // Check if users table exists in SQLite
      const userTables = await dbOperations.sqliteQuery(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('users', 'user_profiles', 'user_sessions')
      `);

      if (userTables.length === 0) {
        console.log('No user tables found in SQLite, skipping user migration');
        return;
      }

      // Migrate users if table exists
      if (userTables.some(t => t.name === 'users')) {
        await this.migrateUsersTable();
      }

      // Migrate user profiles if table exists
      if (userTables.some(t => t.name === 'user_profiles')) {
        await this.migrateUserProfilesTable();
      }

      // Migrate sessions if table exists
      if (userTables.some(t => t.name === 'user_sessions')) {
        await this.migrateUserSessionsTable();
      }

      console.log('User data migration completed');
      
    } catch (error) {
      console.error('User data migration failed:', error);
      throw error;
    }
  }

  private async migrateUsersTable(): Promise<void> {
    const users = await dbOperations.sqliteQuery('SELECT * FROM users');
    const tableName = getTableName('users');
    
    for (const user of users) {
      const dynamoUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        passwordHash: user.password_hash,
        isActive: Boolean(user.is_active),
        emailVerified: Boolean(user.email_verified),
        createdAt: new Date(user.created_at).toISOString(),
        updatedAt: new Date(user.updated_at).toISOString(),
        lastLoginAt: user.last_login_at ? new Date(user.last_login_at).toISOString() : null
      };

      await dbOperations.dynamoPut(tableName, dynamoUser);
    }
    
    console.log(`Migrated ${users.length} users`);
  }

  private async migrateUserProfilesTable(): Promise<void> {
    const profiles = await dbOperations.sqliteQuery('SELECT * FROM user_profiles');
    const tableName = getTableName('user_profiles');
    
    for (const profile of profiles) {
      const dynamoProfile = {
        userId: profile.user_id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        avatar: profile.avatar,
        timezone: profile.timezone,
        preferences: profile.preferences ? JSON.parse(profile.preferences) : {},
        settings: profile.settings ? JSON.parse(profile.settings) : {},
        createdAt: new Date(profile.created_at).toISOString(),
        updatedAt: new Date(profile.updated_at).toISOString()
      };

      await dbOperations.dynamoPut(tableName, dynamoProfile);
    }
    
    console.log(`Migrated ${profiles.length} user profiles`);
  }

  private async migrateUserSessionsTable(): Promise<void> {
    const sessions = await dbOperations.sqliteQuery('SELECT * FROM user_sessions WHERE expires_at > datetime("now")');
    const tableName = getTableName('user_sessions');
    
    for (const session of sessions) {
      const dynamoSession = {
        sessionId: session.session_id,
        userId: session.user_id,
        data: session.data ? JSON.parse(session.data) : {},
        expiresAt: new Date(session.expires_at).toISOString(),
        createdAt: new Date(session.created_at).toISOString(),
        ttl: Math.floor(new Date(session.expires_at).getTime() / 1000)
      };

      await dbOperations.dynamoPut(tableName, dynamoSession);
    }
    
    console.log(`Migrated ${sessions.length} active user sessions`);
  }

  private calculateTTL(timestamp: string): number {
    const recordDate = new Date(timestamp);
    const retentionDays = DATA_RETENTION.hot.location_history;
    const ttlDate = new Date(recordDate.getTime() + (retentionDays * 24 * 60 * 60 * 1000));
    return Math.floor(ttlDate.getTime() / 1000);
  }

  private recordMigration(version: string, name: string, recordCount: number): void {
    const migration: MigrationRecord = {
      version,
      name,
      appliedAt: new Date().toISOString(),
      executionTime: Date.now(),
      checksum: this.generateChecksum(name + recordCount)
    };
    
    this.migrationLog.push(migration);
  }

  private generateChecksum(data: string): string {
    // Simple checksum for migration verification
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
}

// ===== DynamoDB Table Creation =====

class DynamoDBTableCreator {
  async createAllTables(): Promise<void> {
    console.log('Creating DynamoDB tables for production...');
    
    const tableDefinitions = this.getTableDefinitions();
    
    for (const [tableName, definition] of Object.entries(tableDefinitions)) {
      try {
        await this.createTable(tableName, definition);
      } catch (error) {
        if (error.name === 'ResourceInUseException') {
          console.log(`Table ${tableName} already exists, skipping...`);
        } else {
          console.error(`Failed to create table ${tableName}:`, error);
          throw error;
        }
      }
    }
    
    console.log('All tables created successfully');
  }

  private async createTable(tableName: string, definition: any): Promise<void> {
    const connection = await dbOperations.getConnection('dynamodb');
    const { CreateTableCommand } = await import('@aws-sdk/client-dynamodb');
    
    try {
      const command = new CreateTableCommand({
        TableName: tableName,
        ...definition
      });
      
      await connection.send(command);
      console.log(`Created table: ${tableName}`);
      
      // Wait for table to be active
      await this.waitForTableActive(tableName);
      
    } catch (error) {
      console.error(`Failed to create table ${tableName}:`, error);
      throw error;
    }
  }

  private async waitForTableActive(tableName: string): Promise<void> {
    const connection = await dbOperations.getDynamoConnection();
    const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
    
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        const command = new DescribeTableCommand({ TableName: tableName });
        const response = await connection.send(command);
        
        if (response.Table?.TableStatus === 'ACTIVE') {
          console.log(`Table ${tableName} is now active`);
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        
      } catch (error) {
        console.error(`Error checking table status for ${tableName}:`, error);
        attempts++;
      }
    }
    
    throw new Error(`Table ${tableName} did not become active within timeout`);
  }

  private getTableDefinitions(): { [key: string]: any } {
    return {
      [getTableName('users')]: {
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
          { AttributeName: 'email', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'EmailIndex',
            KeySchema: [
              { AttributeName: 'email', KeyType: 'HASH' }
            ],
            Projection: { ProjectionType: 'ALL' },
            BillingMode: 'PAY_PER_REQUEST'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        SSESpecification: {
          SSEEnabled: DB_CONFIG.security?.encryption?.atRest || false
        }
      },

      [getTableName('user_profiles')]: {
        AttributeDefinitions: [
          { AttributeName: 'userId', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        SSESpecification: {
          SSEEnabled: DB_CONFIG.security?.encryption?.atRest || false
        }
      },

      [getTableName('location_history')]: {
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
          { AttributeName: 'userId', AttributeType: 'S' },
          { AttributeName: 'timestamp', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'UserTimestampIndex',
            KeySchema: [
              { AttributeName: 'userId', KeyType: 'HASH' },
              { AttributeName: 'timestamp', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' },
            BillingMode: 'PAY_PER_REQUEST'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        SSESpecification: {
          SSEEnabled: DB_CONFIG.security?.encryption?.atRest || false
        },
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true
        }
      },

      [getTableName('plans')]: {
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
          { AttributeName: 'userId', AttributeType: 'S' },
          { AttributeName: 'createdAt', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'UserPlansIndex',
            KeySchema: [
              { AttributeName: 'userId', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' },
            BillingMode: 'PAY_PER_REQUEST'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        SSESpecification: {
          SSEEnabled: DB_CONFIG.security?.encryption?.atRest || false
        }
      },

      [getTableName('weather_cache')]: {
        AttributeDefinitions: [
          { AttributeName: 'locationKey', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'locationKey', KeyType: 'HASH' }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true
        }
      },

      [getTableName('usage_analytics')]: {
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
          { AttributeName: 'date', AttributeType: 'S' },
          { AttributeName: 'userId', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'DateIndex',
            KeySchema: [
              { AttributeName: 'date', KeyType: 'HASH' }
            ],
            Projection: { ProjectionType: 'ALL' },
            BillingMode: 'PAY_PER_REQUEST'
          },
          {
            IndexName: 'UserAnalyticsIndex',
            KeySchema: [
              { AttributeName: 'userId', KeyType: 'HASH' },
              { AttributeName: 'date', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' },
            BillingMode: 'PAY_PER_REQUEST'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      }
    };
  }
}

// ===== Migration Manager =====

export class ProductionMigrationManager {
  private sqliteMigrator: SQLiteToDynamoMigrator;
  private tableCreator: DynamoDBTableCreator;
  private migrations: Migration[] = [];

  constructor() {
    this.sqliteMigrator = new SQLiteToDynamoMigrator();
    this.tableCreator = new DynamoDBTableCreator();
    this.loadMigrations();
  }

  async runFullMigration(): Promise<void> {
    console.log('Starting full production database migration...');
    
    try {
      // Step 1: Initialize connections
      await dbOperations.initialize();
      
      // Step 2: Create DynamoDB tables
      await this.tableCreator.createAllTables();
      
      // Step 3: Initialize SQLite migrator
      await this.sqliteMigrator.initialize();
      
      // Step 4: Migrate existing data
      await this.sqliteMigrator.migrateHistoryData();
      await this.sqliteMigrator.migrateUserData();
      
      // Step 5: Run custom migrations
      await this.runPendingMigrations();
      
      // Step 6: Verify migration integrity
      await this.verifyMigration();
      
      console.log('Full production database migration completed successfully');
      
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  async runPendingMigrations(): Promise<void> {
    const status = await this.getMigrationStatus();
    
    if (status.pending.length === 0) {
      console.log('No pending migrations');
      return;
    }
    
    console.log(`Running ${status.pending.length} pending migrations...`);
    
    for (const migration of status.pending) {
      await this.runMigration(migration);
    }
  }

  private async runMigration(migration: Migration): Promise<void> {
    console.log(`Running migration: ${migration.name}`);
    
    const startTime = Date.now();
    
    try {
      await migration.up();
      const executionTime = Date.now() - startTime;
      
      // Record successful migration
      await this.recordMigration({
        version: migration.version,
        name: migration.name,
        appliedAt: new Date().toISOString(),
        executionTime,
        checksum: this.generateMigrationChecksum(migration)
      });
      
      console.log(`Migration ${migration.name} completed in ${executionTime}ms`);
      
    } catch (error) {
      console.error(`Migration ${migration.name} failed:`, error);
      throw error;
    }
  }

  async getMigrationStatus(): Promise<MigrationStatus> {
    // Get applied migrations from database
    const applied = await this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map(m => m.version));
    
    // Find pending migrations
    const pending = this.migrations.filter(m => !appliedVersions.has(m.version));
    
    return {
      applied,
      pending,
      current: applied.length > 0 ? applied[applied.length - 1].version : '0',
      canRollback: applied.length > 0
    };
  }

  private async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      const result = await dbOperations.dynamoQuery('daylight-schema-migrations', {});
      return result.Items || [];
    } catch (error) {
      // Migration table doesn't exist yet
      return [];
    }
  }

  private async recordMigration(record: MigrationRecord): Promise<void> {
    await dbOperations.dynamoPut('daylight-schema-migrations', record);
  }

  private generateMigrationChecksum(migration: Migration): string {
    const content = migration.name + migration.version + migration.description;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private async verifyMigration(): Promise<void> {
    console.log('Verifying migration integrity...');
    
    // Check table existence
    const healthCheck = await dbOperations.healthCheck();
    if (!healthCheck.dynamodb) {
      throw new Error('DynamoDB health check failed');
    }
    
    // Verify data integrity (sample checks)
    await this.verifyDataIntegrity();
    
    console.log('Migration verification completed successfully');
  }

  private async verifyDataIntegrity(): Promise<void> {
    // Check if migrated data is accessible
    try {
      const historyCount = await dbOperations.dynamoQuery(getTableName('location_history'), {
        Select: 'COUNT'
      });
      console.log(`Verified ${historyCount.Count} location history records`);
      
      // Add more verification checks as needed
      
    } catch (error) {
      console.error('Data integrity verification failed:', error);
      throw error;
    }
  }

  private loadMigrations(): void {
    // Custom migrations can be added here
    this.migrations = [
      {
        version: '001',
        name: 'initial_schema',
        description: 'Create initial DynamoDB schema',
        up: async () => {
          // Already handled by table creator
        },
        down: async () => {
          // Drop tables if needed
        }
      },
      {
        version: '002',
        name: 'add_indexes',
        description: 'Add performance indexes',
        up: async () => {
          // Additional index creation
        },
        down: async () => {
          // Remove indexes
        }
      }
    ];
  }
}

// ===== Export Migration Tools =====

export const migrationManager = new ProductionMigrationManager();

export async function runProductionMigration(): Promise<void> {
  await migrationManager.runFullMigration();
}

export async function getMigrationStatus(): Promise<MigrationStatus> {
  const status = await migrationManager.getMigrationStatus();
  return status;
}
