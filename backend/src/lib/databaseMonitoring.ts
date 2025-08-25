// Production Database Monitoring & Metrics
// Issue #111 - Real-time monitoring and performance tracking

import { dbOperations, getTableName } from './databaseConnections.js';
import { MONITORING_CONFIG, PERFORMANCE_CONFIG, DB_CONFIG } from './databaseConfig.js';

// ===== Metrics Interfaces =====

interface DatabaseMetrics {
  connectionPool: {
    active: number;
    idle: number;
    total: number;
    pending: number;
    utilization: number;
  };
  performance: {
    avgQueryTime: number;
    slowQueries: number;
    errorRate: number;
    throughput: {
      reads: number;
      writes: number;
      total: number;
    };
  };
  resources: {
    cpuUtilization: number;
    memoryUtilization: number;
    diskUtilization: number;
    networkIO: number;
  };
  health: {
    status: 'healthy' | 'warning' | 'critical';
    lastCheck: string;
    uptime: number;
    errors: string[];
  };
}

interface QueryMetrics {
  queryId: string;
  tableName: string;
  operation: 'query' | 'put' | 'update' | 'delete' | 'scan';
  duration: number;
  recordCount: number;
  consumedCapacity?: number;
  timestamp: string;
  userId?: string;
  error?: string;
}

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  cooldown: number; // minutes
  lastTriggered?: string;
}

// ===== Performance Monitor =====

class DatabasePerformanceMonitor {
  private metrics: Map<string, QueryMetrics[]> = new Map();
  private alerts: AlertRule[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupDefaultAlerts();
  }

