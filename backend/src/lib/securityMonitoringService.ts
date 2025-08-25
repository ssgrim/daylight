import { auditService } from './auditService';
import { 
  SecurityAlert,
  SecurityMetric,
  ThreatDetectionRule,
  SecurityIncident,
  VulnerabilityReport,
  ComplianceReport
} from '../../../shared/src/types/security';

// Security Monitoring & Alerting Service
// Issue #119 - Advanced Security Framework

export class SecurityMonitoringService {
  private alertThresholds: Map<string, number> = new Map();
  private activeIncidents: Map<string, SecurityIncident> = new Map();
  private threatRules: ThreatDetectionRule[] = [];

  constructor() {
    this.initializeDefaultThresholds();
    this.initializeThreatRules();
  }

  // ===== Threat Detection =====

  async detectThreats(events: any[]): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];

    for (const rule of this.threatRules) {
      try {
        const matchedEvents = events.filter(event => this.evaluateRule(rule, event));
        
        if (matchedEvents.length >= rule.threshold) {
          const alert = await this.createSecurityAlert(rule, matchedEvents);
          alerts.push(alert);
        }
      } catch (error) {
        console.error(`Error evaluating threat rule ${rule.id}:`, error);
      }
    }

    return alerts;
  }

  async detectBruteForceAttack(ipAddress: string, timeWindowMs: number = 300000): Promise<SecurityAlert | null> {
    const query = {
      eventTypes: ['authentication.failed'],
      ipAddress,
      dateFrom: new Date(Date.now() - timeWindowMs).toISOString(),
      dateTo: new Date().toISOString(),
      limit: 100
    };

    const { events } = await auditService.queryAuditEvents(query);
    
    if (events.length >= 5) { // 5 failed attempts in time window
      return this.createSecurityAlert({
        id: 'brute_force_detection',
        name: 'Brute Force Attack Detection',
        description: 'Multiple failed authentication attempts detected',
        severity: 'high',
        category: 'authentication',
        threshold: 5,
        conditions: [],
        actions: ['alert', 'block_ip']
      }, events);
    }

    return null;
  }

  async detectSuspiciousActivity(userId: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check for unusual login patterns
    const loginQuery = {
      eventTypes: ['authentication.login'],
      userId,
      dateFrom: oneHourAgo.toISOString(),
      dateTo: now.toISOString(),
      limit: 100
    };

    const { events: loginEvents } = await auditService.queryAuditEvents(loginQuery);
    
    // Multiple logins from different IPs
    const uniqueIPs = new Set(loginEvents.map(e => e.ipAddress).filter(ip => ip));
    if (uniqueIPs.size >= 3) {
      alerts.push(await this.createSecurityAlert({
        id: 'multiple_ip_login',
        name: 'Multiple IP Login Detection',
        description: 'User logged in from multiple IP addresses',
        severity: 'medium',
        category: 'authentication',
        threshold: 3,
        conditions: [],
        actions: ['alert', 'require_mfa']
      }, loginEvents));
    }

    // Check for privilege escalation attempts
    const privQuery = {
      eventTypes: ['authorization.denied'],
      userId,
      dateFrom: oneHourAgo.toISOString(),
      dateTo: now.toISOString(),
      limit: 50
    };

    const { events: privEvents } = await auditService.queryAuditEvents(privQuery);
    
    if (privEvents.length >= 10) {
      alerts.push(await this.createSecurityAlert({
        id: 'privilege_escalation_attempt',
        name: 'Privilege Escalation Attempt',
        description: 'Multiple authorization failures detected',
        severity: 'high',
        category: 'authorization',
        threshold: 10,
        conditions: [],
        actions: ['alert', 'temporary_suspension']
      }, privEvents));
    }

    return alerts;
  }

  async detectDataExfiltration(userId: string): Promise<SecurityAlert | null> {
    const query = {
      eventTypes: ['data.export', 'data.access'],
      userId,
      dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
      dateTo: new Date().toISOString(),
      limit: 1000
    };

    const { events } = await auditService.queryAuditEvents(query);
    
    // Calculate data access volume
    const totalRecords = events.reduce((sum, event) => {
      return sum + (event.details?.recordCount || 1);
    }, 0);

    // Alert if more than 1000 records accessed in 24 hours
    if (totalRecords > 1000) {
      return this.createSecurityAlert({
        id: 'data_exfiltration_detection',
        name: 'Potential Data Exfiltration',
        description: 'Unusual volume of data access detected',
        severity: 'critical',
        category: 'data_loss_prevention',
        threshold: 1000,
        conditions: [],
        actions: ['alert', 'immediate_investigation', 'temporary_suspension']
      }, events);
    }

    return null;
  }

  // ===== Real-time Monitoring =====

  async processSecurityEvent(event: any): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];

    // Check for immediate threats
    if (event.eventType === 'authentication.failed') {
      const bruteForceAlert = await this.detectBruteForceAttack(event.ipAddress);
      if (bruteForceAlert) {
        alerts.push(bruteForceAlert);
      }
    }

    if (event.userId) {
      const suspiciousAlerts = await this.detectSuspiciousActivity(event.userId);
      alerts.push(...suspiciousAlerts);

      if (event.eventType.startsWith('data.')) {
        const exfiltrationAlert = await this.detectDataExfiltration(event.userId);
        if (exfiltrationAlert) {
          alerts.push(exfiltrationAlert);
        }
      }
    }

    // Process any generated alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }

    return alerts;
  }

  // ===== Metrics Collection =====

  async collectSecurityMetrics(timeRange: { from: Date; to: Date }): Promise<SecurityMetric[]> {
    const metrics: SecurityMetric[] = [];

    // Authentication metrics
    const authMetrics = await this.calculateAuthenticationMetrics(timeRange);
    metrics.push(...authMetrics);

    // Authorization metrics
    const authzMetrics = await this.calculateAuthorizationMetrics(timeRange);
    metrics.push(...authzMetrics);

    // Data access metrics
    const dataMetrics = await this.calculateDataAccessMetrics(timeRange);
    metrics.push(...dataMetrics);

    // Security alert metrics
    const alertMetrics = await this.calculateAlertMetrics(timeRange);
    metrics.push(...alertMetrics);

    return metrics;
  }

  private async calculateAuthenticationMetrics(timeRange: { from: Date; to: Date }): Promise<SecurityMetric[]> {
    const query = {
      eventTypes: ['authentication.login', 'authentication.failed', 'authentication.logout'],
      dateFrom: timeRange.from.toISOString(),
      dateTo: timeRange.to.toISOString(),
      limit: 10000
    };

    const { events } = await auditService.queryAuditEvents(query);
    
    const logins = events.filter(e => e.eventType === 'authentication.login').length;
    const failures = events.filter(e => e.eventType === 'authentication.failed').length;
    const total = logins + failures;
    const successRate = total > 0 ? (logins / total) * 100 : 0;

    return [
      {
        name: 'authentication_success_rate',
        value: successRate,
        unit: 'percentage',
        timestamp: new Date().toISOString(),
        tags: { category: 'authentication' }
      },
      {
        name: 'authentication_failures',
        value: failures,
        unit: 'count',
        timestamp: new Date().toISOString(),
        tags: { category: 'authentication' }
      },
      {
        name: 'total_logins',
        value: logins,
        unit: 'count',
        timestamp: new Date().toISOString(),
        tags: { category: 'authentication' }
      }
    ];
  }

  private async calculateAuthorizationMetrics(timeRange: { from: Date; to: Date }): Promise<SecurityMetric[]> {
    const query = {
      eventTypes: ['authorization.granted', 'authorization.denied'],
      dateFrom: timeRange.from.toISOString(),
      dateTo: timeRange.to.toISOString(),
      limit: 10000
    };

    const { events } = await auditService.queryAuditEvents(query);
    
    const granted = events.filter(e => e.eventType === 'authorization.granted').length;
    const denied = events.filter(e => e.eventType === 'authorization.denied').length;

    return [
      {
        name: 'authorization_granted',
        value: granted,
        unit: 'count',
        timestamp: new Date().toISOString(),
        tags: { category: 'authorization' }
      },
      {
        name: 'authorization_denied',
        value: denied,
        unit: 'count',
        timestamp: new Date().toISOString(),
        tags: { category: 'authorization' }
      }
    ];
  }

  private async calculateDataAccessMetrics(timeRange: { from: Date; to: Date }): Promise<SecurityMetric[]> {
    const query = {
      eventTypes: ['data.access', 'data.create', 'data.update', 'data.delete', 'data.export'],
      dateFrom: timeRange.from.toISOString(),
      dateTo: timeRange.to.toISOString(),
      limit: 10000
    };

    const { events } = await auditService.queryAuditEvents(query);
    
    const byType: Record<string, number> = {};
    for (const event of events) {
      const type = event.eventType.replace('data.', '');
      byType[type] = (byType[type] || 0) + 1;
    }

    return Object.entries(byType).map(([type, count]) => ({
      name: `data_${type}`,
      value: count,
      unit: 'count',
      timestamp: new Date().toISOString(),
      tags: { category: 'data_access', operation: type }
    }));
  }

  private async calculateAlertMetrics(timeRange: { from: Date; to: Date }): Promise<SecurityMetric[]> {
    // In production, this would query a dedicated alerts table
    return [
      {
        name: 'security_alerts_generated',
        value: 0, // Placeholder
        unit: 'count',
        timestamp: new Date().toISOString(),
        tags: { category: 'security_monitoring' }
      }
    ];
  }

  // ===== Vulnerability Scanning =====

  async performVulnerabilityAssessment(): Promise<VulnerabilityReport> {
    const vulnerabilities: any[] = [];

    // Check for weak authentication patterns
    const weakAuthVulns = await this.checkWeakAuthentication();
    vulnerabilities.push(...weakAuthVulns);

    // Check for privilege escalation risks
    const privEscVulns = await this.checkPrivilegeEscalation();
    vulnerabilities.push(...privEscVulns);

    // Check for data exposure risks
    const dataExpVulns = await this.checkDataExposure();
    vulnerabilities.push(...dataExpVulns);

    return {
      scanId: `scan_${Date.now()}`,
      scanDate: new Date().toISOString(),
      totalVulnerabilities: vulnerabilities.length,
      criticalCount: vulnerabilities.filter(v => v.severity === 'critical').length,
      highCount: vulnerabilities.filter(v => v.severity === 'high').length,
      mediumCount: vulnerabilities.filter(v => v.severity === 'medium').length,
      lowCount: vulnerabilities.filter(v => v.severity === 'low').length,
      vulnerabilities,
      recommendations: this.generateRecommendations(vulnerabilities)
    };
  }

  private async checkWeakAuthentication(): Promise<any[]> {
    // Check for users without MFA, weak passwords, etc.
    const vulnerabilities: any[] = [];

    // This would integrate with user management system
    // For now, return placeholder
    return vulnerabilities;
  }

  private async checkPrivilegeEscalation(): Promise<any[]> {
    // Check for overprivileged users, stale permissions, etc.
    const vulnerabilities: any[] = [];

    // This would analyze role assignments and permissions
    return vulnerabilities;
  }

  private async checkDataExposure(): Promise<any[]> {
    // Check for unencrypted sensitive data, broad access permissions, etc.
    const vulnerabilities: any[] = [];

    // This would scan data stores and access patterns
    return vulnerabilities;
  }

  private generateRecommendations(vulnerabilities: any[]): string[] {
    const recommendations: string[] = [];

    if (vulnerabilities.some(v => v.type === 'weak_authentication')) {
      recommendations.push('Enforce multi-factor authentication for all users');
    }

    if (vulnerabilities.some(v => v.type === 'overprivileged_user')) {
      recommendations.push('Review and reduce user privileges following principle of least privilege');
    }

    if (vulnerabilities.some(v => v.type === 'unencrypted_data')) {
      recommendations.push('Implement encryption for sensitive data at rest and in transit');
    }

    return recommendations;
  }

  // ===== Compliance Monitoring =====

  async generateComplianceReport(framework: string): Promise<ComplianceReport> {
    const requirements = this.getComplianceRequirements(framework);
    const assessments: any[] = [];

    for (const requirement of requirements) {
      const assessment = await this.assessComplianceRequirement(requirement);
      assessments.push(assessment);
    }

    const compliant = assessments.filter(a => a.status === 'compliant').length;
    const total = assessments.length;

    return {
      framework,
      reportDate: new Date().toISOString(),
      overallScore: total > 0 ? (compliant / total) * 100 : 0,
      compliantCount: compliant,
      nonCompliantCount: total - compliant,
      totalRequirements: total,
      assessments,
      recommendations: this.generateComplianceRecommendations(assessments)
    };
  }

  private getComplianceRequirements(framework: string): any[] {
    const requirements: Record<string, any[]> = {
      'SOC2': [
        { id: 'CC6.1', name: 'Access Controls', category: 'security' },
        { id: 'CC6.2', name: 'Logical Access', category: 'security' },
        { id: 'CC6.3', name: 'Network Security', category: 'security' },
        { id: 'CC7.1', name: 'Data Management', category: 'availability' }
      ],
      'GDPR': [
        { id: 'Art.32', name: 'Security of Processing', category: 'security' },
        { id: 'Art.25', name: 'Data Protection by Design', category: 'privacy' },
        { id: 'Art.17', name: 'Right to Erasure', category: 'privacy' }
      ],
      'ISO27001': [
        { id: 'A.9.1', name: 'Access Control Policy', category: 'access_control' },
        { id: 'A.10.1', name: 'Cryptographic Controls', category: 'cryptography' },
        { id: 'A.12.6', name: 'Security Incident Management', category: 'incident_response' }
      ]
    };

    return requirements[framework] || [];
  }

  private async assessComplianceRequirement(requirement: any): Promise<any> {
    // This would perform actual compliance checks
    // For now, return a mock assessment
    return {
      requirementId: requirement.id,
      name: requirement.name,
      status: Math.random() > 0.2 ? 'compliant' : 'non_compliant', // 80% compliance rate
      score: Math.floor(Math.random() * 100),
      evidence: [],
      gaps: [],
      lastAssessed: new Date().toISOString()
    };
  }

  private generateComplianceRecommendations(assessments: any[]): string[] {
    const recommendations: string[] = [];

    const nonCompliant = assessments.filter(a => a.status === 'non_compliant');
    
    if (nonCompliant.length > 0) {
      recommendations.push(`Address ${nonCompliant.length} non-compliant requirements`);
    }

    return recommendations;
  }

  // ===== Helper Methods =====

  private async createSecurityAlert(rule: ThreatDetectionRule, events: any[]): Promise<SecurityAlert> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: SecurityAlert = {
      id: alertId,
      ruleId: rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      category: rule.category,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: events.map(e => e.id),
      metadata: {
        eventCount: events.length,
        timespan: events.length > 0 ? {
          start: events[events.length - 1].timestamp,
          end: events[0].timestamp
        } : undefined,
        affectedResources: [...new Set(events.map(e => e.resource))],
        uniqueUsers: [...new Set(events.map(e => e.userId).filter(Boolean))],
        uniqueIPs: [...new Set(events.map(e => e.ipAddress).filter(Boolean))]
      }
    };

    return alert;
  }

  private async processAlert(alert: SecurityAlert): Promise<void> {
    // Log the alert
    await auditService.logEvent({
      eventType: 'security.alert_generated',
      resource: 'security_monitoring',
      action: 'alert',
      outcome: 'success',
      details: {
        alertId: alert.id,
        severity: alert.severity,
        category: alert.category,
        ruleId: alert.ruleId
      },
      riskLevel: alert.severity === 'critical' ? 'critical' : 'high'
    });

    // Store alert (in production, save to database)
    console.log(`Security Alert Generated: ${alert.name} (${alert.severity})`);

    // Execute automated responses
    if (alert.severity === 'critical') {
      await this.executeEmergencyResponse(alert);
    }
  }

  private async executeEmergencyResponse(alert: SecurityAlert): Promise<void> {
    // Implement emergency response procedures
    console.log(`Executing emergency response for critical alert: ${alert.id}`);
    
    // Could include:
    // - Temporary user suspension
    // - IP blocking
    // - Service isolation
    // - Incident creation
    // - Notification to security team
  }

  private evaluateRule(rule: ThreatDetectionRule, event: any): boolean {
    // Simple rule evaluation - in production, use a proper rule engine
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, event)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(condition: any, event: any): boolean {
    // Basic condition evaluation logic
    const { field, operator, value } = condition;
    const eventValue = this.getEventFieldValue(event, field);

    switch (operator) {
      case 'equals':
        return eventValue === value;
      case 'contains':
        return typeof eventValue === 'string' && eventValue.includes(value);
      case 'greater_than':
        return Number(eventValue) > Number(value);
      case 'less_than':
        return Number(eventValue) < Number(value);
      case 'in':
        return Array.isArray(value) && value.includes(eventValue);
      default:
        return false;
    }
  }

  private getEventFieldValue(event: any, field: string): any {
    // Support nested field access like 'details.recordCount'
    return field.split('.').reduce((obj, key) => obj?.[key], event);
  }

  private initializeDefaultThresholds(): void {
    this.alertThresholds.set('failed_logins', 5);
    this.alertThresholds.set('authorization_denials', 10);
    this.alertThresholds.set('data_exports', 100);
    this.alertThresholds.set('privilege_changes', 1);
  }

  private initializeThreatRules(): void {
    this.threatRules = [
      {
        id: 'brute_force_attack',
        name: 'Brute Force Attack',
        description: 'Multiple failed authentication attempts',
        severity: 'high',
        category: 'authentication',
        threshold: 5,
        conditions: [
          { field: 'eventType', operator: 'equals', value: 'authentication.failed' }
        ],
        actions: ['alert', 'block_ip']
      },
      {
        id: 'privilege_escalation',
        name: 'Privilege Escalation Attempt',
        description: 'Multiple authorization denials in short time',
        severity: 'high',
        category: 'authorization',
        threshold: 10,
        conditions: [
          { field: 'eventType', operator: 'equals', value: 'authorization.denied' }
        ],
        actions: ['alert', 'investigate']
      },
      {
        id: 'data_exfiltration',
        name: 'Potential Data Exfiltration',
        description: 'Large volume of data access',
        severity: 'critical',
        category: 'data_loss_prevention',
        threshold: 1000,
        conditions: [
          { field: 'eventType', operator: 'in', value: ['data.export', 'data.access'] }
        ],
        actions: ['alert', 'suspend_user', 'investigate']
      }
    ];
  }
}

export const securityMonitoringService = new SecurityMonitoringService();
