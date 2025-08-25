# Advanced Security & Compliance Framework

## Issue #119 Implementation

This document outlines the comprehensive security and compliance framework implemented for the Daylight application, providing enterprise-grade security features including OAuth2 authentication, role-based access control (RBAC), audit logging, data encryption, and compliance monitoring.

## 🔐 Architecture Overview

### Core Components

1. **Authentication Service** - OAuth2/OIDC multi-provider authentication
2. **RBAC Service** - Role-based access control with permissions and policies
3. **Audit Service** - Comprehensive audit logging and compliance tracking
4. **Encryption Service** - Data encryption and protection utilities
5. **Security Monitoring** - Threat detection and incident management
6. **Security Middleware** - API protection and authorization

### Security Stack

```
┌─────────────────────────────────────────────────┐
│                Frontend Apps                    │
├─────────────────────────────────────────────────┤
│            Security Middleware                  │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ Rate Limit  │ │    Auth     │ │    RBAC    │ │
│  └─────────────┘ └─────────────┘ └────────────┘ │
├─────────────────────────────────────────────────┤
│                API Handlers                     │
├─────────────────────────────────────────────────┤
│              Core Services                      │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │    Auth     │ │    RBAC     │ │   Audit    │ │
│  │  Service    │ │   Service   │ │  Service   │ │
│  └─────────────┘ └─────────────┘ └────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ Encryption  │ │ Monitoring  │ │ Compliance │ │
│  │  Service    │ │   Service   │ │   Engine   │ │
│  └─────────────┘ └─────────────┘ └────────────┘ │
├─────────────────────────────────────────────────┤
│             Data Storage                        │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │  DynamoDB   │ │     KMS     │ │   S3/EBS   │ │
│  │ (Encrypted) │ │ (Key Mgmt)  │ │(Encrypted) │ │
│  └─────────────┘ └─────────────┘ └────────────┘ │
└─────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Required environment variables
export AWS_REGION=us-east-1
export NODE_ENV=production
export JWT_SECRET=your-super-secure-jwt-secret
export KMS_KEY_ID=alias/daylight-encryption-key

# OAuth2 Providers (optional)
export GOOGLE_CLIENT_ID=your-google-client-id
export GOOGLE_CLIENT_SECRET=your-google-client-secret
export GITHUB_CLIENT_ID=your-github-client-id
export GITHUB_CLIENT_SECRET=your-github-client-secret

# Database tables
export USERS_TABLE=daylight-users
export SESSIONS_TABLE=daylight-sessions
export ROLES_TABLE=daylight-roles
export AUDIT_LOGS_TABLE=daylight-audit-logs
```

### 2. Initialize Security Framework

```bash
# Run the setup script
node backend/src/lib/securitySetup.js setup
```

### 3. Basic Usage

```typescript
import { 
  authenticationService, 
  rbacService, 
  requireAuth, 
  requirePermissions 
} from './backend/src/security';

// Authenticate a user
const authResult = await authenticationService.completeOAuth2Flow(
  code, 
  redirectUri, 
  state, 
  codeVerifier
);

// Check permissions
const hasPermission = await rbacService.checkAccess(
  userId, 
  'data', 
  'read'
);

// Protect API endpoints
export const handler = requirePermissions(['data:read'], {
  auditEvent: { resource: 'trips', action: 'list' }
}, async (event, context, securityContext) => {
  // Your handler logic here
  return { statusCode: 200, body: JSON.stringify({ data: [] }) };
});
```

## 🔑 Authentication

### OAuth2 Flow

The framework supports PKCE-enhanced OAuth2 flows with multiple providers:

1. **Initiate Login**
   ```typescript
   const authUrl = await authenticationService.initiateOAuth2Flow(
     'google',
     'http://localhost:3000/callback',
     state,
     codeChallenge,
     'S256'
   );
   ```

2. **Complete Login**
   ```typescript
   const result = await authenticationService.completeOAuth2Flow(
     code,
     redirectUri,
     state,
     codeVerifier
   );
   ```

### Supported Providers

- **Google** - OpenID Connect
- **GitHub** - OAuth2
- **Microsoft** - Azure AD/OpenID Connect
- **Extensible** - Easy to add new providers

### Session Management

- JWT tokens with configurable expiration
- Refresh token rotation
- Session invalidation and cleanup
- Concurrent session limiting

## 🛡️ Authorization (RBAC)

### Permission System