  start(): void {
    if (this.isMonitoring) return;

    console.log('Starting database performance monitoring...');
    this.isMonitoring = true;

    const interval = MONITORING_CONFIG.metrics.interval * 1000;
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      await this.checkAlerts();
    }, interval);

    console.log(`Database monitoring started with ${interval}ms interval`);
  }

  stop(): void {
    if (!this.isMonitoring) return;

    console.log('Stopping database performance monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  recordQuery(metrics: QueryMetrics): void {
    const hour = new Date().toISOString().slice(0, 13);
    if (!this.metrics.has(hour)) {
      this.metrics.set(hour, []);
    }
    
    this.metrics.get(hour)!.push(metrics);
    
    // Keep only recent data
    this.cleanupOldMetrics();
    
    // Check for immediate alerts
    this.checkQueryAlert(metrics);
  }

  async getMetrics(hours: number = 1): Promise<DatabaseMetrics> {
    const now = new Date();
    const hoursBack = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    
    const recentMetrics: QueryMetrics[] = [];
    
    for (const [hour, metrics] of this.metrics.entries()) {
      const hourDate = new Date(hour + ':00:00.000Z');
      if (hourDate >= hoursBack) {
        recentMetrics.push(...metrics);
      }
    }

    return this.calculateMetrics(recentMetrics);
  }

  async getSlowQueries(limit: number = 10): Promise<QueryMetrics[]> {
    const allMetrics: QueryMetrics[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }

    return allMetrics
      .filter(m => m.duration > MONITORING_CONFIG.metrics.thresholds.queryLatency)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  async getErrorQueries(limit: number = 10): Promise<QueryMetrics[]> {
    const allMetrics: QueryMetrics[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }

    return allMetrics
      .filter(m => m.error)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Collect connection stats
      const connectionStats = await dbOperations.getConnectionStats();
      
      // Collect health status
      const healthStatus = await dbOperations.healthCheck();
      
      // Store in metrics collection
      const currentMetrics = await this.getMetrics(1);
      
      // Log metrics for monitoring systems
      if (MONITORING_CONFIG.logging.structured) {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          type: 'database_metrics',
          data: {
            connections: connectionStats,
            health: healthStatus,
            performance: currentMetrics.performance
          }
        }));
      }
      
    } catch (error) {
      console.error('Failed to collect database metrics:', error);
    }
  }

  private calculateMetrics(queries: QueryMetrics[]): DatabaseMetrics {
    if (queries.length === 0) {
      return this.getEmptyMetrics();
    }

    const totalDuration = queries.reduce((sum, q) => sum + q.duration, 0);
    const slowQueries = queries.filter(q => q.duration > MONITORING_CONFIG.metrics.thresholds.queryLatency).length;
    const errorQueries = queries.filter(q => q.error).length;
    
    const reads = queries.filter(q => q.operation === 'query' || q.operation === 'scan').length;
    const writes = queries.filter(q => q.operation === 'put' || q.operation === 'update' || q.operation === 'delete').length;

    return {
      connectionPool: {
        active: 0, // Will be populated from actual connection stats
        idle: 0,
        total: 0,
        pending: 0,
        utilization: 0
      },
      performance: {
        avgQueryTime: totalDuration / queries.length,
        slowQueries,
        errorRate: errorQueries / queries.length,
        throughput: {
          reads,
          writes,
          total: queries.length
        }
      },
      resources: {
        cpuUtilization: 0, // Would need CloudWatch integration
        memoryUtilization: 0,
        diskUtilization: 0,
        networkIO: 0
      },
      health: {
        status: errorQueries > 0 ? 'warning' : 'healthy',
        lastCheck: new Date().toISOString(),
        uptime: 0,
        errors: queries.filter(q => q.error).map(q => q.error!)
      }
    };
  }

  private getEmptyMetrics(): DatabaseMetrics {
    return {
      connectionPool: { active: 0, idle: 0, total: 0, pending: 0, utilization: 0 },
      performance: { avgQueryTime: 0, slowQueries: 0, errorRate: 0, throughput: { reads: 0, writes: 0, total: 0 } },
      resources: { cpuUtilization: 0, memoryUtilization: 0, diskUtilization: 0, networkIO: 0 },
      health: { status: 'healthy', lastCheck: new Date().toISOString(), uptime: 0, errors: [] }
    };
  }

  private cleanupOldMetrics(): void {
    const retentionHours = MONITORING_CONFIG.metrics.retention * 24;
    const cutoff = new Date(Date.now() - (retentionHours * 60 * 60 * 1000));
    
    for (const [hour, _] of this.metrics.entries()) {
      const hourDate = new Date(hour + ':00:00.000Z');
      if (hourDate < cutoff) {
        this.metrics.delete(hour);
      }
    }
  }

  private setupDefaultAlerts(): void {
    this.alerts = [
      {
        id: 'high_latency',
        name: 'High Query Latency',
        metric: 'avgQueryTime',
        operator: '>',
        threshold: MONITORING_CONFIG.metrics.thresholds.queryLatency,
        severity: 'warning',
        enabled: true,
        cooldown: 5
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        metric: 'errorRate',
        operator: '>',
        threshold: MONITORING_CONFIG.metrics.thresholds.errorRate,
        severity: 'critical',
        enabled: true,
        cooldown: 10
      },
      {
        id: 'connection_limit',
        name: 'High Connection Utilization',
        metric: 'connectionUtilization',
        operator: '>',
        threshold: MONITORING_CONFIG.metrics.thresholds.connectionUtilization,
        severity: 'warning',
        enabled: true,
        cooldown: 5
      }
    ];
  }

  private async checkAlerts(): Promise<void> {
    if (!MONITORING_CONFIG.alerts.enabled) return;

    const metrics = await this.getMetrics(1);
    
    for (const alert of this.alerts) {
      if (!alert.enabled) continue;
      
      if (this.isAlertInCooldown(alert)) continue;
      
      if (this.shouldTriggerAlert(alert, metrics)) {
        await this.triggerAlert(alert, metrics);
        alert.lastTriggered = new Date().toISOString();
      }
    }
  }

  private checkQueryAlert(queryMetrics: QueryMetrics): void {
    // Immediate alert for very slow queries
    if (queryMetrics.duration > MONITORING_CONFIG.metrics.thresholds.queryLatency * 2) {
      this.sendInstantAlert('Very slow query detected', {
        queryId: queryMetrics.queryId,
        duration: queryMetrics.duration,
        table: queryMetrics.tableName,
        operation: queryMetrics.operation
      });
    }
    
    // Immediate alert for errors
    if (queryMetrics.error) {
      this.sendInstantAlert('Database query error', {
        queryId: queryMetrics.queryId,
        error: queryMetrics.error,
        table: queryMetrics.tableName,
        operation: queryMetrics.operation
      });
    }
  }

  private isAlertInCooldown(alert: AlertRule): boolean {
    if (!alert.lastTriggered) return false;
    
    const lastTriggered = new Date(alert.lastTriggered);
    const cooldownEnd = new Date(lastTriggered.getTime() + (alert.cooldown * 60 * 1000));
    
    return new Date() < cooldownEnd;
  }

  private shouldTriggerAlert(alert: AlertRule, metrics: DatabaseMetrics): boolean {
    let value: number;
    
    switch (alert.metric) {
      case 'avgQueryTime':
        value = metrics.performance.avgQueryTime;
        break;
      case 'errorRate':
        value = metrics.performance.errorRate;
        break;
      case 'connectionUtilization':
        value = metrics.connectionPool.utilization;
        break;
      default:
        return false;
    }
    
    switch (alert.operator) {
      case '>':
        return value > alert.threshold;
      case '<':
        return value < alert.threshold;
      case '>=':
        return value >= alert.threshold;
      case '<=':
        return value <= alert.threshold;
      case '=':
        return value === alert.threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(alert: AlertRule, metrics: DatabaseMetrics): Promise<void> {
    const alertData = {
      alert: alert.name,
      severity: alert.severity,
      timestamp: new Date().toISOString(),
      metrics: metrics,
      threshold: alert.threshold
    };

    console.warn(`DATABASE ALERT: ${alert.name}`, alertData);
    
    // Send to configured alert channels
    await this.sendToAlertChannels(alertData);
  }

  private async sendInstantAlert(message: string, data: any): Promise<void> {
    const alertData = {
      alert: message,
      severity: 'warning' as const,
      timestamp: new Date().toISOString(),
      data
    };

    console.warn(`DATABASE INSTANT ALERT: ${message}`, alertData);
    
    await this.sendToAlertChannels(alertData);
  }

  private async sendToAlertChannels(alertData: any): Promise<void> {
    const channels = MONITORING_CONFIG.alerts.channels;
    
    // Email alerts
    if (channels.email) {
      await this.sendEmailAlert(channels.email, alertData);
    }
    
    // Slack alerts
    if (channels.slack) {
      await this.sendSlackAlert(channels.slack, alertData);
    }
    
    // SNS alerts
    if (channels.sns) {
      await this.sendSNSAlert(channels.sns, alertData);
    }
    
    // PagerDuty alerts
    if (channels.pagerduty) {
      await this.sendPagerDutyAlert(channels.pagerduty, alertData);
    }
  }

  private async sendEmailAlert(email: string, alertData: any): Promise<void> {
    // Email implementation would go here
    console.log(`Would send email alert to ${email}:`, alertData);
  }

  private async sendSlackAlert(webhook: string, alertData: any): Promise<void> {
    try {
      const payload = {
        text: `Database Alert: ${alertData.alert}`,
        attachments: [
          {
            color: alertData.severity === 'critical' ? 'danger' : 'warning',
            fields: [
              {
                title: 'Severity',
                value: alertData.severity,
                short: true
              },
              {
                title: 'Time',
                value: alertData.timestamp,
                short: true
              }
            ]
          }
        ]
      };

      // Would use fetch or HTTP client to send to Slack
      console.log(`Would send Slack alert to ${webhook}:`, payload);
      
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  private async sendSNSAlert(topicArn: string, alertData: any): Promise<void> {
    // SNS implementation would go here
    console.log(`Would send SNS alert to ${topicArn}:`, alertData);
  }

  private async sendPagerDutyAlert(apiKey: string, alertData: any): Promise<void> {
    // PagerDuty implementation would go here
    console.log(`Would send PagerDuty alert with key ${apiKey}:`, alertData);
  }
}

// ===== Query Instrumentation =====

export class DatabaseInstrumentation {
  private monitor: DatabasePerformanceMonitor;

  constructor() {
    this.monitor = new DatabasePerformanceMonitor();
  }

  start(): void {
    this.monitor.start();
  }

  stop(): void {
    this.monitor.stop();
  }

  async instrumentQuery<T>(
    tableName: string,
    operation: QueryMetrics['operation'],
    queryFn: () => Promise<T>,
    userId?: string
  ): Promise<T> {
    const queryId = this.generateQueryId();
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      // Extract record count from result
      let recordCount = 0;
      if (typeof result === 'object' && result !== null) {
        if ('Count' in result) {
          recordCount = (result as any).Count;
        } else if ('Items' in result && Array.isArray((result as any).Items)) {
          recordCount = (result as any).Items.length;
        }
      }
      
      this.monitor.recordQuery({
        queryId,
        tableName,
        operation,
        duration,
        recordCount,
        timestamp: new Date().toISOString(),
        userId
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.monitor.recordQuery({
        queryId,
        tableName,
        operation,
        duration,
        recordCount: 0,
        timestamp: new Date().toISOString(),
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  async getMetrics(hours: number = 1): Promise<DatabaseMetrics> {
    return this.monitor.getMetrics(hours);
  }

  async getSlowQueries(limit: number = 10): Promise<QueryMetrics[]> {
    return this.monitor.getSlowQueries(limit);
  }

  async getErrorQueries(limit: number = 10): Promise<QueryMetrics[]> {
    return this.monitor.getErrorQueries(limit);
  }

  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ===== Health Check System =====

export class DatabaseHealthChecker {
  private lastHealthCheck: { [key: string]: boolean } = {};
  private healthHistory: { timestamp: string; status: { [key: string]: boolean } }[] = [];

  async performHealthCheck(): Promise<{ [key: string]: boolean }> {
    const health = await dbOperations.healthCheck();
    
    this.lastHealthCheck = health;
    this.healthHistory.push({
      timestamp: new Date().toISOString(),
      status: { ...health }
    });
    
    // Keep only recent history
    const maxHistory = 100;
    if (this.healthHistory.length > maxHistory) {
      this.healthHistory = this.healthHistory.slice(-maxHistory);
    }
    
    // Log health status
    const unhealthyServices = Object.entries(health)
      .filter(([_, isHealthy]) => !isHealthy)
      .map(([service, _]) => service);
    
    if (unhealthyServices.length > 0) {
      console.warn(`Database health check failed for: ${unhealthyServices.join(', ')}`);
    } else {
      console.log('Database health check passed for all services');
    }
    
    return health;
  }

  getLastHealthCheck(): { [key: string]: boolean } {
    return { ...this.lastHealthCheck };
  }

  getHealthHistory(limit: number = 10): { timestamp: string; status: { [key: string]: boolean } }[] {
    return this.healthHistory.slice(-limit);
  }

  async getDetailedHealth(): Promise<{
    services: { [key: string]: boolean };
    uptime: number;
    lastCheck: string;
    consecutiveFailures: { [key: string]: number };
  }> {
    const health = await this.performHealthCheck();
    
    // Calculate consecutive failures
    const consecutiveFailures: { [key: string]: number } = {};
    for (const service of Object.keys(health)) {
      consecutiveFailures[service] = this.getConsecutiveFailures(service);
    }
    
    return {
      services: health,
      uptime: this.calculateUptime(),
      lastCheck: new Date().toISOString(),
      consecutiveFailures
    };
  }

  private getConsecutiveFailures(service: string): number {
    let failures = 0;
    
    // Count consecutive failures from most recent
    for (let i = this.healthHistory.length - 1; i >= 0; i--) {
      const check = this.healthHistory[i];
      if (check.status[service] === false) {
        failures++;
      } else {
        break;
      }
    }
    
    return failures;
  }

  private calculateUptime(): number {
    if (this.healthHistory.length === 0) return 0;
    
    const totalChecks = this.healthHistory.length;
    const successfulChecks = this.healthHistory.filter(check => 
      Object.values(check.status).every(status => status)
    ).length;
    
    return (successfulChecks / totalChecks) * 100;
  }
}

// ===== Singleton Instances =====

export const dbInstrumentation = new DatabaseInstrumentation();
export const dbHealthChecker = new DatabaseHealthChecker();

// ===== Startup & Shutdown =====

export function startDatabaseMonitoring(): void {
  if (MONITORING_CONFIG.metrics.enabled) {
    dbInstrumentation.start();
    console.log('Database monitoring started');
  }
}

export function stopDatabaseMonitoring(): void {
  dbInstrumentation.stop();
  console.log('Database monitoring stopped');
}

// ===== API Wrapper =====

export async function getSystemMetrics(): Promise<{
  performance: DatabaseMetrics;
  health: any;
  slowQueries: QueryMetrics[];
  errors: QueryMetrics[];
}> {
  const [performance, health, slowQueries, errors] = await Promise.all([
    dbInstrumentation.getMetrics(1),
    dbHealthChecker.getDetailedHealth(),
    dbInstrumentation.getSlowQueries(10),
    dbInstrumentation.getErrorQueries(10)
  ]);

  return {
    performance,
    health,
    slowQueries,
    errors
  };
}
