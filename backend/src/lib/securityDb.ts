import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Security & Compliance Database Schema for DynamoDB
// Issue #119 - Advanced Security Framework

export const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.NODE_ENV === 'development' && {
    endpoint: 'http://localhost:8000'
  })
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ===== Table Configurations =====

export const SECURITY_TABLES = {
  // Authentication & Sessions
  AUTH_SESSIONS: process.env.AUTH_SESSIONS_TABLE || 'daylight-auth-sessions',
  OAUTH_PROVIDERS: process.env.OAUTH_PROVIDERS_TABLE || 'daylight-oauth-providers',
  
  // RBAC
  ROLES: process.env.ROLES_TABLE || 'daylight-roles',
  PERMISSIONS: process.env.PERMISSIONS_TABLE || 'daylight-permissions',
  USER_ROLES: process.env.USER_ROLES_TABLE || 'daylight-user-roles',
  
  // Audit & Compliance
  AUDIT_LOGS: process.env.AUDIT_LOGS_TABLE || 'daylight-audit-logs',
  SECURITY_POLICIES: process.env.SECURITY_POLICIES_TABLE || 'daylight-security-policies',
  COMPLIANCE_RECORDS: process.env.COMPLIANCE_RECORDS_TABLE || 'daylight-compliance-records',
  
  // Security Monitoring
  SECURITY_ALERTS: process.env.SECURITY_ALERTS_TABLE || 'daylight-security-alerts',
  ENCRYPTION_KEYS: process.env.ENCRYPTION_KEYS_TABLE || 'daylight-encryption-keys'
};

// ===== Key Patterns =====

export const KEY_PATTERNS = {
  // Authentication Sessions: PK = session#{sessionId}, SK = user#{userId}
  authSession: (sessionId: string, userId: string) => ({
    PK: `session#${sessionId}`,
    SK: `user#${userId}`
  }),
  
  // OAuth Providers: PK = provider#{providerId}, SK = config
  oauthProvider: (providerId: string) => ({
    PK: `provider#${providerId}`,
    SK: 'config'
  }),
  
  // Roles: PK = role#{roleId}, SK = definition
  role: (roleId: string) => ({
    PK: `role#${roleId}`,
    SK: 'definition'
  }),
  
  // Role Permissions: PK = role#{roleId}, SK = permission#{permissionId}
  rolePermission: (roleId: string, permissionId: string) => ({
    PK: `role#${roleId}`,
    SK: `permission#${permissionId}`
  }),
  
  // User Roles: PK = user#{userId}, SK = role#{roleId}#{scope?}
  userRole: (userId: string, roleId: string, scope?: string) => ({
    PK: `user#${userId}`,
    SK: scope ? `role#${roleId}#scope#${scope}` : `role#${roleId}`
  }),
  
  // Audit Logs: PK = date#{YYYY-MM-DD}, SK = timestamp#{timestamp}#{eventId}
  auditLog: (date: string, timestamp: number, eventId: string) => ({
    PK: `audit#${date}`,
    SK: `timestamp#${timestamp}#${eventId}`
  }),
  
  // Audit by User: PK = audit_user#{userId}, SK = timestamp#{timestamp}#{eventId}
  auditByUser: (userId: string, timestamp: number, eventId: string) => ({
    PK: `audit_user#${userId}`,
    SK: `timestamp#${timestamp}#${eventId}`
  }),
  
  // Audit by Resource: PK = audit_resource#{resource}, SK = timestamp#{timestamp}#{eventId}
  auditByResource: (resource: string, timestamp: number, eventId: string) => ({
    PK: `audit_resource#${resource}`,
    SK: `timestamp#${timestamp}#${eventId}`
  }),
  
  // Security Policies: PK = policy#{policyId}, SK = definition
  securityPolicy: (policyId: string) => ({
    PK: `policy#${policyId}`,
    SK: 'definition'
  }),
  
  // Compliance Records: PK = compliance#{framework}, SK = requirement#{requirementId}
  complianceRecord: (framework: string, requirementId: string) => ({
    PK: `compliance#${framework}`,
    SK: `requirement#${requirementId}`
  }),
  
  // Security Alerts: PK = alert#{date}, SK = timestamp#{timestamp}#{alertId}
  securityAlert: (date: string, timestamp: number, alertId: string) => ({
    PK: `alert#${date}`,
    SK: `timestamp#${timestamp}#${alertId}`
  }),
  
  // Encryption Keys: PK = key#{keyId}, SK = metadata
  encryptionKey: (keyId: string) => ({
    PK: `key#${keyId}`,
    SK: 'metadata'
  })
};