```typescript
// Create permissions
await rbacService.createPermission({
  name: 'trips:create',
  description: 'Create new trips',
  category: 'trip_management'
});

// Create roles
await rbacService.createRole({
  name: 'trip_manager',
  displayName: 'Trip Manager',
  description: 'Manages trip data',
  permissions: ['trips:create', 'trips:read', 'trips:update']
});

// Assign role to user
await rbacService.assignUserRole(userId, roleId);
```

### Default Roles

- **user** - Basic read access
- **premium_user** - Extended data access
- **moderator** - Content management
- **admin** - Full system access
- **security_officer** - Security and compliance management

### Policy-Based Access Control

```typescript
// Check access with context
const authorized = await rbacService.checkAccess(
  userId,
  'sensitive_data',
  'export',
  { 
    ipAddress: '192.168.1.1',
    timeOfDay: 'business_hours',
    dataClassification: 'confidential'
  }
);
```

## 📊 Audit Logging

### Comprehensive Event Tracking

```typescript
// Log authentication events
await auditService.logAuthentication(
  'authentication.login',
  userId,
  { provider: 'google', sessionId },
  { ipAddress, userAgent }
);

// Log data access
await auditService.logDataAccess(
  'export',
  userId,
  'trips',
  recordId,
  changes,
  context
);

// Query audit logs
const { events } = await auditService.queryAuditEvents({
  userId,
  eventTypes: ['data.export'],
  dateFrom: '2024-01-01',
  dateTo: '2024-12-31',
  limit: 100
});
```

### Event Types

- **Authentication**: login, logout, failed attempts, MFA
- **Authorization**: granted, denied, privilege changes
- **Data Access**: create, read, update, delete, export
- **Security**: policy changes, incidents, alerts
- **Compliance**: data requests, deletion, retention

### Compliance Labeling

Events are automatically tagged for compliance frameworks:
- **SOC2** - Access controls, monitoring
- **GDPR** - Data processing, user rights
- **CCPA** - Data access, deletion
- **ISO27001** - Security management
- **PIPEDA** - Privacy protection

## 🔒 Data Encryption

### Field-Level Encryption

```typescript
// Encrypt sensitive data
const encrypted = await encryptionService.encryptField(
  sensitiveData,
  'confidential',
  { field: 'ssn', userId }
);

// Decrypt when needed
const decrypted = await encryptionService.decryptField(encrypted);
```

### Object Encryption

```typescript
// Encrypt multiple fields
const { encryptedObject, encryptionMetadata } = 
  await encryptionService.encryptObject(
    userData,
    {
      ssn: 'restricted',
      email: 'confidential',
      phone: 'internal'
    }
  );
```

### Data Classification

- **public** - No encryption required
- **internal** - Standard encryption
- **confidential** - Enhanced encryption + audit
- **restricted** - Maximum security + access review

## 🚨 Security Monitoring

### Threat Detection

```typescript
// Real-time threat detection
const alerts = await securityMonitoringService.processSecurityEvent(event);

// Detect brute force attacks
const alert = await securityMonitoringService.detectBruteForceAttack(
  ipAddress,
  300000 // 5-minute window
);

// Monitor for data exfiltration
const exfiltrationAlert = await securityMonitoringService.detectDataExfiltration(
  userId
);
```

### Built-in Detection Rules

- **Brute Force Attacks** - Multiple failed authentications
- **Privilege Escalation** - Excessive authorization denials
- **Data Exfiltration** - Unusual data access patterns
- **Suspicious Logins** - Multiple IPs, unusual times
- **Account Takeover** - Session anomalies

### Vulnerability Scanning

```typescript
// Perform security assessment
const report = await securityMonitoringService.performVulnerabilityAssessment();
```

## 📋 Compliance Reporting

### Framework Support

```typescript
// Generate compliance reports
const soc2Report = await securityMonitoringService.generateComplianceReport('SOC2');
const gdprReport = await securityMonitoringService.generateComplianceReport('GDPR');
```

### Supported Frameworks

- **SOC2 Type II** - Security, availability, confidentiality
- **GDPR** - EU data protection regulation
- **CCPA** - California consumer privacy
- **ISO27001** - Information security management
- **PIPEDA** - Canadian privacy protection

## 🛠️ Middleware Protection

### API Security

```typescript
// Require authentication
export const handler = requireAuth({
  rateLimit: { requests: 100, windowMs: 60000 },
  auditEvent: { resource: 'api', action: 'access' }
}, async (event, context, securityContext) => {
  // Protected handler logic
});

// Require specific permissions
export const adminHandler = requirePermissions(['admin:system'], {
  auditEvent: { resource: 'admin', action: 'access' }
}, async (event, context, securityContext) => {
  // Admin-only logic
});

// Custom security rules
export const customHandler = withSecurity({
  requireAuth: true,
  requiredRoles: ['premium_user'],
  rateLimit: { requests: 20, windowMs: 60000 }
}, async (event, context, securityContext) => {
  // Custom protected logic
});
```

