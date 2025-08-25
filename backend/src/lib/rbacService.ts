import {
  Role,
  Permission,
  UserRole,
  AccessContext,
  AuthorizationRequest,
  AuthorizationResult,
  CreateRoleRequest,
  UpdateRoleRequest,
  AssignRoleRequest,
  AuthorizeRequest,
  AuthorizeResponse
} from '../../../shared/src/types/security';
import {
  docClient,
  SECURITY_CONFIG,
  KEY_PATTERNS,
  GSI_PATTERNS,
  generateId,
  getTimestamp,
  batchProcess
} from './securityDb';
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchGetCommand
} from '@aws-sdk/lib-dynamodb';

// Role-Based Access Control (RBAC) Service
// Issue #119 - Advanced Security Framework

export class RBACService {
  private permissionCache: Map<string, Permission> = new Map();
  private roleCache: Map<string, Role> = new Map();
  private userRoleCache: Map<string, UserRole[]> = new Map();

  constructor() {
    this.loadBuiltInPermissions();
    this.loadBuiltInRoles();
  }

  // ===== Permission Management =====

  async createPermission(permission: Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>): Promise<Permission> {
    const id = generateId();
    const fullPermission: Permission = {
      id,
      ...permission,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({
      TableName: SECURITY_CONFIG.TABLES.PERMISSIONS,
      Item: {
        PK: `permission#${id}`,
        SK: 'definition',
        ...fullPermission,
        ...GSI_PATTERNS.byTypeAndStatus('permission', 'active', getTimestamp())
      }
    }));

    this.permissionCache.set(id, fullPermission);
    return fullPermission;
  }

  async getPermission(permissionId: string): Promise<Permission | null> {
    if (this.permissionCache.has(permissionId)) {
      return this.permissionCache.get(permissionId)!;
    }

    const result = await docClient.send(new GetCommand({
      TableName: SECURITY_CONFIG.TABLES.PERMISSIONS,
      Key: {
        PK: `permission#${permissionId}`,
        SK: 'definition'
      }
    }));

    if (!result.Item) {
      return null;
    }

    const permission = result.Item as Permission;
    this.permissionCache.set(permissionId, permission);
    return permission;
  }

