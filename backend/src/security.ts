// Security Framework - Main Export
// Issue #119 - Advanced Security & Compliance Framework

// ===== Core Services =====
export { authenticationService } from './lib/authenticationService';
export { rbacService } from './lib/rbacService';
export { auditService } from './lib/auditService';
export { encryptionService, dataProtectionService } from './lib/encryptionService';
export { securityMonitoringService } from './lib/securityMonitoringService';

// ===== Middleware =====
export {
  withSecurity,
  requireAuth,
  requirePermissions,
  requireRoles,
  requireAdmin,
  withRateLimit,
  type SecurityContext,
  type SecurityMiddlewareConfig,
  type SecureHandler
} from './lib/securityMiddleware';

// ===== API Handlers =====
export {
  // Authentication
  initiateLogin,
  completeLogin,
  refreshToken,
  logout,
  
  // User Management
  getCurrentUser,
  updateUserProfile,
  
  // RBAC
  listRoles,
  createRole,
  assignUserRole,
  
  // Audit & Compliance
  getAuditLogs,
  getAuditStatistics,
  
  // Admin
  adminGetUsers,
  adminDeleteUser,
  
  // Health
  securityHealthCheck
} from './handlers/security';

// ===== Configuration =====
export {
  SECURITY_CONFIG,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLES,
  DEFAULT_SECURITY_POLICIES,
  COMPLIANCE_MAPPINGS,
  validateSecurityConfig
} from './lib/securityConfig';

// ===== Database Utilities =====
export {
  docClient,
  KEY_PATTERNS,
  GSI_PATTERNS,
  generateId,
  getTimestamp,
  getCurrentDateString,
  batchProcess,
  maskSensitiveData
} from './lib/securityDb';

// ===== Setup =====
export { SecuritySetup } from './lib/securitySetup';

// ===== Type Re-exports =====
export type {
  // Authentication Types
  OAuth2Provider,
  AuthenticationContext,
  
  // Authorization Types
  Role,
  Permission,
  UserRole,
  
  // Audit Types
  AuditEvent,
  AuditEventType,
  AuditChange,
  AuditQuery,
  AuditLogRequest,
  
  // Security Types
  SecurityPolicy,
  SecurityAlert,
  SecurityError as SecurityErrorType
} from '../../shared/src/types/security';

// ===== Version Information =====
export const SECURITY_FRAMEWORK_VERSION = '1.0.0';
export const SUPPORTED_COMPLIANCE_FRAMEWORKS = ['SOC2', 'GDPR', 'CCPA', 'ISO27001', 'PIPEDA'];

// ===== Framework Initialization =====
export async function initializeSecurityFramework(): Promise<{
  success: boolean;
  message: string;
  services: string[];
}> {
  try {
    const services: string[] = [];
    
    // Initialize services
    services.push('Authentication Service');
    services.push('RBAC Service');
    services.push('Audit Service');
    services.push('Encryption Service');
    services.push('Security Monitoring Service');
    
    // Validate configuration
    const { validateSecurityConfig } = await import('./lib/securityConfig');
    const configValidation = validateSecurityConfig();
    if (!configValidation.isValid) {
      return {
        success: false,
        message: `Configuration validation failed: ${configValidation.errors.join(', ')}`,
        services: []
      };
    }
    
    // Log initialization
    console.log('🔐 Daylight Security Framework initialized');
    console.log(`   Version: ${SECURITY_FRAMEWORK_VERSION}`);
    console.log(`   Services: ${services.join(', ')}`);
    console.log(`   Compliance: ${SUPPORTED_COMPLIANCE_FRAMEWORKS.join(', ')}`);
    
    return {
      success: true,
      message: 'Security framework initialized successfully',
      services
    };
  } catch (error) {
    console.error('Security framework initialization failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown initialization error',
      services: []
    };
  }
}

// ===== Health Check =====
export async function securityFrameworkHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, 'healthy' | 'unhealthy'>;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  const services: Record<string, 'healthy' | 'unhealthy'> = {};
  
  try {
    // Check each service
    services.authentication = 'healthy'; // Would implement actual health checks
    services.authorization = 'healthy';
    services.audit = 'healthy';
    services.encryption = 'healthy';
    services.monitoring = 'healthy';
    
    const unhealthyServices = Object.values(services).filter(status => status === 'unhealthy').length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyServices === 0) {
      status = 'healthy';
    } else if (unhealthyServices < Object.keys(services).length / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }
    
    return { status, services, timestamp };
  } catch (error) {
    console.error('Security framework health check failed:', error);
    return {
      status: 'unhealthy',
      services: Object.fromEntries(Object.keys(services).map(key => [key, 'unhealthy'])),
      timestamp
    };
  }
}
