import {
  AuditEvent,
  AuditEventType,
  AuditChange,
  AuditQuery,
  AuditLogRequest
} from '../../../shared/src/types/security';
import {
  docClient,
  SECURITY_CONFIG,
  KEY_PATTERNS,
  GSI_PATTERNS,
  generateId,
  getTimestamp,
  getCurrentDateString,
  batchProcess,
  maskSensitiveData
} from './securityDb';
import {
  PutCommand,
  QueryCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';

// Audit Logging Service
// Issue #119 - Advanced Security Framework

export class AuditService {
  private batchBuffer: AuditEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 25;
  private readonly BATCH_TIMEOUT_MS = 5000;

  constructor() {
    this.setupBatchProcessing();
  }

  // ===== Audit Event Creation =====

  async logEvent(request: AuditLogRequest, context?: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
    traceId?: string;
  }): Promise<AuditEvent> {
    const eventId = generateId();
    const timestamp = new Date().toISOString();
    
    const auditEvent: AuditEvent = {
      id: eventId,
      timestamp,
      eventType: request.eventType,
      userId: context?.userId,
      sessionId: context?.sessionId,
      resource: request.resource,
      action: request.action,
      outcome: request.outcome,
      riskLevel: request.riskLevel || this.calculateRiskLevel(request),
      
      // Context Information
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      geolocation: await this.getGeolocation(context?.ipAddress),
      
      // Event Details
      details: maskSensitiveData(request.details),
      changes: request.changes,
      
      // Compliance
      complianceLabels: request.complianceLabels || this.getComplianceLabels(request),
      retentionPolicy: this.getRetentionPolicy(request.eventType),
      
      // Metadata
      source: 'daylight-api',
      version: '1.0',
      correlationId: context?.correlationId,
      traceId: context?.traceId
    };

    // Add to batch for processing
    this.addToBatch(auditEvent);

    // For critical events, flush immediately
    if (auditEvent.riskLevel === 'critical') {
      await this.flushBatch();
    }

    return auditEvent;
  }

  async logAuthentication(
    eventType: 'authentication.login' | 'authentication.logout' | 'authentication.failed' | 'authentication.mfa',
    userId: string,
    details: Record<string, any>,
    context?: any
  ): Promise<AuditEvent> {
    return this.logEvent({
      eventType,
      resource: 'authentication',
      action: eventType.split('.')[1],
      outcome: eventType.includes('failed') ? 'failure' : 'success',
      details,
      riskLevel: eventType.includes('failed') ? 'medium' : 'low',
      complianceLabels: ['SOC2', 'GDPR']
    }, { ...context, userId });
  }

  async logAuthorization(
    granted: boolean,
    userId: string,
    resource: string,
    action: string,
    details: Record<string, any>,
    context?: any
  ): Promise<AuditEvent> {
    return this.logEvent({
      eventType: granted ? 'authorization.granted' : 'authorization.denied',
      resource,
      action,
      outcome: granted ? 'success' : 'failure',
      details,
      riskLevel: granted ? 'low' : 'medium',
      complianceLabels: ['SOC2']
    }, { ...context, userId });
  }

  async logDataAccess(
    operation: 'access' | 'create' | 'update' | 'delete' | 'export',
    userId: string,
    resource: string,
    recordId: string,
    changes?: AuditChange[],
    context?: any
  ): Promise<AuditEvent> {
    const riskLevel = operation === 'delete' || operation === 'export' ? 'high' : 'low';
    
    return this.logEvent({
      eventType: `data.${operation}` as AuditEventType,
      resource,
      action: operation,
      outcome: 'success',
      details: { recordId, recordCount: changes?.length || 1 },
      changes,
      riskLevel,
      complianceLabels: ['GDPR', 'CCPA', 'SOC2']
    }, { ...context, userId });
  }

  async logSecurityEvent(
    eventType: 'security.permission_change' | 'security.role_change' | 'security.policy_change' | 'security.breach_attempt',
    userId: string,
    resource: string,
    details: Record<string, any>,
    context?: any
  ): Promise<AuditEvent> {
    return this.logEvent({
      eventType,
      resource,
      action: eventType.split('.')[1],
      outcome: 'success',
      details,
      riskLevel: eventType.includes('breach') ? 'critical' : 'high',
      complianceLabels: ['SOC2', 'ISO27001']
    }, { ...context, userId });
  }

  async logComplianceEvent(
    eventType: 'compliance.data_request' | 'compliance.data_deletion',
    userId: string,
    details: Record<string, any>,
    context?: any
  ): Promise<AuditEvent> {
    return this.logEvent({
      eventType,
      resource: 'compliance',
      action: eventType.split('.')[1],
      outcome: 'success',
      details,
      riskLevel: 'high',
      complianceLabels: ['GDPR', 'CCPA', 'PIPEDA']
    }, { ...context, userId });
  }

  // ===== Audit Event Querying =====

  async queryAuditEvents(query: AuditQuery): Promise<{
    events: AuditEvent[];
    total: number;
    hasMore: boolean;
  }> {
    let queryParams: any = {
      TableName: SECURITY_CONFIG.TABLES.AUDIT_LOGS,
      Limit: query.limit || 100,
      ScanIndexForward: query.sortOrder === 'asc'
    };

    // Build query based on filters
    if (query.userId) {
      // Query by user
      queryParams.IndexName = 'GSI1'; // Assuming GSI1 is for user queries
      queryParams.KeyConditionExpression = 'GSI1PK = :userKey';
      queryParams.ExpressionAttributeValues = { ':userKey': `audit_user#${query.userId}` };
    } else if (query.dateFrom || query.dateTo) {
      // Query by date range
      const dateFrom = query.dateFrom ? new Date(query.dateFrom).toISOString().split('T')[0] : getCurrentDateString();
      const dateTo = query.dateTo ? new Date(query.dateTo).toISOString().split('T')[0] : getCurrentDateString();
      
      queryParams.KeyConditionExpression = 'PK BETWEEN :dateFrom AND :dateTo';
      queryParams.ExpressionAttributeValues = {
        ':dateFrom': `audit#${dateFrom}`,
        ':dateTo': `audit#${dateTo}`
      };
    } else {
      // Default to current date
      queryParams.KeyConditionExpression = 'PK = :pk';
      queryParams.ExpressionAttributeValues = { ':pk': `audit#${getCurrentDateString()}` };
    }

    // Add filters
    const filterExpressions: string[] = [];
    const attributeValues = queryParams.ExpressionAttributeValues || {};

    if (query.eventTypes && query.eventTypes.length > 0) {
      filterExpressions.push('eventType IN (' + query.eventTypes.map((_, i) => `:eventType${i}`).join(', ') + ')');
      query.eventTypes.forEach((eventType, i) => {
        attributeValues[`:eventType${i}`] = eventType;
      });
    }

    if (query.resource) {
      filterExpressions.push('contains(#resource, :resource)');
      attributeValues[':resource'] = query.resource;
      queryParams.ExpressionAttributeNames = { '#resource': 'resource' };
    }

    if (query.outcome) {
      filterExpressions.push('outcome = :outcome');
      attributeValues[':outcome'] = query.outcome;
    }

    if (query.riskLevel && query.riskLevel.length > 0) {
      filterExpressions.push('riskLevel IN (' + query.riskLevel.map((_, i) => `:risk${i}`).join(', ') + ')');
      query.riskLevel.forEach((risk, i) => {
        attributeValues[`:risk${i}`] = risk;
      });
    }

    if (query.ipAddress) {
      filterExpressions.push('ipAddress = :ip');
      attributeValues[':ip'] = query.ipAddress;
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
      queryParams.ExpressionAttributeValues = attributeValues;
    }

    const result = await docClient.send(new QueryCommand(queryParams));
    
    const events = (result.Items || []) as AuditEvent[];
    
    return {
      events,
      total: events.length, // In production, this would be a separate count query
      hasMore: !!result.LastEvaluatedKey
    };
  }

  async getAuditEventsByResource(resource: string, limit: number = 100): Promise<AuditEvent[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: SECURITY_CONFIG.TABLES.AUDIT_LOGS,
      IndexName: 'GSI2', // Assuming GSI2 is for resource queries
      KeyConditionExpression = 'GSI2PK = :resourceKey',
      ExpressionAttributeValues: {
        ':resourceKey': `audit_resource#${resource}`
      },
      Limit: limit,
      ScanIndexForward: false // Most recent first
    }));

    return (result.Items || []) as AuditEvent[];
  }

  async getAuditStatistics(dateFrom: string, dateTo: string): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByRisk: Record<string, number>;
    eventsByOutcome: Record<string, number>;
    topUsers: Array<{ userId: string; count: number }>;
    topResources: Array<{ resource: string; count: number }>;
  }> {
    // This would typically use analytics/aggregation pipelines
    // For now, return mock data structure
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsByRisk: {},
      eventsByOutcome: {},
      topUsers: [],
      topResources: []
    };
  }

  // ===== Batch Processing =====

  private addToBatch(event: AuditEvent): void {
    this.batchBuffer.push(event);
    
    if (this.batchBuffer.length >= this.BATCH_SIZE) {
      this.flushBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBatch(), this.BATCH_TIMEOUT_MS);
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const batch = this.batchBuffer.splice(0, this.BATCH_SIZE);
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      await this.writeBatchToDatabase(batch);
    } catch (error) {
      console.error('Failed to write audit batch to database:', error);
      // In production, implement retry logic or dead letter queue
    }
  }

  private async writeBatchToDatabase(events: AuditEvent[]): Promise<void> {
    await batchProcess(events, async (batch) => {
      const writeRequests = batch.flatMap(event => {
        const date = event.timestamp.split('T')[0];
        const timestamp = getTimestamp();
        
        return [
          // Primary partition by date
          {
            PutRequest: {
              Item: {
                ...KEY_PATTERNS.auditLog(date, timestamp, event.id),
                ...event,
                ttl: this.calculateTTL(event.retentionPolicy)
              }
            }
          },
          // GSI1 partition by user
          ...(event.userId ? [{
            PutRequest: {
              Item: {
                ...KEY_PATTERNS.auditByUser(event.userId, timestamp, event.id),
                ...event,
                ttl: this.calculateTTL(event.retentionPolicy)
              }
            }
          }] : []),
          // GSI2 partition by resource
          {
            PutRequest: {
              Item: {
                ...KEY_PATTERNS.auditByResource(event.resource, timestamp, event.id),
                ...event,
                ttl: this.calculateTTL(event.retentionPolicy)
              }
            }
          }
        ];
      });

      // Use BatchWriteCommand for efficiency
      const chunks = this.chunkArray(writeRequests, 25); // DynamoDB limit
      
      for (const chunk of chunks) {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [SECURITY_CONFIG.TABLES.AUDIT_LOGS]: chunk
          }
        }));
      }

      return [];
    });
  }

  private setupBatchProcessing(): void {
    // Flush batch on process exit
    process.on('SIGTERM', () => this.flushBatch());
    process.on('SIGINT', () => this.flushBatch());
    process.on('exit', () => this.flushBatch());
  }

  // ===== Helper Methods =====

  private calculateRiskLevel(request: AuditLogRequest): 'low' | 'medium' | 'high' | 'critical' {
    if (request.riskLevel) return request.riskLevel;

    // Calculate based on event type and context
    if (request.eventType.includes('breach') || request.eventType.includes('delete')) {
      return 'critical';
    }
    
    if (request.eventType.includes('failed') || request.eventType.includes('denied')) {
      return 'medium';
    }

    if (request.eventType.includes('admin') || request.eventType.includes('security')) {
      return 'high';
    }

    return 'low';
  }

  private getComplianceLabels(request: AuditLogRequest): string[] {
    const labels: string[] = [];

    // Add labels based on event type
    if (request.eventType.includes('authentication') || request.eventType.includes('authorization')) {
      labels.push('SOC2');
    }

    if (request.eventType.includes('data')) {
      labels.push('GDPR', 'CCPA');
    }

    if (request.eventType.includes('security')) {
      labels.push('SOC2', 'ISO27001');
    }

    if (request.eventType.includes('compliance')) {
      labels.push('GDPR', 'CCPA', 'PIPEDA');
    }

    return labels.length > 0 ? labels : ['SOC2']; // Default compliance label
  }

  private getRetentionPolicy(eventType: AuditEventType): string {
    // Define retention policies based on compliance requirements
    if (eventType.includes('compliance') || eventType.includes('security')) {
      return '7-years'; // Legal and regulatory requirements
    }

    if (eventType.includes('authentication') || eventType.includes('authorization')) {
      return '3-years'; // Security audit requirements
    }

    return '1-year'; // Default retention
  }

  private calculateTTL(retentionPolicy?: string): number {
    const now = Math.floor(Date.now() / 1000);
    
    switch (retentionPolicy) {
      case '7-years':
        return now + (7 * 365 * 24 * 60 * 60); // 7 years
      case '3-years':
        return now + (3 * 365 * 24 * 60 * 60); // 3 years
      case '1-year':
        return now + (365 * 24 * 60 * 60); // 1 year
      default:
        return now + SECURITY_CONFIG.AUDIT_RETENTION_DAYS * 24 * 60 * 60;
    }
  }

  private async getGeolocation(ipAddress?: string): Promise<any> {
    // In production, integrate with IP geolocation service
    if (!ipAddress || ipAddress === 'unknown') {
      return undefined;
    }

    // Mock geolocation data
    return {
      country: 'US',
      region: 'CA',
      city: 'San Francisco'
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export const auditService = new AuditService();
