// Advanced Security & Compliance Framework Types
// Issue #119 - OAuth2, RBAC, Audit Logging, Encryption, Compliance

// ===== Authentication & OAuth2 =====

export interface OAuth2Provider {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc' | 'saml';
  clientId: string;
  clientSecret?: string; // Server-side only
  discoveryUrl?: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  scopes: string[];
  enabled: boolean;
  configuration: Record<string, any>;
}

export interface OAuth2Token {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: 'Bearer' | 'Basic';
  expiresIn: number;
  expiresAt: number;
  scope: string[];
  issuer: string;
  audience: string;
}

export interface AuthenticationContext {
  userId: string;
  sessionId: string;
  provider: string;
  providerUserId: string;
  authenticatedAt: number;
  expiresAt: number;
  tokenData: OAuth2Token;
  mfaVerified: boolean;
  deviceFingerprint?: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, any>;
}

// ===== Role-Based Access Control (RBAC) =====

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  inheritedRoles?: string[];
  scope: 'global' | 'organization' | 'project';
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: string;
  expiresAt?: string;
  scope?: string; // organization ID, project ID, etc.
  conditions?: Record<string, any>;
}

export interface AccessContext {
  userId: string;
  roles: Role[];
  permissions: Permission[];
  organizationId?: string;
  projectId?: string;
  resourceContext?: Record<string, any>;
}

// ===== Authorization Checks =====

export interface AuthorizationRequest {
  userId: string;
  resource: string;
  action: string;
  context?: Record<string, any>;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: Permission[];
  appliedPolicies?: string[];
  denyReasons?: string[];
}

// ===== Audit Logging =====

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  userId?: string;
  sessionId?: string;
  resource: string;
  action: string;
  outcome: 'success' | 'failure' | 'partial';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Context Information
  ipAddress?: string;
  userAgent?: string;
  geolocation?: {
    country: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  
  // Event Details
  details: Record<string, any>;
  changes?: AuditChange[];
  
  // Compliance
  complianceLabels?: string[];
  retentionPolicy?: string;
  
  // Metadata
  source: string;
  version: string;
  correlationId?: string;
  traceId?: string;
}

export type AuditEventType = 
  | 'authentication.login'
  | 'authentication.logout'
  | 'authentication.failed'
  | 'authentication.mfa'
  | 'authorization.granted'
  | 'authorization.denied'
  | 'data.access'
  | 'data.create'
  | 'data.update'
  | 'data.delete'
  | 'data.export'
  | 'security.permission_change'
  | 'security.role_change'
  | 'security.policy_change'
  | 'security.breach_attempt'
  | 'compliance.data_request'
  | 'compliance.data_deletion'
  | 'system.configuration_change'
  | 'system.maintenance'
  | 'admin.user_management'
  | 'admin.system_access';

export interface AuditChange {
  field: string;
  oldValue?: any;
  newValue?: any;
  changeType: 'create' | 'update' | 'delete';
}

export interface AuditQuery {
  userId?: string;
  eventTypes?: AuditEventType[];
  dateFrom?: string;
  dateTo?: string;
  resource?: string;
  action?: string;
  outcome?: 'success' | 'failure' | 'partial';
  riskLevel?: string[];
  ipAddress?: string;
  complianceLabels?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'riskLevel' | 'eventType';
  sortOrder?: 'asc' | 'desc';
}

// ===== Data Encryption =====

export interface EncryptionKey {
  keyId: string;
  algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305' | 'RSA-OAEP' | 'ECDSA';
  keyType: 'symmetric' | 'asymmetric';
  purpose: 'data-encryption' | 'key-encryption' | 'signing' | 'authentication';
  status: 'active' | 'rotating' | 'retired' | 'compromised';
  createdAt: string;
  expiresAt?: string;
  rotationSchedule?: string;
  metadata: Record<string, any>;
}

export interface EncryptionContext {
  keyId: string;
  algorithm: string;
  encryptionContext?: Record<string, string>;
  additionalAuthenticatedData?: string;
}

export interface EncryptedData {
  ciphertext: string;
  encryptionContext: EncryptionContext;
  iv?: string;
  authTag?: string;
  version: string;
}

// ===== Security Policies =====

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  type: 'access' | 'data' | 'network' | 'compliance';
  rules: SecurityRule[];
  enforcement: 'permissive' | 'strict' | 'audit-only';
  priority: number;
  enabled: boolean;
  appliesTo: PolicyScope;
  createdAt: string;
  updatedAt: string;
  version: string;
}

export interface SecurityRule {
  id: string;
  condition: string; // JSON Logic or similar
  action: 'allow' | 'deny' | 'log' | 'alert' | 'require-approval';
  parameters?: Record<string, any>;
  description: string;
}