// ===== Global Secondary Indexes =====

export const GSI_PATTERNS = {
  // GSI1: For querying by type and status
  // PK = type#{entityType}, SK = status#{status}#{timestamp}
  byTypeAndStatus: (entityType: string, status: string, timestamp?: number) => ({
    GSI1PK: `type#${entityType}`,
    GSI1SK: timestamp ? `status#${status}#${timestamp}` : `status#${status}`
  }),
  
  // GSI2: For compliance and audit queries
  // PK = compliance#{framework}, SK = status#{status}#{timestamp}
  byComplianceFramework: (framework: string, status: string, timestamp?: number) => ({
    GSI2PK: `compliance#${framework}`,
    GSI2SK: timestamp ? `status#${status}#${timestamp}` : `status#${status}`
  }),
  
  // GSI3: For security monitoring
  // PK = security#{category}, SK = severity#{severity}#{timestamp}
  bySecurityCategory: (category: string, severity: string, timestamp?: number) => ({
    GSI3PK: `security#${category}`,
    GSI3SK: timestamp ? `severity#${severity}#${timestamp}` : `severity#${severity}`
  })
};

// ===== Helper Functions =====

export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const getCurrentDateString = () => {
  return new Date().toISOString().split('T')[0];
};

export const getTimestamp = () => {
  return Date.now();
};

export const createTTL = (daysFromNow: number) => {
  return Math.floor((Date.now() + (daysFromNow * 24 * 60 * 60 * 1000)) / 1000);
};

// ===== Database Operations Utilities =====

export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = backoffMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

export const batchProcess = async <T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize: number = 25
): Promise<R[]> => {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }
  
  return results;
};

// ===== Security Utilities =====

export const maskSensitiveData = (data: any, sensitiveFields: string[] = []): any => {
  const defaultSensitiveFields = [
    'password', 'token', 'secret', 'key', 'credential',
    'ssn', 'creditCard', 'bankAccount', 'email', 'phone'
  ];
  
  const fieldsToMask = [...defaultSensitiveFields, ...sensitiveFields];
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, sensitiveFields));
  }
  
  const masked = { ...data };
  
  for (const [key, value] of Object.entries(masked)) {
    const shouldMask = fieldsToMask.some(field => 
      key.toLowerCase().includes(field.toLowerCase())
    );
    
    if (shouldMask && typeof value === 'string') {
      masked[key] = value.length > 4 
        ? `${value.substring(0, 2)}${'*'.repeat(value.length - 4)}${value.substring(value.length - 2)}`
        : '****';
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value, sensitiveFields);
    }
  }
  
  return masked;
};

export const validateDataIntegrity = (data: any): boolean => {
  // Basic data integrity checks
  if (!data) return false;
  
  // Check for required security fields
  const requiredFields = ['timestamp', 'version'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return false;
    }
  }
  
  // Validate timestamp is recent (within 24 hours for audit logs)
  const timestamp = new Date(data.timestamp).getTime();
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  if (now - timestamp > maxAge) {
    return false;
  }
  
  return true;
};

// ===== Export Configuration =====

export const SECURITY_CONFIG = {
  TABLES: SECURITY_TABLES,
  KEY_PATTERNS,
  GSI_PATTERNS,
  
  // Security settings
  SESSION_TTL_HOURS: 24,
  AUDIT_RETENTION_DAYS: 2555, // 7 years for compliance
  MAX_LOGIN_ATTEMPTS: 5,
  PASSWORD_MIN_LENGTH: 12,
  TOKEN_REFRESH_THRESHOLD: 300, // 5 minutes before expiry
  
  // Encryption settings
  DEFAULT_ENCRYPTION_ALGORITHM: 'AES-256-GCM',
  KEY_ROTATION_DAYS: 90,
  
  // Compliance settings
  COMPLIANCE_FRAMEWORKS: ['SOC2', 'GDPR', 'CCPA', 'ISO27001'],
  AUDIT_LOG_BATCH_SIZE: 100,
  ALERT_RETENTION_DAYS: 365
} as const;
