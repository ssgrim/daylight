// Security Configuration
// Issue #119 - Advanced Security & Compliance Framework

import { OAuth2Provider } from '../../../shared/src/types/security';

// ===== Environment Configuration =====

export const SECURITY_CONFIG = {
  // Environment
  ENVIRONMENT: process.env.NODE_ENV || 'development',
  
  // Database Tables
  TABLES: {
    USERS: process.env.USERS_TABLE || 'daylight-users',
    SESSIONS: process.env.SESSIONS_TABLE || 'daylight-sessions', 
    ROLES: process.env.ROLES_TABLE || 'daylight-roles',
    PERMISSIONS: process.env.PERMISSIONS_TABLE || 'daylight-permissions',
    AUDIT_LOGS: process.env.AUDIT_LOGS_TABLE || 'daylight-audit-logs',
    SECURITY_POLICIES: process.env.SECURITY_POLICIES_TABLE || 'daylight-security-policies'
  },

  // Encryption
  ENCRYPTION: {
    KMS_KEY_ID: process.env.KMS_KEY_ID || 'alias/daylight-encryption-key',
    ALGORITHM: 'aes-256-gcm',
    KEY_ROTATION_DAYS: 90,
    DATA_KEY_CACHE_TTL_MS: 60 * 60 * 1000 // 1 hour
  },

  // JWT Configuration
  JWT: {
    SECRET: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
    ALGORITHM: 'HS256' as const,
    ACCESS_TOKEN_TTL: 15 * 60, // 15 minutes
    REFRESH_TOKEN_TTL: 7 * 24 * 60 * 60, // 7 days
    ISSUER: 'daylight-api',
    AUDIENCE: 'daylight-app'
  },

  // Session Management
  SESSIONS: {
    TTL_SECONDS: 24 * 60 * 60, // 24 hours
    REFRESH_THRESHOLD_SECONDS: 4 * 60 * 60, // 4 hours
    MAX_CONCURRENT_SESSIONS: 5,
    SECURE_COOKIE: process.env.NODE_ENV === 'production',
    SAME_SITE: 'strict' as const
  },

  // OAuth2 Configuration
  OAUTH2: {
    PROVIDERS: {
      GOOGLE: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
        REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
        SCOPES: ['openid', 'profile', 'email'],
        AUTHORIZATION_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
        TOKEN_URL: 'https://oauth2.googleapis.com/token',
        USER_INFO_URL: 'https://www.googleapis.com/oauth2/v2/userinfo'
      },
      GITHUB: {
        CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
        CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
        REDIRECT_URI: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/github/callback',
        SCOPES: ['user:email'],
        AUTHORIZATION_URL: 'https://github.com/login/oauth/authorize',
        TOKEN_URL: 'https://github.com/login/oauth/access_token',
        USER_INFO_URL: 'https://api.github.com/user'
      },
      MICROSOFT: {
        CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || '',
        CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || '',
        REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/auth/microsoft/callback',
        SCOPES: ['openid', 'profile', 'email'],
        AUTHORIZATION_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        TOKEN_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        USER_INFO_URL: 'https://graph.microsoft.com/v1.0/me'
      }
    },
    STATE_TTL_SECONDS: 10 * 60, // 10 minutes
    CODE_CHALLENGE_LENGTH: 128,
    PKCE_ENABLED: true
  },

  // Rate Limiting
  RATE_LIMITING: {
    AUTHENTICATION: {
      REQUESTS: 10,
      WINDOW_MS: 60 * 1000, // 1 minute
      BLOCK_DURATION_MS: 15 * 60 * 1000 // 15 minutes
    },
    API_GENERAL: {
      REQUESTS: 100,
      WINDOW_MS: 60 * 1000 // 1 minute
    },
    API_SENSITIVE: {
      REQUESTS: 20,
      WINDOW_MS: 60 * 1000 // 1 minute
    }
  },

  // Audit & Compliance
  AUDIT_RETENTION_DAYS: 2555, // ~7 years for compliance
  COMPLIANCE_FRAMEWORKS: ['SOC2', 'GDPR', 'CCPA', 'ISO27001', 'PIPEDA'],
  
  // Security Monitoring
  MONITORING: {
    THREAT_DETECTION_ENABLED: true,
    REAL_TIME_ALERTS: true,
    VULNERABILITY_SCAN_INTERVAL_HOURS: 24,
    COMPLIANCE_REPORT_INTERVAL_HOURS: 168, // Weekly
    ALERT_WEBHOOKS: {
      CRITICAL: process.env.CRITICAL_ALERT_WEBHOOK || '',
      HIGH: process.env.HIGH_ALERT_WEBHOOK || '',
      SLACK: process.env.SLACK_WEBHOOK || ''
    }
  },

  // Data Classification
  DATA_CLASSIFICATION: {
    PUBLIC: {
      encryption: false,
      auditLevel: 'minimal'
    },
    INTERNAL: {
      encryption: true,
      auditLevel: 'standard'
    },
    CONFIDENTIAL: {
      encryption: true,
      auditLevel: 'detailed'
    },
    RESTRICTED: {
      encryption: true,
      auditLevel: 'comprehensive',
      accessReview: true
    }
  },

  // Security Headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  }
};