export interface PolicyScope {
  users?: string[];
  roles?: string[];
  resources?: string[];
  organizations?: string[];
  projects?: string[];
  conditions?: Record<string, any>;
}

// ===== Compliance Framework =====

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  type: 'SOC2' | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'ISO27001' | 'CCPA' | 'PIPEDA';
  requirements: ComplianceRequirement[];
  enabled: boolean;
  configuration: Record<string, any>;
}

export interface ComplianceRequirement {
  id: string;
  framework: string;
  section: string;
  title: string;
  description: string;
  category: 'access-control' | 'data-protection' | 'audit' | 'incident-response' | 'governance';
  priority: 'critical' | 'high' | 'medium' | 'low';
  controls: ComplianceControl[];
  status: 'compliant' | 'non-compliant' | 'partial' | 'not-assessed';
  lastAssessed?: string;
  evidence?: string[];
}

export interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  implementationType: 'technical' | 'administrative' | 'physical';
  automationLevel: 'fully-automated' | 'semi-automated' | 'manual';
  testFrequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  responsible: string;
  status: 'implemented' | 'in-progress' | 'planned' | 'not-implemented';
  lastTested?: string;
  nextTest?: string;
  evidence?: ComplianceEvidence[];
}

export interface ComplianceEvidence {
  id: string;
  type: 'document' | 'screenshot' | 'log' | 'report' | 'certificate';
  title: string;
  description?: string;
  url?: string;
  content?: string;
  createdAt: string;
  expiresAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

// ===== Security Monitoring =====

export interface SecurityAlert {
  id: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'authentication' | 'authorization' | 'data-access' | 'policy-violation' | 'anomaly' | 'compliance';
  title: string;
  description: string;
  source: string;
  affected: {
    users?: string[];
    resources?: string[];
    systems?: string[];
  };
  indicators: SecurityIndicator[];
  status: 'open' | 'investigating' | 'resolved' | 'false-positive';
  assignedTo?: string;
  resolution?: string;
  resolvedAt?: string;
  metadata: Record<string, any>;
}

export interface SecurityIndicator {
  type: 'suspicious-login' | 'privilege-escalation' | 'data-exfiltration' | 'policy-violation' | 'anomalous-behavior';
  confidence: number; // 0-100
  risk_score: number; // 0-100
  evidence: Record<string, any>;
  mitre_tactics?: string[];
  mitre_techniques?: string[];
}

// ===== API Request/Response Types =====

export interface AuthenticateRequest {
  provider: string;
  authorizationCode?: string;
  redirectUri?: string;
  state?: string;
  codeVerifier?: string; // PKCE
  clientAssertion?: string; // Client credentials
  additionalParams?: Record<string, any>;
}

export interface AuthenticateResponse {
  success: boolean;
  context?: AuthenticationContext;
  requiresMFA?: boolean;
  mfaChallenge?: {
    type: 'totp' | 'sms' | 'email' | 'push';
    challengeId: string;
    maskedDestination?: string;
  };
  error?: string;
}

export interface AuthorizeRequest {
  resource: string;
  action: string;
  context?: Record<string, any>;
}

export interface AuthorizeResponse {
  authorized: boolean;
  result: AuthorizationResult;
}

export interface CreateRoleRequest {
  name: string;
  description: string;
  permissions: string[];
  inheritedRoles?: string[];
  scope?: 'global' | 'organization' | 'project';
  metadata?: Record<string, any>;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: string[];
  inheritedRoles?: string[];
  metadata?: Record<string, any>;
}

export interface AssignRoleRequest {
  userId: string;
  roleId: string;
  scope?: string;
  expiresAt?: string;
  conditions?: Record<string, any>;
}

export interface AuditLogRequest {
  eventType: AuditEventType;
  resource: string;
  action: string;
  outcome: 'success' | 'failure' | 'partial';
  details: Record<string, any>;
  changes?: AuditChange[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  complianceLabels?: string[];
}

export interface ComplianceReportRequest {
  framework: string;
  dateFrom?: string;
  dateTo?: string;
  includeEvidence?: boolean;
  format?: 'json' | 'pdf' | 'csv';
}

export interface ComplianceReportResponse {
  framework: ComplianceFramework;
  generatedAt: string;
  period: {
    from: string;
    to: string;
  };
  summary: {
    totalRequirements: number;
    compliant: number;
    nonCompliant: number;
    partial: number;
    notAssessed: number;
    complianceScore: number; // 0-100
  };
  requirements: ComplianceRequirement[];
  recommendations?: string[];
  reportUrl?: string;
}

// ===== Error Types =====

export interface SecurityError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
  userId?: string;
  resource?: string;
  action?: string;
}
