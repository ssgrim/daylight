/**
 * Secrets Health Check Handler
 * 
 * Provides health monitoring for secrets management system
 * Integrates with the main health check endpoint
 */

import { SecretsManager } from '../lib/secrets-enhanced.js'

interface SecretsHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    secrets_accessibility: {
      status: 'pass' | 'fail'
      details: string
      tested_secrets: number
      failed_secrets: number
    }
    kms_key_status: {
      status: 'pass' | 'fail'
      details: string
    }
    cache_performance: {
      status: 'pass' | 'fail'
      details: string
      cache_stats: any
    }
    rotation_status: {
      status: 'pass' | 'warn' | 'fail'
      details: string
      secrets_with_rotation: number
      overdue_rotations: number
    }
  }
  timestamp: string
  environment: string
}

/**
 * Perform comprehensive secrets health check
 */
export async function checkSecretsHealth(): Promise<SecretsHealthStatus> {
  console.log('Starting secrets health check')
  
  const secretsManager = new SecretsManager()
  const timestamp = new Date().toISOString()
  const environment = process.env.NODE_ENV || 'development'
  
  const checks = {
    secrets_accessibility: await checkSecretsAccessibility(secretsManager),
    kms_key_status: await checkKmsKeyStatus(),
    cache_performance: await checkCachePerformance(secretsManager),
    rotation_status: await checkRotationStatus(secretsManager)
  }
  
  // Determine overall status
  const failedChecks = Object.values(checks).filter(check => check.status === 'fail').length
  const warnChecks = Object.values(checks).filter(check => check.status === 'warn').length
  
  let status: 'healthy' | 'degraded' | 'unhealthy'
  if (failedChecks > 0) {
    status = 'unhealthy'
  } else if (warnChecks > 0) {
    status = 'degraded'
  } else {
    status = 'healthy'
  }
  
  console.log(`Secrets health check completed: ${status}`)
  
  return {
    status,
    checks,
    timestamp,
    environment
  }
}

/**
 * Check accessibility of critical secrets
 */
async function checkSecretsAccessibility(secretsManager: SecretsManager): Promise<{
  status: 'pass' | 'fail'
  details: string
  tested_secrets: number
  failed_secrets: number
}> {
  const secretsToTest = [
    'daylight/mapbox-api-key-dev',
    'daylight/google-maps-api-key-dev',
    'daylight/events-api-token-dev',
    'daylight/traffic-api-token-dev'
  ]
  
  let failedSecrets = 0
  const testResults: string[] = []
  
  for (const secretArn of secretsToTest) {
    try {
      const health = await secretsManager.validateSecretHealth(secretArn)
      if (!health.isHealthy) {
        failedSecrets++
        testResults.push(`${secretArn}: ${health.errors.join(', ')}`)
      } else {
        testResults.push(`${secretArn}: accessible`)
      }
    } catch (error) {
      failedSecrets++
      testResults.push(`${secretArn}: error - ${error}`)
    }
  }
  
  return {
    status: failedSecrets === 0 ? 'pass' : 'fail',
    details: failedSecrets === 0 ? 
      `All ${secretsToTest.length} secrets are accessible` : 
      `${failedSecrets}/${secretsToTest.length} secrets failed: ${testResults.filter(r => r.includes('error')).join('; ')}`,
    tested_secrets: secretsToTest.length,
    failed_secrets: failedSecrets
  }
}

/**
 * Check KMS key status
 */
async function checkKmsKeyStatus(): Promise<{
  status: 'pass' | 'fail'
  details: string
}> {
  try {
    // This would check KMS key accessibility and status
    // For now, we'll simulate this check
    const keyId = process.env.SECRETS_KMS_KEY_ID
    
    if (!keyId) {
      return {
        status: 'fail',
        details: 'SECRETS_KMS_KEY_ID environment variable not set'
      }
    }
    
    // In a real implementation, you would use KMS DescribeKey API
    // const kms = new KMSClient({ region: process.env.AWS_REGION })
    // const result = await kms.send(new DescribeKeyCommand({ KeyId: keyId }))
    
    return {
      status: 'pass',
      details: `KMS key ${keyId} is configured`
    }
  } catch (error) {
    return {
      status: 'fail',
      details: `KMS key check failed: ${error}`
    }
  }
}