// ===== Default Roles & Permissions =====

export const DEFAULT_PERMISSIONS = [
  // User Management
  { name: 'users:read', description: 'View user information', category: 'user_management' },
  { name: 'users:update', description: 'Update user profiles', category: 'user_management' },
  { name: 'users:delete', description: 'Delete users', category: 'user_management' },
  { name: 'users:manage_roles', description: 'Assign roles to users', category: 'user_management' },

  // Role Management
  { name: 'roles:read', description: 'View roles and permissions', category: 'access_control' },
  { name: 'roles:create', description: 'Create new roles', category: 'access_control' },
  { name: 'roles:update', description: 'Modify existing roles', category: 'access_control' },
  { name: 'roles:delete', description: 'Delete roles', category: 'access_control' },

  // Data Access
  { name: 'data:read', description: 'Read application data', category: 'data_access' },
  { name: 'data:create', description: 'Create new data', category: 'data_access' },
  { name: 'data:update', description: 'Update existing data', category: 'data_access' },
  { name: 'data:delete', description: 'Delete data', category: 'data_access' },
  { name: 'data:export', description: 'Export data', category: 'data_access' },

  // Audit & Compliance
  { name: 'audit:read', description: 'View audit logs', category: 'audit' },
  { name: 'audit:export', description: 'Export audit logs', category: 'audit' },
  { name: 'compliance:read', description: 'View compliance reports', category: 'compliance' },
  { name: 'compliance:manage', description: 'Manage compliance settings', category: 'compliance' },

  // Security Management
  { name: 'security:read', description: 'View security settings', category: 'security' },
  { name: 'security:manage', description: 'Manage security configurations', category: 'security' },
  { name: 'security:alerts', description: 'View and manage security alerts', category: 'security' },
  { name: 'security:incidents', description: 'Manage security incidents', category: 'security' },

  // System Administration
  { name: 'admin:system', description: 'System administration', category: 'administration' },
  { name: 'admin:config', description: 'Manage system configuration', category: 'administration' },
  { name: 'admin:monitoring', description: 'Access monitoring dashboards', category: 'administration' }
];

export const DEFAULT_ROLES = [
  {
    name: 'user',
    displayName: 'Standard User',
    description: 'Default user role with basic access',
    permissions: [
      'data:read',
      'users:read'
    ],
    isSystemRole: true
  },
  {
    name: 'premium_user',
    displayName: 'Premium User',
    description: 'Premium user with extended access',
    permissions: [
      'data:read',
      'data:create',
      'data:update',
      'data:export',
      'users:read',
      'users:update'
    ],
    isSystemRole: true
  },
  {
    name: 'moderator',
    displayName: 'Moderator',
    description: 'Content moderation role',
    permissions: [
      'data:read',
      'data:create',
      'data:update',
      'data:delete',
      'users:read',
      'users:update',
      'audit:read'
    ],
    isSystemRole: true
  },
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full administrative access',
    permissions: [
      'users:read',
      'users:update',
      'users:delete',
      'users:manage_roles',
      'roles:read',
      'roles:create',
      'roles:update',
      'roles:delete',
      'data:read',
      'data:create',
      'data:update',
      'data:delete',
      'data:export',
      'audit:read',
      'audit:export',
      'compliance:read',
      'compliance:manage',
      'security:read',
      'security:manage',
      'security:alerts',
      'security:incidents',
      'admin:system',
      'admin:config',
      'admin:monitoring'
    ],
    isSystemRole: true
  },
  {
    name: 'security_officer',
    displayName: 'Security Officer',
    description: 'Security and compliance management',
    permissions: [
      'users:read',
      'roles:read',
      'audit:read',
      'audit:export',
      'compliance:read',
      'compliance:manage',
      'security:read',
      'security:manage',
      'security:alerts',
      'security:incidents'
    ],
    isSystemRole: true
  }
];

