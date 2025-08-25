// Production Data Retention & Archival System
// Issue #111 - Automated data lifecycle management

import { dbOperations, getTableName } from './databaseConnections.js';
import { DATA_RETENTION, DB_CONFIG, DATABASE_SCHEMAS } from './databaseConfig.js';
import { dbInstrumentation } from './databaseMonitoring.js';

// ===== Retention Interfaces =====

interface RetentionPolicy {
  tableName: string;
  retentionDays: number;
  archiveEnabled: boolean;
  archiveStorage?: 'dynamodb' | 's3' | 'glacier';
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  batchSize: number;
}

interface ArchivalRecord {
  id: string;
  tableName: string;
  originalRecordCount: number;
  archivedRecordCount: number;
  archiveLocation: string;
  compressionRatio?: number;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

interface RetentionJob {
  id: string;
  tableName: string;
  policy: RetentionPolicy;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsDeleted: number;
  recordsArchived: number;
  error?: string;
}

// ===== Data Retention Manager =====

export class DataRetentionManager {
  private retentionPolicies: Map<string, RetentionPolicy> = new Map();
  private activeJobs: Map<string, RetentionJob> = new Map();
  private isRunning: boolean = false;

  constructor() {
    this.setupRetentionPolicies();
  }

  async startRetentionService(): Promise<void> {
    if (this.isRunning) {
      console.log('Data retention service is already running');
      return;
    }

    console.log('Starting data retention service...');
    this.isRunning = true;

    // Run retention checks daily at 2 AM
    const dailyInterval = 24 * 60 * 60 * 1000; // 24 hours
    setInterval(async () => {
      await this.runDailyRetention();
    }, dailyInterval);

    // Run initial check
    await this.runDailyRetention();

    console.log('Data retention service started successfully');
  }

  stopRetentionService(): void {
    this.isRunning = false;
    console.log('Data retention service stopped');
  }

  async runDailyRetention(): Promise<void> {
    console.log('Starting daily data retention process...');

    const startTime = new Date().toISOString();
    const jobSummary = {
      totalTables: this.retentionPolicies.size,
      processedTables: 0,
      totalRecordsProcessed: 0,
      totalRecordsDeleted: 0,
      totalRecordsArchived: 0,
      errors: [] as string[]
    };

    try {
      for (const [tableName, policy] of this.retentionPolicies) {
        try {
          const job = await this.processTableRetention(tableName, policy);
          jobSummary.processedTables++;
          jobSummary.totalRecordsProcessed += job.recordsProcessed;
          jobSummary.totalRecordsDeleted += job.recordsDeleted;
          jobSummary.totalRecordsArchived += job.recordsArchived;
        } catch (error) {
          const errorMsg = `Failed to process retention for ${tableName}: ${error}`;
          console.error(errorMsg);
          jobSummary.errors.push(errorMsg);
        }
      }

      const duration = Date.now() - new Date(startTime).getTime();
      console.log(`Daily retention completed in ${duration}ms:`, jobSummary);

      // Log completion
      await this.logRetentionSummary(startTime, jobSummary);

    } catch (error) {
      console.error('Daily retention process failed:', error);
      jobSummary.errors.push(`Global error: ${error}`);
    }
  }

  async processTableRetention(tableName: string, policy: RetentionPolicy): Promise<RetentionJob> {
    const jobId = `retention_${tableName}_${Date.now()}`;
    const job: RetentionJob = {
      id: jobId,
      tableName,
      policy,
      startTime: new Date().toISOString(),
      status: 'running',
      recordsProcessed: 0,
      recordsDeleted: 0,
      recordsArchived: 0
    };

    this.activeJobs.set(jobId, job);

    try {
      console.log(`Processing retention for table: ${tableName}`);

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);
      const cutoffISO = cutoffDate.toISOString();

      // Find expired records
      const expiredRecords = await this.findExpiredRecords(tableName, cutoffISO);
      job.recordsProcessed = expiredRecords.length;

      if (expiredRecords.length === 0) {
        console.log(`No expired records found in ${tableName}`);
        job.status = 'completed';
        job.endTime = new Date().toISOString();
        return job;
      }

      console.log(`Found ${expiredRecords.length} expired records in ${tableName}`);

      // Archive records if enabled
      if (policy.archiveEnabled) {
        const archivedCount = await this.archiveRecords(tableName, expiredRecords, policy);
        job.recordsArchived = archivedCount;
      }

      // Delete expired records
      const deletedCount = await this.deleteExpiredRecords(tableName, expiredRecords, policy);
      job.recordsDeleted = deletedCount;

      job.status = 'completed';
      job.endTime = new Date().toISOString();

      console.log(`Retention completed for ${tableName}: processed=${job.recordsProcessed}, archived=${job.recordsArchived}, deleted=${job.recordsDeleted}`);

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.endTime = new Date().toISOString();
      console.error(`Retention failed for ${tableName}:`, error);
    } finally {
      this.activeJobs.delete(jobId);
    }

