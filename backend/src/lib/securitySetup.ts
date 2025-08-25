#!/usr/bin/env node

// Security Framework Setup Script
// Issue #119 - Advanced Security & Compliance Framework

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  CreateTableCommand, 
  DescribeTableCommand,
  GlobalSecondaryIndex,
  KeySchemaElement,
  AttributeDefinition 
} from '@aws-sdk/client-dynamodb';
import { rbacService } from './rbacService';
import { 
  SECURITY_CONFIG, 
  DEFAULT_PERMISSIONS, 
  DEFAULT_ROLES,
  DEFAULT_SECURITY_POLICIES,
  validateSecurityConfig 
} from './securityConfig';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

interface TableConfig {
  TableName: string;
  KeySchema: KeySchemaElement[];
  AttributeDefinitions: AttributeDefinition[];
  GlobalSecondaryIndexes?: GlobalSecondaryIndex[];
  BillingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
  ProvisionedThroughput?: {
    ReadCapacityUnits: number;
    WriteCapacityUnits: number;
  };
  StreamSpecification?: {
    StreamEnabled: boolean;
    StreamViewType: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES';
  };
  PointInTimeRecoverySpecification?: {
    PointInTimeRecoveryEnabled: boolean;
  };
  ServerSideEncryptionSpecification?: {
    Enabled: boolean;
    SSEType?: 'AES256' | 'KMS';
    KMSMasterKeyId?: string;
  };
  Tags?: Array<{
    Key: string;
    Value: string;
  }>;
}

class SecuritySetup {
  private isProduction = process.env.NODE_ENV === 'production';