// ===== Security Policies =====

export const DEFAULT_SECURITY_POLICIES = [
  {
    name: 'password_policy',
    displayName: 'Password Policy',
    description: 'Password strength and rotation requirements',
    category: 'authentication',
    rules: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventCommonPasswords: true,
      preventUserInfo: true,
      maxAge: 90, // days
      historyCount: 12
    },
    enabled: true
  },
  {
    name: 'session_policy',
    displayName: 'Session Management Policy',
    description: 'Session timeout and management rules',
    category: 'session_management',
    rules: {
      maxDuration: 24 * 60 * 60, // 24 hours
      idleTimeout: 2 * 60 * 60, // 2 hours
      maxConcurrentSessions: 5,
      requireReauthForSensitive: true,
      logoutOnSuspiciousActivity: true
    },
    enabled: true
  },
  {
    name: 'data_access_policy',
    displayName: 'Data Access Policy',
    description: 'Data access and classification rules',
    category: 'data_protection',
    rules: {
      requireJustification: ['confidential', 'restricted'],
      logAllAccess: true,
      encryptInTransit: true,
      encryptAtRest: ['confidential', 'restricted'],
      maxExportSize: 10000, // records
      requireApprovalForExport: ['confidential', 'restricted']
    },
    enabled: true
  },
  {
    name: 'mfa_policy',
    displayName: 'Multi-Factor Authentication Policy',
    description: 'MFA requirements and enforcement',
    category: 'authentication',
    rules: {
      requireForRoles: ['admin', 'security_officer'],
      requireForSensitiveData: true,
      allowedMethods: ['totp', 'sms', 'email'],
      backupCodes: true,
      rememberDevice: 30 // days
    },
    enabled: true
  }
];

// ===== Compliance Mappings =====

export const COMPLIANCE_MAPPINGS = {
  SOC2: {
    'CC6.1': ['authentication', 'authorization', 'access_control'],
    'CC6.2': ['user_management', 'privileged_access'],
    'CC6.3': ['network_security', 'encryption'],
    'CC6.7': ['data_transmission', 'encryption'],
    'CC6.8': ['data_disposal', 'data_lifecycle'],
    'CC7.1': ['monitoring', 'logging'],
    'CC7.2': ['incident_response', 'security_monitoring']
  },
  GDPR: {
    'Art.25': ['privacy_by_design', 'data_minimization'],
    'Art.32': ['security_measures', 'encryption', 'access_control'],
    'Art.17': ['data_deletion', 'right_to_erasure'],
    'Art.20': ['data_portability', 'data_export'],
    'Art.33': ['breach_notification', 'incident_response'],
    'Art.35': ['privacy_impact_assessment', 'risk_assessment']
  },
  ISO27001: {
    'A.9.1': ['access_control_policy', 'user_management'],
    'A.9.2': ['user_access_management', 'privileged_access'],
    'A.10.1': ['cryptographic_controls', 'encryption'],
    'A.12.6': ['security_incident_management', 'incident_response'],
    'A.14.1': ['secure_development', 'security_requirements'],
    'A.18.1': ['compliance', 'legal_requirements']
  }
};

// ===== Export Configuration Validator =====

export function validateSecurityConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  if (!process.env.JWT_SECRET && SECURITY_CONFIG.ENVIRONMENT === 'production') {
    errors.push('JWT_SECRET must be set in production');
  }

  if (!process.env.KMS_KEY_ID && SECURITY_CONFIG.ENVIRONMENT === 'production') {
    warnings.push('KMS_KEY_ID should be set for production encryption');
  }

  // Check OAuth2 configuration
  const providers = Object.entries(SECURITY_CONFIG.OAUTH2.PROVIDERS);
  for (const [name, config] of providers) {
    if (!config.CLIENT_ID || !config.CLIENT_SECRET) {
      warnings.push(`OAuth2 provider ${name} is not fully configured`);
    }
  }

  // Check webhook URLs for monitoring
  if (SECURITY_CONFIG.MONITORING.REAL_TIME_ALERTS) {
    if (!SECURITY_CONFIG.MONITORING.ALERT_WEBHOOKS.CRITICAL) {
      warnings.push('Critical alert webhook not configured');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Run validation on import in development
if (SECURITY_CONFIG.ENVIRONMENT === 'development') {
  const validation = validateSecurityConfig();
  if (validation.warnings.length > 0) {
    console.warn('Security configuration warnings:', validation.warnings);
  }
  if (validation.errors.length > 0) {
    console.error('Security configuration errors:', validation.errors);
  }
}