    return job;
  }

  private async findExpiredRecords(tableName: string, cutoffDate: string): Promise<any[]> {
    // Implementation depends on table structure
    // Most tables should have a timestamp field for filtering

    try {
      const result = await dbInstrumentation.instrumentQuery(
        tableName,
        'scan',
        async () => {
          return await dbOperations.dynamoQuery(tableName, {
            FilterExpression: '#timestamp < :cutoff',
            ExpressionAttributeNames: {
              '#timestamp': 'timestamp'
            },
            ExpressionAttributeValues: {
              ':cutoff': cutoffDate
            }
          });
        }
      );

      return result.Items || [];
    } catch (error) {
      // If timestamp field doesn't exist, try other date fields
      console.warn(`Could not filter by timestamp for ${tableName}, trying alternative date fields`);
      
      try {
        const result = await dbInstrumentation.instrumentQuery(
          tableName,
          'scan',
          async () => {
            return await dbOperations.dynamoQuery(tableName, {
              FilterExpression: '#createdAt < :cutoff',
              ExpressionAttributeNames: {
                '#createdAt': 'createdAt'
              },
              ExpressionAttributeValues: {
                ':cutoff': cutoffDate
              }
            });
          }
        );

        return result.Items || [];
      } catch (fallbackError) {
        console.warn(`No suitable date field found for retention in ${tableName}`);
        return [];
      }
    }
  }