### Security Headers

Automatic security headers on all responses:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security`
- `Content-Security-Policy`

## 📊 Database Schema

### Security Tables

1. **Users Table** (`daylight-users`)
   - User profiles and authentication data
   - Encrypted PII with field-level protection
   - GSI for email lookups

2. **Sessions Table** (`daylight-sessions`)
   - Active user sessions and tokens
   - Automatic TTL for cleanup
   - GSI for user session queries

3. **Roles Table** (`daylight-roles`)
   - Role and permission definitions
   - Hierarchical role inheritance
   - GSI for permission queries

4. **Audit Logs Table** (`daylight-audit-logs`)
   - Comprehensive event logging
   - Partitioned by date for performance
   - Multiple GSIs for querying patterns
   - Long-term retention for compliance

## 🔧 Configuration

### Security Configuration File

All security settings are centralized in `securityConfig.ts`:

```typescript
export const SECURITY_CONFIG = {
  TABLES: { /* DynamoDB table names */ },
  ENCRYPTION: { /* KMS and encryption settings */ },
  JWT: { /* Token configuration */ },
  OAUTH2: { /* Provider configurations */ },
  RATE_LIMITING: { /* API rate limits */ },
  MONITORING: { /* Alert and monitoring settings */ }
};
```

### Environment-Specific Settings

- **Development** - Relaxed settings, sample data
- **Staging** - Production-like with test data
- **Production** - Maximum security, compliance enabled

## 🧪 Testing

### Security Test Suite

```bash
# Run security tests
npm run test:security

# Test specific components
npm run test:auth
npm run test:rbac
npm run test:audit
npm run test:encryption
```

### Penetration Testing

The framework includes tools for security validation:
- Authentication bypass attempts
- Authorization escalation tests
- Session security validation
- Encryption strength verification

## 📈 Monitoring & Alerting

### Real-time Metrics

- Authentication success/failure rates
- Authorization denial patterns
- Data access volume and patterns
- Security alert frequency
- System performance metrics

### Alert Channels

- **Critical Alerts** - Immediate notifications
- **High Priority** - Near real-time alerts
- **Standard** - Batched notifications
- **Slack Integration** - Team notifications

## 🔄 Maintenance

### Regular Tasks

1. **Key Rotation** - Automated KMS key rotation
2. **Session Cleanup** - Remove expired sessions
3. **Audit Archival** - Long-term storage management
4. **Compliance Reporting** - Scheduled report generation
5. **Vulnerability Scanning** - Regular security assessments

### Backup & Recovery

- **Database Backups** - Point-in-time recovery enabled
- **Encryption Keys** - KMS-managed with automatic backup
- **Audit Logs** - Immutable storage with 7-year retention
- **Configuration** - Infrastructure as Code

## 🚀 Deployment

### Infrastructure Requirements

- **AWS DynamoDB** - Scalable NoSQL database
- **AWS KMS** - Key management and encryption
- **AWS Lambda** - Serverless compute platform
- **AWS API Gateway** - API management and routing

### CI/CD Integration

```yaml
# Security validation in pipeline
stages:
  - security-scan
  - dependency-check
  - compliance-validation
  - deployment
```

## 📚 API Reference

### Authentication Endpoints

- `POST /auth/login/initiate` - Start OAuth2 flow
- `POST /auth/login/complete` - Complete authentication
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - End user session

### RBAC Endpoints

- `GET /security/roles` - List available roles
- `POST /security/roles` - Create new role
- `POST /security/users/{id}/roles` - Assign user role
- `GET /security/permissions` - List permissions

### Audit Endpoints

- `GET /security/audit` - Query audit logs
- `GET /security/audit/stats` - Audit statistics
- `POST /security/compliance/report` - Generate compliance report

## 🤝 Contributing

### Security Guidelines

1. **Code Review** - All security code requires dual review
2. **Testing** - Comprehensive test coverage required
3. **Documentation** - Security features must be documented
4. **Compliance** - Changes must maintain compliance posture

### Reporting Issues

Security issues should be reported through secure channels:
- **Critical** - Direct contact with security team
- **Standard** - GitHub security advisories
- **General** - Regular issue tracking

## 📄 License

This security framework is part of the Daylight application and subject to the project's license terms.

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**Compliance**: SOC2, GDPR, CCPA, ISO27001, PIPEDA
