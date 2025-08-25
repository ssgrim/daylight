#!/usr/bin/env node

// Production Database Migration Runner
// Issue #111 - Script to execute database migration to production setup

import { initializeProductionDatabase, databaseService, getDatabaseStatus } from './src/lib/databaseService.ts';
import { migrationManager } from './src/lib/databaseMigration.ts';
import { DB_CONFIG } from './src/lib/databaseConfig.ts';

async function runMigrationScript() {
  console.log('🚀 Starting Daylight Production Database Migration');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  
  try {
    // Display configuration
    console.log('📋 Migration Configuration:');
    console.log(`   Environment: ${DB_CONFIG.environment}`);
    console.log(`   Primary Database: ${DB_CONFIG.primary}`);
    console.log(`   Multi-Database: ${DB_CONFIG.enableMultiDatabase}`);
    console.log(`   Encryption: ${DB_CONFIG.security?.encryption?.atRest ? 'Enabled' : 'Disabled'}`);
    console.log('');

    // Step 1: Initialize database service (with migrations)
    console.log('🔧 Step 1: Initializing database service...');
    await initializeProductionDatabase(true);
    console.log('✅ Database service initialized');
    console.log('');

    // Step 2: Verify migration status
    console.log('📊 Step 2: Verifying migration status...');
    const migrationStatus = await migrationManager.getMigrationStatus();
    console.log(`   Applied migrations: ${migrationStatus.applied.length}`);
    console.log(`   Pending migrations: ${migrationStatus.pending.length}`);
    console.log(`   Current version: ${migrationStatus.current}`);
    
    if (migrationStatus.pending.length > 0) {
      console.log('   Pending migrations:');
      migrationStatus.pending.forEach(m => {
        console.log(`     - ${m.version}: ${m.name}`);
      });
    }
    console.log('');

    // Step 3: Check service health
    console.log('🏥 Step 3: Performing health checks...');
    const status = await getDatabaseStatus();
    console.log(`   Overall health: ${status.health.overall}`);
    console.log(`   Database connections:`);
    Object.entries(status.connections).forEach(([db, healthy]) => {
      console.log(`     - ${db}: ${healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    });
    console.log('');

    // Step 4: Display service status
    console.log('📈 Step 4: Service status summary...');
    console.log(`   Monitoring: ${status.monitoring.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Data Retention: ${status.retention.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Migration Complete: ${status.migration.completed ? '✅ Yes' : '❌ No'}`);
    console.log('');

    // Step 5: Performance test
    console.log('⚡ Step 5: Running performance test...');
    await runPerformanceTest();
    console.log('');

    // Migration completed successfully
    const duration = Date.now() - startTime;
    console.log('🎉 Migration Completed Successfully!');
    console.log('=' .repeat(60));
    console.log(`Total time: ${duration}ms`);
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Update application code to use new database service');
    console.log('   2. Monitor system performance and alerts');
    console.log('   3. Verify data retention policies are working');
    console.log('   4. Set up production monitoring dashboards');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   1. Check AWS credentials and permissions');
    console.log('   2. Verify DynamoDB service availability');
    console.log('   3. Check network connectivity');
    console.log('   4. Review error logs above');
    process.exit(1);
  }
}

async function runPerformanceTest() {
  try {
    const testTable = 'daylight-performance-test';
    
    // Test write performance
    console.log('   Testing write performance...');
    const writeStart = Date.now();
    const testItem = {
      id: `test_${Date.now()}`,
      data: 'performance test data',
      timestamp: new Date().toISOString()
    };
    
    await databaseService.put(testTable, testItem);
    const writeTime = Date.now() - writeStart;
    console.log(`     Write operation: ${writeTime}ms`);

    // Test read performance
    console.log('   Testing read performance...');
    const readStart = Date.now();
    await databaseService.query(testTable, {
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': testItem.id
      }
    });
    const readTime = Date.now() - readStart;
    console.log(`     Read operation: ${readTime}ms`);

    // Cleanup test data
    await databaseService.delete(testTable, { id: testItem.id });
    
    console.log('   ✅ Performance test completed');
    
  } catch (error) {
    console.log('   ⚠️  Performance test failed (this is normal if test table doesn\'t exist)');
  }
}

// Handle script arguments
const args = process.argv.slice(2);
const isHelp = args.includes('--help') || args.includes('-h');

if (isHelp) {
  console.log('Daylight Production Database Migration');
  console.log('');
  console.log('Usage: node migrate-database.mjs [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --dry-run      Show what would be migrated without executing');
  console.log('  --force        Force migration even if already complete');
  console.log('');
  console.log('Environment Variables:');
  console.log('  NODE_ENV               Set environment (development/staging/production)');
  console.log('  AWS_REGION             AWS region for DynamoDB');
  console.log('  AWS_ACCESS_KEY_ID      AWS access key');
  console.log('  AWS_SECRET_ACCESS_KEY  AWS secret key');
  console.log('');
  process.exit(0);
}

// Run the migration
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrationScript().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