/**
 * Check cache performance and statistics
 */
async function checkCachePerformance(secretsManager: SecretsManager): Promise<{
  status: 'pass' | 'fail'
  details: string
  cache_stats: any
}> {
  try {
    const stats = secretsManager.getCacheStats()
    
    // Consider cache unhealthy if too many errors
    const errorRate = stats.totalEntries > 0 ? stats.errorEntries / stats.totalEntries : 0
    const isHealthy = errorRate < 0.1 // Less than 10% error rate
    
    return {
      status: isHealthy ? 'pass' : 'fail',
      details: isHealthy ? 
        `Cache is performing well (${stats.validEntries}/${stats.totalEntries} valid entries)` :
        `Cache has high error rate (${stats.errorEntries}/${stats.totalEntries} entries with errors)`,
      cache_stats: stats
    }
  } catch (error) {
    return {
      status: 'fail',
      details: `Cache performance check failed: ${error}`,
      cache_stats: null
    }
  }
}

/**
 * Check secret rotation status
 */
async function checkRotationStatus(secretsManager: SecretsManager): Promise<{
  status: 'pass' | 'warn' | 'fail'
  details: string
  secrets_with_rotation: number
  overdue_rotations: number
}> {
  try {
    const secrets = await secretsManager.listSecrets({
      includeRotationStatus: true
    })
    
    const secretsWithRotation = secrets.filter(s => s.rotationEnabled).length
    const overdueRotations = secrets.filter(s => {
      if (!s.rotationEnabled || !s.nextRotationDate) return false
      return new Date() > s.nextRotationDate
    }).length
    
    let status: 'pass' | 'warn' | 'fail'
    let details: string
    
    if (overdueRotations > 0) {
      status = 'fail'
      details = `${overdueRotations} secrets have overdue rotations`
    } else if (secretsWithRotation === 0) {
      status = 'warn'
      details = 'No secrets have rotation enabled'
    } else {
      status = 'pass'
      details = `${secretsWithRotation} secrets have rotation configured and up to date`
    }
    
    return {
      status,
      details,
      secrets_with_rotation: secretsWithRotation,
      overdue_rotations: overdueRotations
    }
  } catch (error) {
    return {
      status: 'fail',
      details: `Rotation status check failed: ${error}`,
      secrets_with_rotation: 0,
      overdue_rotations: 0
    }
  }
}

/**
 * Integration function for main health check endpoint
 */
export async function getSecretsHealthSummary(): Promise<{
  status: 'pass' | 'warn' | 'fail'
  message: string
}> {
  try {
    const health = await checkSecretsHealth()
    
    const statusMap = {
      healthy: 'pass' as const,
      degraded: 'warn' as const,
      unhealthy: 'fail' as const
    }
    
    const failedChecks = Object.entries(health.checks)
      .filter(([_, check]) => check.status === 'fail')
      .map(([name, _]) => name)
    
    const warnChecks = Object.entries(health.checks)
      .filter(([_, check]) => check.status === 'warn')
      .map(([name, _]) => name)
    
    let message = 'Secrets management system is healthy'
    if (failedChecks.length > 0) {
      message = `Secrets issues detected: ${failedChecks.join(', ')}`
    } else if (warnChecks.length > 0) {
      message = `Secrets warnings: ${warnChecks.join(', ')}`
    }
    
    return {
      status: statusMap[health.status],
      message
    }
  } catch (error) {
    console.error('Failed to check secrets health:', error)
    return {
      status: 'fail',
      message: `Secrets health check failed: ${error}`
    }
  }
}

export default {
  checkSecretsHealth,
  getSecretsHealthSummary
}