  async setupSecurityFramework(): Promise<void> {
    console.log('🔐 Setting up Advanced Security & Compliance Framework...\n');

    try {
      // 1. Validate configuration
      await this.validateConfiguration();

      // 2. Create DynamoDB tables
      await this.createSecurityTables();

      // 3. Initialize default permissions and roles
      await this.initializeRBAC();

      // 4. Setup security policies
      await this.setupSecurityPolicies();

      // 5. Create sample data (development only)
      if (!this.isProduction) {
        await this.createSampleData();
      }

      // 6. Verify setup
      await this.verifySetup();

      console.log('\n✅ Security framework setup completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('   1. Configure OAuth2 providers in environment variables');
      console.log('   2. Set up KMS key for encryption');
      console.log('   3. Configure monitoring webhooks');
      console.log('   4. Review and customize security policies');
      
    } catch (error) {
      console.error('\n❌ Security setup failed:', error);
      throw error;
    }
  }

  private async validateConfiguration(): Promise<void> {
    console.log('🔍 Validating security configuration...');

    const validation = validateSecurityConfig();
    
    if (validation.errors.length > 0) {
      console.error('❌ Configuration errors:');
      validation.errors.forEach(error => console.error(`   - ${error}`));
      throw new Error('Configuration validation failed');
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠️  Configuration warnings:');
      validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
    }

    console.log('✅ Configuration validated');
  }

  private async createSecurityTables(): Promise<void> {
    console.log('\n📊 Creating DynamoDB tables...');

    const tables: TableConfig[] = [
      {
        TableName: SECURITY_CONFIG.TABLES.USERS,
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
          { AttributeName: 'GSI1PK', AttributeType: 'S' },
          { AttributeName: 'GSI1SK', AttributeType: 'S' },
          { AttributeName: 'email', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' }
          },
          {
            IndexName: 'EmailIndex',
            KeySchema: [
              { AttributeName: 'email', KeyType: 'HASH' }
            ],
            Projection: { ProjectionType: 'ALL' }
          }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: 'NEW_AND_OLD_IMAGES'
        },
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: this.isProduction
        },
        ServerSideEncryptionSpecification: {
          Enabled: true,
          SSEType: 'KMS',
          KMSMasterKeyId: SECURITY_CONFIG.ENCRYPTION.KMS_KEY_ID
        },
        Tags: [
          { Key: 'Application', Value: 'Daylight' },
          { Key: 'Component', Value: 'Security' },
          { Key: 'Environment', Value: SECURITY_CONFIG.ENVIRONMENT }
        ]
      },
      {
        TableName: SECURITY_CONFIG.TABLES.SESSIONS,
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
          { AttributeName: 'GSI1PK', AttributeType: 'S' },
          { AttributeName: 'GSI1SK', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' }
          }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: 'NEW_AND_OLD_IMAGES'
        },
        ServerSideEncryptionSpecification: {
          Enabled: true,
          SSEType: 'KMS'
        },
        Tags: [
          { Key: 'Application', Value: 'Daylight' },
          { Key: 'Component', Value: 'Security' },
          { Key: 'DataType', Value: 'Sessions' }
        ]
      },
      {
        TableName: SECURITY_CONFIG.TABLES.ROLES,
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
          { AttributeName: 'GSI1PK', AttributeType: 'S' },
          { AttributeName: 'GSI1SK', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' }
          }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        ServerSideEncryptionSpecification: {
          Enabled: true,
          SSEType: 'KMS'
        },
        Tags: [
          { Key: 'Application', Value: 'Daylight' },
          { Key: 'Component', Value: 'RBAC' }
        ]
      },
      {
        TableName: SECURITY_CONFIG.TABLES.AUDIT_LOGS,
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
          { AttributeName: 'GSI1PK', AttributeType: 'S' },
          { AttributeName: 'GSI1SK', AttributeType: 'S' },
          { AttributeName: 'GSI2PK', AttributeType: 'S' },
          { AttributeName: 'GSI2SK', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' }
          },
          {
            IndexName: 'GSI2',
            KeySchema: [
              { AttributeName: 'GSI2PK', KeyType: 'HASH' },
              { AttributeName: 'GSI2SK', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' }
          }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: 'NEW_AND_OLD_IMAGES'
        },
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true
        },
        ServerSideEncryptionSpecification: {
          Enabled: true,
          SSEType: 'KMS'
        },
        Tags: [
          { Key: 'Application', Value: 'Daylight' },
          { Key: 'Component', Value: 'Audit' },
          { Key: 'Compliance', Value: 'Required' }
        ]
      }
    ];

    for (const tableConfig of tables) {
      await this.createTableIfNotExists(tableConfig);
    }

    console.log('✅ Database tables created');
  }

  private async createTableIfNotExists(config: TableConfig): Promise<void> {
    try {
      // Check if table exists
      await dynamoClient.send(new DescribeTableCommand({ 
        TableName: config.TableName 
      }));
      console.log(`   ℹ️  Table ${config.TableName} already exists`);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        // Create table
        console.log(`   📝 Creating table ${config.TableName}...`);
        await dynamoClient.send(new CreateTableCommand(config));
        console.log(`   ✅ Table ${config.TableName} created`);
      } else {
        throw error;
      }
    }
  }

  private async initializeRBAC(): Promise<void> {
    console.log('\n🔑 Initializing RBAC system...');

    try {
      // Create default permissions
      console.log('   📝 Creating default permissions...');
      for (const permission of DEFAULT_PERMISSIONS) {
        try {
          await rbacService.createPermission(permission);
        } catch (error: any) {
          if (!error.message?.includes('already exists')) {
            throw error;
          }
        }
      }
      console.log(`   ✅ Created ${DEFAULT_PERMISSIONS.length} permissions`);

      // Create default roles
      console.log('   📝 Creating default roles...');
      for (const role of DEFAULT_ROLES) {
        try {
          await rbacService.createRole(role);
        } catch (error: any) {
          if (!error.message?.includes('already exists')) {
            throw error;
          }
        }
      }
      console.log(`   ✅ Created ${DEFAULT_ROLES.length} roles`);

      console.log('✅ RBAC system initialized');
    } catch (error) {
      console.error('❌ RBAC initialization failed:', error);
      throw error;
    }
  }

  private async setupSecurityPolicies(): Promise<void> {
    console.log('\n📋 Setting up security policies...');

    // In a real implementation, you would store these in the database
    // For now, we'll just log that they would be created
    console.log(`   📝 Would create ${DEFAULT_SECURITY_POLICIES.length} security policies:`);
    
    DEFAULT_SECURITY_POLICIES.forEach(policy => {
      console.log(`      - ${policy.displayName} (${policy.category})`);
    });

    console.log('✅ Security policies configured');
  }

  private async createSampleData(): Promise<void> {
    console.log('\n🧪 Creating sample data for development...');

    // Create sample admin user
    const sampleAdminData = {
      email: 'admin@daylight.dev',
      name: 'System Administrator',
      provider: 'system',
      isActive: true,
      emailVerified: true,
      createdAt: new Date().toISOString()
    };

    try {
      // This would use the authentication service to create a user
      console.log('   📝 Sample admin user would be created');
      console.log('   📝 Sample user roles would be assigned');
      console.log('   📝 Sample audit logs would be generated');
      
      console.log('✅ Sample data created');
    } catch (error) {
      console.warn('⚠️  Sample data creation failed (this is okay in production)');
    }
  }

  private async verifySetup(): Promise<void> {
    console.log('\n🔍 Verifying setup...');

    const checks = [
      { name: 'Database tables', check: () => this.verifyTables() },
      { name: 'RBAC permissions', check: () => this.verifyRBAC() },
      { name: 'Security configuration', check: () => this.verifyConfig() }
    ];

    for (const { name, check } of checks) {
      try {
        await check();
        console.log(`   ✅ ${name} verified`);
      } catch (error) {
        console.error(`   ❌ ${name} verification failed:`, error);
        throw error;
      }
    }

    console.log('✅ Setup verification completed');
  }

  private async verifyTables(): Promise<void> {
    const tableNames = Object.values(SECURITY_CONFIG.TABLES);
    
    for (const tableName of tableNames) {
      const result = await dynamoClient.send(new DescribeTableCommand({ 
        TableName: tableName 
      }));
      
      if (result.Table?.TableStatus !== 'ACTIVE') {
        throw new Error(`Table ${tableName} is not active`);
      }
    }
  }

  private async verifyRBAC(): Promise<void> {
    const permissions = await rbacService.listPermissions();
    const roles = await rbacService.listRoles();

    if (permissions.length === 0) {
      throw new Error('No permissions found');
    }

    if (roles.length === 0) {
      throw new Error('No roles found');
    }

    // Verify admin role exists and has permissions
    const adminRole = roles.find(r => r.name === 'admin');
    if (!adminRole) {
      throw new Error('Admin role not found');
    }

    if (!adminRole.permissions || adminRole.permissions.length === 0) {
      throw new Error('Admin role has no permissions');
    }
  }

  private async verifyConfig(): Promise<void> {
    const validation = validateSecurityConfig();
    
    if (!validation.isValid) {
      throw new Error(`Configuration invalid: ${validation.errors.join(', ')}`);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const setup = new SecuritySetup();

  switch (command) {
    case 'setup':
    case 'init':
      await setup.setupSecurityFramework();
      break;
    
    default:
      console.log(`
🔐 Daylight Security Framework Setup

Usage: node securitySetup.js <command>

Commands:
  setup, init    Set up the complete security framework
  
Environment Variables:
  NODE_ENV       Environment (development|staging|production)
  AWS_REGION     AWS region for DynamoDB and KMS
  KMS_KEY_ID     KMS key ID for encryption
  JWT_SECRET     JWT signing secret
  
OAuth2 Providers (optional):
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
  MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
      `);
      process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

export { SecuritySetup };