  async listPermissions(): Promise<Permission[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: SECURITY_CONFIG.TABLES.PERMISSIONS,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'type#permission'
      }
    }));

    return (result.Items || []) as Permission[];
  }

  // ===== Role Management =====

  async createRole(request: CreateRoleRequest): Promise<Role> {
    const id = generateId();
    
    // Validate permissions exist
    const permissions = await this.getPermissionsByIds(request.permissions);
    if (permissions.length !== request.permissions.length) {
      throw new Error('One or more permissions not found');
    }

    const role: Role = {
      id,
      name: request.name,
      description: request.description,
      permissions,
      inheritedRoles: request.inheritedRoles || [],
      scope: request.scope || 'global',
      metadata: request.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store role definition
    await docClient.send(new PutCommand({
      TableName: SECURITY_CONFIG.TABLES.ROLES,
      Item: {
        ...KEY_PATTERNS.role(id),
        ...role,
        ...GSI_PATTERNS.byTypeAndStatus('role', 'active', getTimestamp())
      }
    }));

    // Store role-permission mappings
    await this.storeRolePermissions(id, permissions);

    this.roleCache.set(id, role);
    return role;
  }

  async updateRole(roleId: string, request: UpdateRoleRequest): Promise<Role> {
    const existingRole = await this.getRole(roleId);
    if (!existingRole) {
      throw new Error('Role not found');
    }

    let permissions = existingRole.permissions;
    if (request.permissions) {
      permissions = await this.getPermissionsByIds(request.permissions);
      if (permissions.length !== request.permissions.length) {
        throw new Error('One or more permissions not found');
      }
    }

    const updatedRole: Role = {
      ...existingRole,
      name: request.name || existingRole.name,
      description: request.description || existingRole.description,
      permissions,
      inheritedRoles: request.inheritedRoles || existingRole.inheritedRoles,
      metadata: { ...existingRole.metadata, ...request.metadata },
      updatedAt: new Date().toISOString()
    };

    // Update role definition
    await docClient.send(new UpdateCommand({
      TableName: SECURITY_CONFIG.TABLES.ROLES,
      Key: KEY_PATTERNS.role(roleId),
      UpdateExpression: 'SET #name = :name, description = :desc, permissions = :perms, inheritedRoles = :inherited, metadata = :meta, updatedAt = :updated',
      ExpressionAttributeNames: {
        '#name': 'name'
      },
      ExpressionAttributeValues: {
        ':name': updatedRole.name,
        ':desc': updatedRole.description,
        ':perms': updatedRole.permissions,
        ':inherited': updatedRole.inheritedRoles,
        ':meta': updatedRole.metadata,
        ':updated': updatedRole.updatedAt
      }
    }));

    // Update role-permission mappings if permissions changed
    if (request.permissions) {
      await this.deleteRolePermissions(roleId);
      await this.storeRolePermissions(roleId, permissions);
    }

    this.roleCache.set(roleId, updatedRole);
    return updatedRole;
  }

  async getRole(roleId: string): Promise<Role | null> {
    if (this.roleCache.has(roleId)) {
      return this.roleCache.get(roleId)!;
    }

    const result = await docClient.send(new GetCommand({
      TableName: SECURITY_CONFIG.TABLES.ROLES,
      Key: KEY_PATTERNS.role(roleId)
    }));

    if (!result.Item) {
      return null;
    }

    const role = result.Item as Role;
    this.roleCache.set(roleId, role);
    return role;
  }

  async deleteRole(roleId: string): Promise<void> {
    // Check if role is in use
    const usageCheck = await docClient.send(new QueryCommand({
      TableName: SECURITY_CONFIG.TABLES.USER_ROLES,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :roleKey',
      ExpressionAttributeValues: {
        ':roleKey': `role#${roleId}`
      },
      Limit: 1
    }));

    if (usageCheck.Items && usageCheck.Items.length > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }

    // Delete role
    await docClient.send(new DeleteCommand({
      TableName: SECURITY_CONFIG.TABLES.ROLES,
      Key: KEY_PATTERNS.role(roleId)
    }));

    // Delete role-permission mappings
    await this.deleteRolePermissions(roleId);

    this.roleCache.delete(roleId);
  }

  // ===== User Role Assignment =====

  async assignRole(request: AssignRoleRequest): Promise<UserRole> {
    // Validate role exists
    const role = await this.getRole(request.roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    const userRole: UserRole = {
      userId: request.userId,
      roleId: request.roleId,
      assignedBy: 'system', // Should come from auth context
      assignedAt: new Date().toISOString(),
      expiresAt: request.expiresAt,
      scope: request.scope,
      conditions: request.conditions
    };

    const keys = KEY_PATTERNS.userRole(request.userId, request.roleId, request.scope);

    await docClient.send(new PutCommand({
      TableName: SECURITY_CONFIG.TABLES.USER_ROLES,
      Item: {
        ...keys,
        ...userRole,
        ...GSI_PATTERNS.byTypeAndStatus('user-role', 'active', getTimestamp())
      }
    }));

    // Clear user role cache
    this.userRoleCache.delete(request.userId);

    return userRole;
  }

  async revokeRole(userId: string, roleId: string, scope?: string): Promise<void> {
    const keys = KEY_PATTERNS.userRole(userId, roleId, scope);

    await docClient.send(new DeleteCommand({
      TableName: SECURITY_CONFIG.TABLES.USER_ROLES,
      Key: keys
    }));

    // Clear user role cache
    this.userRoleCache.delete(userId);
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    if (this.userRoleCache.has(userId)) {
      return this.userRoleCache.get(userId)!;
    }

    const result = await docClient.send(new QueryCommand({
      TableName: SECURITY_CONFIG.TABLES.USER_ROLES,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `user#${userId}`
      }
    }));

    const userRoles: UserRole[] = [];
    const now = new Date().toISOString();

    for (const item of result.Items || []) {
      const userRole = item as UserRole;
      
      // Check if role assignment is still valid
      if (!userRole.expiresAt || userRole.expiresAt > now) {
        userRoles.push(userRole);
      }
    }

    this.userRoleCache.set(userId, userRoles);
    return userRoles;
  }

  // ===== Authorization =====

  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const accessContext = await this.buildAccessContext(request.userId, request.context);
    
    // Check direct permissions
    const directMatch = this.checkDirectPermission(accessContext, request.resource, request.action);
    if (directMatch.allowed) {
      return directMatch;
    }

    // Check inherited permissions
    const inheritedMatch = await this.checkInheritedPermissions(accessContext, request.resource, request.action);
    if (inheritedMatch.allowed) {
      return inheritedMatch;
    }

    // Check policy-based permissions
    const policyMatch = await this.checkPolicyBasedPermissions(accessContext, request);
    if (policyMatch.allowed) {
      return policyMatch;
    }

    return {
      allowed: false,
      reason: 'Access denied: insufficient permissions',
      requiredPermissions: this.getRequiredPermissions(request.resource, request.action),
      denyReasons: ['No matching permissions found']
    };
  }

  async buildAccessContext(userId: string, context?: Record<string, any>): Promise<AccessContext> {
    const userRoles = await this.getUserRoles(userId);
    const roles: Role[] = [];
    const allPermissions: Permission[] = [];

    // Load role details and collect permissions
    for (const userRole of userRoles) {
      const role = await this.getRole(userRole.roleId);
      if (role) {
        roles.push(role);
        allPermissions.push(...role.permissions);
      }
    }

    // Deduplicate permissions
    const uniquePermissions = allPermissions.filter((permission, index, self) =>
      index === self.findIndex(p => p.id === permission.id)
    );

    return {
      userId,
      roles,
      permissions: uniquePermissions,
      organizationId: context?.organizationId,
      projectId: context?.projectId,
      resourceContext: context
    };
  }

  private checkDirectPermission(context: AccessContext, resource: string, action: string): AuthorizationResult {
    const matchingPermissions = context.permissions.filter(permission =>
      this.matchesPermission(permission, resource, action, context.resourceContext)
    );

    if (matchingPermissions.length > 0) {
      return {
        allowed: true,
        appliedPolicies: matchingPermissions.map(p => p.id)
      };
    }

    return { allowed: false };
  }

  private async checkInheritedPermissions(context: AccessContext, resource: string, action: string): Promise<AuthorizationResult> {
    // Check permissions from inherited roles
    for (const role of context.roles) {
      if (role.inheritedRoles && role.inheritedRoles.length > 0) {
        for (const inheritedRoleId of role.inheritedRoles) {
          const inheritedRole = await this.getRole(inheritedRoleId);
          if (inheritedRole) {
            const matchingPermissions = inheritedRole.permissions.filter(permission =>
              this.matchesPermission(permission, resource, action, context.resourceContext)
            );

            if (matchingPermissions.length > 0) {
              return {
                allowed: true,
                appliedPolicies: [`inherited:${inheritedRoleId}`, ...matchingPermissions.map(p => p.id)]
              };
            }
          }
        }
      }
    }

    return { allowed: false };
  }

  private async checkPolicyBasedPermissions(context: AccessContext, request: AuthorizationRequest): Promise<AuthorizationResult> {
    // This would integrate with security policies for dynamic authorization
    // For now, return denied
    return { allowed: false };
  }

  private matchesPermission(permission: Permission, resource: string, action: string, context?: Record<string, any>): boolean {
    // Check resource match (supports wildcards)
    const resourceMatch = this.matchesPattern(permission.resource, resource);
    if (!resourceMatch) return false;

    // Check action match (supports wildcards)
    const actionMatch = this.matchesPattern(permission.action, action);
    if (!actionMatch) return false;

    // Check conditions if present
    if (permission.conditions && context) {
      return this.evaluateConditions(permission.conditions, context);
    }

    return true;
  }

  private matchesPattern(pattern: string, value: string): boolean {
    if (pattern === '*') return true;
    if (pattern === value) return true;
    
    // Support wildcard patterns like "users:*" or "projects:*/edit"
    const regexPattern = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  }

  private evaluateConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
    // Simple condition evaluation - in production, use a proper rules engine
    for (const [key, expectedValue] of Object.entries(conditions)) {
      if (context[key] !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  private getRequiredPermissions(resource: string, action: string): Permission[] {
    // Return example required permissions
    return [{
      id: 'required',
      name: 'Required Permission',
      description: `Permission required for ${action} on ${resource}`,
      resource,
      action,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }];
  }

  // ===== Helper Methods =====

  private async getPermissionsByIds(permissionIds: string[]): Promise<Permission[]> {
    if (permissionIds.length === 0) return [];

    const keys = permissionIds.map(id => ({
      PK: `permission#${id}`,
      SK: 'definition'
    }));

    const result = await docClient.send(new BatchGetCommand({
      RequestItems: {
        [SECURITY_CONFIG.TABLES.PERMISSIONS]: {
          Keys: keys
        }
      }
    }));

    return (result.Responses?.[SECURITY_CONFIG.TABLES.PERMISSIONS] || []) as Permission[];
  }

  private async storeRolePermissions(roleId: string, permissions: Permission[]): Promise<void> {
    await batchProcess(permissions, async (batch) => {
      const putRequests = batch.map(permission => ({
        PutRequest: {
          Item: {
            ...KEY_PATTERNS.rolePermission(roleId, permission.id),
            permissionId: permission.id,
            roleId
          }
        }
      }));

      // Use BatchWriteCommand here in production
      await Promise.all(putRequests.map(req => 
        docClient.send(new PutCommand({
          TableName: SECURITY_CONFIG.TABLES.ROLES,
          Item: req.PutRequest.Item
        }))
      ));

      return [];
    });
  }

  private async deleteRolePermissions(roleId: string): Promise<void> {
    const result = await docClient.send(new QueryCommand({
      TableName: SECURITY_CONFIG.TABLES.ROLES,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `role#${roleId}`,
        ':sk': 'permission#'
      }
    }));

    if (result.Items && result.Items.length > 0) {
      await batchProcess(result.Items, async (batch) => {
        await Promise.all(batch.map(item => 
          docClient.send(new DeleteCommand({
            TableName: SECURITY_CONFIG.TABLES.ROLES,
            Key: { PK: item.PK, SK: item.SK }
          }))
        ));
        return [];
      });
    }
  }

  private async loadBuiltInPermissions(): Promise<void> {
    const builtInPermissions = [
      { name: 'read:users', description: 'Read user information', resource: 'users', action: 'read' },
      { name: 'write:users', description: 'Create and update users', resource: 'users', action: 'write' },
      { name: 'delete:users', description: 'Delete users', resource: 'users', action: 'delete' },
      { name: 'read:trips', description: 'Read trip information', resource: 'trips', action: 'read' },
      { name: 'write:trips', description: 'Create and update trips', resource: 'trips', action: 'write' },
      { name: 'delete:trips', description: 'Delete trips', resource: 'trips', action: 'delete' },
      { name: 'read:reviews', description: 'Read reviews', resource: 'reviews', action: 'read' },
      { name: 'write:reviews', description: 'Create and update reviews', resource: 'reviews', action: 'write' },
      { name: 'moderate:reviews', description: 'Moderate reviews', resource: 'reviews', action: 'moderate' },
      { name: 'admin:system', description: 'System administration', resource: '*', action: '*' }
    ];

    // In production, these would be loaded from database
    // For now, just log that they would be created
    console.log('Built-in permissions would be loaded:', builtInPermissions.length);
  }

  private async loadBuiltInRoles(): Promise<void> {
    const builtInRoles = [
      { name: 'User', description: 'Basic user role', permissions: ['read:trips', 'write:trips', 'read:reviews', 'write:reviews'] },
      { name: 'Moderator', description: 'Content moderator', permissions: ['read:trips', 'read:reviews', 'moderate:reviews'] },
      { name: 'Admin', description: 'System administrator', permissions: ['admin:system'] }
    ];

    // In production, these would be loaded from database
    console.log('Built-in roles would be loaded:', builtInRoles.length);
  }
}

export const rbacService = new RBACService();
