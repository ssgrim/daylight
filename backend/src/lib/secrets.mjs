/**
 * Legacy Secrets Interface
 * 
 * Provides backward compatibility while using the enhanced secrets management system
 * This file maintains the original API for existing code while leveraging the new features
 */

import { getSecretValue as getEnhancedSecretValue, SecretsManager, getMultipleSecrets } from './secrets-enhanced.js'

// Initialize enhanced secrets manager
const secretsManager = new SecretsManager(
  process.env.SECRETS_KMS_KEY_ID,
  {
    Environment: process.env.NODE_ENV || 'development',
    Service: 'daylight',
    LegacyCompatibility: 'true'
  }
)

/**
 * Get secret value with backward compatibility
 * 
 * @param {string} secretArnOrName - Secret ARN or name
 * @param {Object} opts - Options object with fromSSM flag
 * @returns {Promise<string|null>} Secret value
 */
export async function getSecretValue(secretArnOrName, opts = { fromSSM: false }) {
  if (!secretArnOrName) return null

  try {
    return await getEnhancedSecretValue(secretArnOrName, {
      fromSSM: opts.fromSSM || false,
      validateOnRead: true,
      maxRetries: 3,
      cacheTtl: 15 * 60 * 1000 // 15 minutes
    })
  } catch (error) {
    console.warn('getSecretValue error', String(error))
    return null
  }
}

/**
 * Batch get multiple secrets (enhanced functionality)
 * 
 * @param {Array<{key: string, secretArnOrName: string, fromSSM?: boolean}>} configs
 * @returns {Promise<Record<string, string|null>>}
 */
export async function getSecrets(configs) {
  const enhancedConfigs = configs.map(config => ({
    key: config.key,
    secretArnOrName: config.secretArnOrName,
    options: {
      fromSSM: config.fromSSM || false,
      validateOnRead: true,
      maxRetries: 3
    }
  }))

  return await getMultipleSecrets(enhancedConfigs)
}

/**
 * Create or update a secret (enhanced functionality)
 * 
 * @param {string} name - Secret name
 * @param {string} value - Secret value
 * @param {Object} options - Configuration options
 * @returns {Promise<string>} Secret ARN
 */
export async function createSecret(name, value, options = {}) {
  return await secretsManager.createOrUpdateSecret(name, value, {
    description: options.description,
    enableRotation: options.enableRotation || false,
    tags: options.tags || {}
  })
}

/**
 * Clear secrets cache
 * 
 * @param {string} secretArnOrName - Optional specific secret to clear
 */
export function clearSecretsCache(secretArnOrName) {
  secretsManager.clearCache(secretArnOrName)
}

/**
 * Get cache statistics for monitoring
 * 
 * @returns {Object} Cache statistics
 */
export function getSecretsStats() {
  return secretsManager.getCacheStats()
}

/**
 * Validate secret health
 * 
 * @param {string} secretArnOrName - Secret to validate
 * @returns {Promise<Object>} Health status
 */
export async function validateSecret(secretArnOrName) {
  return await secretsManager.validateSecretHealth(secretArnOrName)
}

/**
 * List all secrets with metadata
 * 
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} List of secrets with metadata
 */
export async function listSecrets(filters = {}) {
  return await secretsManager.listSecrets(filters)
}

// Export enhanced manager for advanced usage
export { SecretsManager }

// Default export for backward compatibility
export default { 
  getSecretValue,
  getSecrets,
  createSecret,
  clearSecretsCache,
  getSecretsStats,
  validateSecret,
  listSecrets,
  SecretsManager
}