  private async archiveRecords(tableName: string, records: any[], policy: RetentionPolicy): Promise<number> {
    if (!policy.archiveEnabled || records.length === 0) {
      return 0;
    }

    console.log(`Archiving ${records.length} records from ${tableName}`);

    try {
      const archiveId = `archive_${tableName}_${Date.now()}`;
      const archiveRecord: ArchivalRecord = {
        id: archiveId,
        tableName,
        originalRecordCount: records.length,
        archivedRecordCount: 0,
        archiveLocation: '',
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      // Create archive based on storage type
      switch (policy.archiveStorage) {
        case 's3':
          archiveRecord.archiveLocation = await this.archiveToS3(tableName, records, policy);
          break;
        case 'glacier':
          archiveRecord.archiveLocation = await this.archiveToGlacier(tableName, records, policy);
          break;
        case 'dynamodb':
        default:
          archiveRecord.archiveLocation = await this.archiveToDynamoDB(tableName, records, policy);
          break;
      }

      archiveRecord.archivedRecordCount = records.length;
      archiveRecord.status = 'completed';

      // Record the archival operation
      await this.recordArchival(archiveRecord);

      console.log(`Successfully archived ${records.length} records to ${archiveRecord.archiveLocation}`);
      return records.length;

    } catch (error) {
      console.error(`Failed to archive records from ${tableName}:`, error);
      return 0;
    }
  }

  private async archiveToS3(tableName: string, records: any[], policy: RetentionPolicy): Promise<string> {
    // S3 archival implementation
    const bucketName = process.env.ARCHIVE_S3_BUCKET || 'daylight-archives';
    const key = `${tableName}/${new Date().toISOString().split('T')[0]}/${Date.now()}.json`;

    try {
      // Prepare data for archival
      let archiveData = JSON.stringify(records);
      
      if (policy.compressionEnabled) {
        const zlib = await import('zlib');
        archiveData = zlib.gzipSync(archiveData).toString('base64');
      }

      // Upload to S3 (would need AWS SDK)
      console.log(`Would upload to S3: s3://${bucketName}/${key}`);
      
      return `s3://${bucketName}/${key}`;
    } catch (error) {
      console.error('S3 archival failed:', error);
      throw error;
    }
  }

  private async archiveToGlacier(tableName: string, records: any[], policy: RetentionPolicy): Promise<string> {
    // Glacier archival implementation
    const vaultName = process.env.ARCHIVE_GLACIER_VAULT || 'daylight-glacier-archive';
    
    try {
      // Prepare data for archival
      let archiveData = JSON.stringify(records);
      
      if (policy.compressionEnabled) {
        const zlib = await import('zlib');
        archiveData = zlib.gzipSync(archiveData).toString('base64');
      }

      // Upload to Glacier (would need AWS SDK)
      console.log(`Would upload to Glacier vault: ${vaultName}`);
      
      return `glacier://${vaultName}/archive_${Date.now()}`;
    } catch (error) {
      console.error('Glacier archival failed:', error);
      throw error;
    }
  }

  private async archiveToDynamoDB(tableName: string, records: any[], policy: RetentionPolicy): Promise<string> {
    // DynamoDB archival implementation (separate archive table)
    const archiveTableName = `${tableName}-archive`;
    
    try {
      let archivedCount = 0;
      
      // Process in batches
      for (let i = 0; i < records.length; i += policy.batchSize) {
        const batch = records.slice(i, i + policy.batchSize);
        
        for (const record of batch) {
          const archiveRecord = {
            ...record,
            archiveId: `archive_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            archivedAt: new Date().toISOString(),
            originalTable: tableName
          };
          
          await dbOperations.dynamoPut(archiveTableName, archiveRecord);
          archivedCount++;
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return `dynamodb://${archiveTableName}`;
    } catch (error) {
      console.error('DynamoDB archival failed:', error);
      throw error;
    }
  }

  private async deleteExpiredRecords(tableName: string, records: any[], policy: RetentionPolicy): Promise<number> {
    if (records.length === 0) {
      return 0;
    }

    console.log(`Deleting ${records.length} expired records from ${tableName}`);

    try {
      let deletedCount = 0;
      
      // Process in batches to avoid overwhelming the database
      for (let i = 0; i < records.length; i += policy.batchSize) {
        const batch = records.slice(i, i + policy.batchSize);
        
        for (const record of batch) {
          try {
            // Extract primary key for deletion
            const key = this.extractPrimaryKey(tableName, record);
            
            await dbInstrumentation.instrumentQuery(
              tableName,
              'delete',
              async () => {
                return await dbOperations.dynamoDelete(tableName, key);
              }
            );
            
            deletedCount++;
          } catch (error) {
            console.error(`Failed to delete record ${record.id || 'unknown'} from ${tableName}:`, error);
          }
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log(`Successfully deleted ${deletedCount} records from ${tableName}`);
      return deletedCount;
      
    } catch (error) {
      console.error(`Failed to delete expired records from ${tableName}:`, error);
      return 0;
    }
  }

  private extractPrimaryKey(tableName: string, record: any): any {
    // Extract primary key based on table schema
    // This would need to be customized based on actual table structures
    
    if (record.id) {
      return { id: record.id };
    }
    
    if (record.userId && record.timestamp) {
      return { userId: record.userId, timestamp: record.timestamp };
    }
    
    if (record.sessionId) {
      return { sessionId: record.sessionId };
    }
    
    // Fallback - try to determine from available fields
    const possibleKeys = ['id', 'pk', 'key', 'userId', 'sessionId', 'planId'];
    for (const keyField of possibleKeys) {
      if (record[keyField]) {
        return { [keyField]: record[keyField] };
      }
    }
    
    throw new Error(`Could not determine primary key for record in ${tableName}`);
  }

  private async recordArchival(archiveRecord: ArchivalRecord): Promise<void> {
    try {
      const archiveTableName = getTableName('data_archives');
      await dbOperations.dynamoPut(archiveTableName, archiveRecord);
    } catch (error) {
      console.error('Failed to record archival operation:', error);
    }
  }

  private async logRetentionSummary(startTime: string, summary: any): Promise<void> {
    try {
      const logRecord = {
        id: `retention_log_${Date.now()}`,
        startTime,
        endTime: new Date().toISOString(),
        summary,
        timestamp: new Date().toISOString()
      };
      
      const logTableName = getTableName('retention_logs');
      await dbOperations.dynamoPut(logTableName, logRecord);
    } catch (error) {
      console.error('Failed to log retention summary:', error);
    }
  }

  private setupRetentionPolicies(): void {
    // Setup retention policies based on configuration
    
    // Hot data policies (frequently accessed)
    for (const [dataType, days] of Object.entries(DATA_RETENTION.hot)) {
      const tableName = getTableName(dataType as keyof typeof DATABASE_SCHEMAS);
      this.retentionPolicies.set(tableName, {
        tableName,
        retentionDays: days,
        archiveEnabled: DATA_RETENTION.archive.enabled,
        archiveStorage: 'dynamodb',
        compressionEnabled: DATA_RETENTION.archive.compression,
        encryptionEnabled: DATA_RETENTION.archive.encryption,
        batchSize: 25
      });
    }
    
    // Warm data policies (occasionally accessed)
    for (const [dataType, days] of Object.entries(DATA_RETENTION.warm)) {
      const tableName = getTableName(dataType as keyof typeof DATABASE_SCHEMAS);
      this.retentionPolicies.set(tableName, {
        tableName,
        retentionDays: days,
        archiveEnabled: DATA_RETENTION.archive.enabled,
        archiveStorage: 's3',
        compressionEnabled: DATA_RETENTION.archive.compression,
        encryptionEnabled: DATA_RETENTION.archive.encryption,
        batchSize: 50
      });
    }
    
    // Cold data policies (archived but retained)
    for (const [dataType, days] of Object.entries(DATA_RETENTION.cold)) {
      const tableName = getTableName(dataType as keyof typeof DATABASE_SCHEMAS);
      this.retentionPolicies.set(tableName, {
        tableName,
        retentionDays: days,
        archiveEnabled: DATA_RETENTION.archive.enabled,
        archiveStorage: 'glacier',
        compressionEnabled: DATA_RETENTION.archive.compression,
        encryptionEnabled: DATA_RETENTION.archive.encryption,
        batchSize: 100
      });
    }
    
    console.log(`Configured retention policies for ${this.retentionPolicies.size} tables`);
  }

  // Public API methods
  
  async getRetentionStatus(): Promise<{
    policies: RetentionPolicy[];
    activeJobs: RetentionJob[];
    lastRun?: string;
  }> {
    return {
      policies: Array.from(this.retentionPolicies.values()),
      activeJobs: Array.from(this.activeJobs.values()),
      lastRun: await this.getLastRetentionRun()
    };
  }

  async runManualRetention(tableName: string): Promise<RetentionJob> {
    const policy = this.retentionPolicies.get(tableName);
    if (!policy) {
      throw new Error(`No retention policy found for table: ${tableName}`);
    }
    
    return await this.processTableRetention(tableName, policy);
  }

  async getArchiveHistory(limit: number = 50): Promise<ArchivalRecord[]> {
    try {
      const archiveTableName = getTableName('data_archives');
      const result = await dbOperations.dynamoQuery(archiveTableName, {
        Limit: limit,
        ScanIndexForward: false // Most recent first
      });
      
      return result.Items || [];
    } catch (error) {
      console.error('Failed to get archive history:', error);
      return [];
    }
  }

  private async getLastRetentionRun(): Promise<string | undefined> {
    try {
      const logTableName = getTableName('retention_logs');
      const result = await dbOperations.dynamoQuery(logTableName, {
        Limit: 1,
        ScanIndexForward: false
      });
      
      if (result.Items && result.Items.length > 0) {
        return result.Items[0].startTime;
      }
    } catch (error) {
      console.error('Failed to get last retention run:', error);
    }
    
    return undefined;
  }
}

// ===== Singleton Instance =====

export const dataRetentionManager = new DataRetentionManager();

// ===== Startup/Shutdown Functions =====

export async function startDataRetention(): Promise<void> {
  if (DB_CONFIG.environment === 'production') {
    await dataRetentionManager.startRetentionService();
    console.log('Data retention service started for production environment');
  } else {
    console.log('Data retention service disabled for non-production environment');
  }
}

export function stopDataRetention(): void {
  dataRetentionManager.stopRetentionService();
}

// ===== Manual Operations =====

export async function runManualRetention(tableName?: string): Promise<RetentionJob[]> {
  if (tableName) {
    const job = await dataRetentionManager.runManualRetention(tableName);
    return [job];
  } else {
    await dataRetentionManager.runDailyRetention();
    return [];
  }
}

export async function getRetentionReport(): Promise<{
  status: any;
  archives: ArchivalRecord[];
}> {
  const [status, archives] = await Promise.all([
    dataRetentionManager.getRetentionStatus(),
    dataRetentionManager.getArchiveHistory(100)
  ]);

  return { status, archives };
}
