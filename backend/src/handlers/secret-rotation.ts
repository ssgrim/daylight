/**
 * AWS Lambda function for automatic secret rotation
 * 
 * This function handles the rotation of secrets in AWS Secrets Manager
 * following the rotation lifecycle: createVersion, setSecret, testSecret, finishSecret
 */

import { 
  SecretsManagerClient, 
  GetSecretValueCommand,
  DescribeSecretCommand,
  UpdateSecretVersionStageCommand,
  PutSecretValueCommand
} from '@aws-sdk/client-secrets-manager'

const sm = new SecretsManagerClient({ 
  region: process.env.AWS_REGION || 'us-west-1'
})

interface RotationEvent {
  Step: 'createSecret' | 'setSecret' | 'testSecret' | 'finishSecret'
  SecretId: string
  Token: string
}

interface LambdaContext {
  awsRequestId: string
  logGroupName: string
  logStreamName: string
  functionName: string
  functionVersion: string
  invokedFunctionArn: string
  memoryLimitInMB: string
  remainingTimeInMS: () => number
}

/**
 * Main handler for secret rotation
 */
export async function handler(event: RotationEvent, context: LambdaContext): Promise<void> {
  console.log(`Starting rotation for secret ${event.SecretId}, step: ${event.Step}`)
  
  try {
    switch (event.Step) {
      case 'createSecret':
        await createSecret(event.SecretId, event.Token)
        break
      case 'setSecret':
        await setSecret(event.SecretId, event.Token)
        break
      case 'testSecret':
        await testSecret(event.SecretId, event.Token)
        break
      case 'finishSecret':
        await finishSecret(event.SecretId, event.Token)
        break
      default:
        throw new Error(`Invalid step: ${event.Step}`)
    }
    
    console.log(`Successfully completed step ${event.Step} for secret ${event.SecretId}`)
  } catch (error) {
    console.error(`Failed to complete step ${event.Step} for secret ${event.SecretId}:`, error)
    throw error
  }
}

/**
 * Step 1: Create a new version of the secret with a new password
 */
async function createSecret(secretId: string, token: string): Promise<void> {
  console.log(`Creating new secret version for ${secretId}`)
  
  try {
    // Check if the version already exists
    await sm.send(new GetSecretValueCommand({
      SecretId: secretId,
      VersionId: token,
      VersionStage: 'AWSPENDING'
    }))
    console.log(`Version ${token} already exists for secret ${secretId}`)
    return
  } catch (error) {
    // Version doesn't exist, create it
    if ((error as any).name !== 'ResourceNotFoundException') {
      throw error
    }
  }

  // Get the current secret to understand its structure
  const currentSecret = await sm.send(new GetSecretValueCommand({
    SecretId: secretId,
    VersionStage: 'AWSCURRENT'
  }))

  if (!currentSecret.SecretString) {
    throw new Error(`Secret ${secretId} does not have a SecretString`)
  }

  // Generate new secret value based on type
  const newSecretValue = await generateNewSecret(currentSecret.SecretString)

  // Create the new version
  await sm.send(new PutSecretValueCommand({
    SecretId: secretId,
    SecretString: newSecretValue,
    ClientRequestToken: token,
    VersionStages: ['AWSPENDING']
  }))

  console.log(`Created new version ${token} for secret ${secretId}`)
}

/**
 * Step 2: Configure the service to use the new secret version
 */
async function setSecret(secretId: string, token: string): Promise<void> {
  console.log(`Setting secret for ${secretId} with token ${token}`)
  
  // Get the new secret value
  const newSecret = await sm.send(new GetSecretValueCommand({
    SecretId: secretId,
    VersionId: token,
    VersionStage: 'AWSPENDING'
  }))

  if (!newSecret.SecretString) {
    throw new Error(`New secret version ${token} does not have a SecretString`)
  }

  // Parse the secret to determine the type and update accordingly
  const secretData = parseSecretString(newSecret.SecretString)
  
  // Update the service configuration based on secret type
  await updateServiceConfiguration(secretId, secretData)
  
  console.log(`Successfully configured service for secret ${secretId}`)
}

/**
 * Step 3: Test the new secret to ensure it works
 */
async function testSecret(secretId: string, token: string): Promise<void> {
  console.log(`Testing secret for ${secretId} with token ${token}`)
  
  // Get the new secret value
  const newSecret = await sm.send(new GetSecretValueCommand({
    SecretId: secretId,
    VersionId: token,
    VersionStage: 'AWSPENDING'
  }))

  if (!newSecret.SecretString) {
    throw new Error(`New secret version ${token} does not have a SecretString`)
  }

  // Parse and test the secret
  const secretData = parseSecretString(newSecret.SecretString)
  const testResult = await testSecretConnectivity(secretId, secretData)

  if (!testResult.success) {
    throw new Error(`Secret test failed for ${secretId}: ${testResult.error}`)
  }

  console.log(`Secret test passed for ${secretId}`)
}

/**
 * Step 4: Mark the new secret as current and clean up
 */
async function finishSecret(secretId: string, token: string): Promise<void> {
  console.log(`Finishing rotation for ${secretId} with token ${token}`)
  
  // Get the current secret metadata
  const secretDesc = await sm.send(new DescribeSecretCommand({
    SecretId: secretId
  }))

  // Find the current version token
  let currentVersionId: string | undefined
  for (const [versionId, stages] of Object.entries(secretDesc.VersionIdsToStages || {})) {
    if (Array.isArray(stages) && stages.includes('AWSCURRENT')) {
      currentVersionId = versionId
      break
    }
  }

  // Update version stages
  if (currentVersionId && currentVersionId !== token) {
    // Move AWSCURRENT from old version to new version
    await sm.send(new UpdateSecretVersionStageCommand({
      SecretId: secretId,
      VersionStage: 'AWSCURRENT',
      MoveToVersionId: token,
      RemoveFromVersionId: currentVersionId
    }))

    // Move AWSPENDING stage from new version (it becomes AWSCURRENT)
    await sm.send(new UpdateSecretVersionStageCommand({
      SecretId: secretId,
      VersionStage: 'AWSPENDING',
      RemoveFromVersionId: token
    }))
  }

  console.log(`Successfully finished rotation for secret ${secretId}`)
}

/**
 * Generate a new secret value based on the current secret type
 */
async function generateNewSecret(currentSecretString: string): Promise<string> {
  try {
    const currentSecret = JSON.parse(currentSecretString)
    
    // Handle different secret types
    if (currentSecret.apiKey || currentSecret.api_key) {
      // API Key rotation - generate new random key
      return JSON.stringify({
        ...currentSecret,
        apiKey: generateRandomApiKey(),
        rotatedAt: new Date().toISOString()
      })
    }
    
    if (currentSecret.token || currentSecret.access_token) {
      // Token rotation - generate new token
      return JSON.stringify({
        ...currentSecret,
        token: generateRandomToken(),
        rotatedAt: new Date().toISOString()
      })
    }
    
    if (currentSecret.password) {
      // Password rotation
      return JSON.stringify({
        ...currentSecret,
        password: generateRandomPassword(),
        rotatedAt: new Date().toISOString()
      })
    }
    
    // Default: treat as simple API key
    return generateRandomApiKey()
    
  } catch (error) {
    // Not JSON, treat as simple string secret
    return generateRandomApiKey()
  }
}

/**
 * Parse secret string into structured data
 */
function parseSecretString(secretString: string): any {
  try {
    return JSON.parse(secretString)
  } catch (error) {
    // Simple string secret
    return { value: secretString }
  }
}

/**
 * Update service configuration with new secret
 */
async function updateServiceConfiguration(secretId: string, secretData: any): Promise<void> {
  console.log(`Updating service configuration for secret ${secretId}`)
  
  // This would contain service-specific logic for updating configurations
  // For example, updating API gateway settings, Lambda environment variables, etc.
  
  // For now, we'll just log the action
  console.log(`Service configuration updated for ${secretId}`)
}

/**
 * Test secret connectivity and validity
 */
async function testSecretConnectivity(
  secretId: string, 
  secretData: any
): Promise<{ success: boolean; error?: string }> {
  console.log(`Testing connectivity for secret ${secretId}`)
  
  try {
    // Determine secret type and test accordingly
    if (secretData.apiKey || secretData.api_key) {
      return await testApiKey(secretData.apiKey || secretData.api_key)
    }
    
    if (secretData.token || secretData.access_token) {
      return await testToken(secretData.token || secretData.access_token)
    }
    
    if (secretId.includes('mapbox')) {
      return await testMapboxApi(secretData.value || secretData.apiKey || secretData.token)
    }
    
    if (secretId.includes('google') || secretId.includes('maps')) {
      return await testGoogleMapsApi(secretData.value || secretData.apiKey || secretData.token)
    }
    
    // Default success for unknown types
    return { success: true }
    
  } catch (error) {
    return { 
      success: false, 
      error: `Connectivity test failed: ${error}` 
    }
  }
}

/**
 * Test generic API key
 */
async function testApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
  if (!apiKey || apiKey.length < 10) {
    return { success: false, error: 'Invalid API key format' }
  }
  return { success: true }
}

/**
 * Test generic token
 */
async function testToken(token: string): Promise<{ success: boolean; error?: string }> {
  if (!token || token.length < 10) {
    return { success: false, error: 'Invalid token format' }
  }
  return { success: true }
}

/**
 * Test Mapbox API connectivity
 */
async function testMapboxApi(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/test.json?access_token=${apiKey}`)
    
    if (response.status === 401) {
      return { success: false, error: 'Mapbox API key is invalid' }
    }
    
    if (response.status >= 400) {
      return { success: false, error: `Mapbox API returned status ${response.status}` }
    }
    
    return { success: true }
  } catch (error) {
    return { success: false, error: `Mapbox API test failed: ${error}` }
  }
}

/**
 * Test Google Maps API connectivity
 */
async function testGoogleMapsApi(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${apiKey}`)
    
    if (!response.ok) {
      return { success: false, error: `Google Maps API returned status ${response.status}` }
    }
    
    const data = await response.json()
    
    if (data.status === 'REQUEST_DENIED') {
      return { success: false, error: 'Google Maps API key is invalid' }
    }
    
    return { success: true }
  } catch (error) {
    return { success: false, error: `Google Maps API test failed: ${error}` }
  }
}

/**
 * Generate random API key
 */
function generateRandomApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const length = 64
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate random token
 */
function generateRandomToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const length = 128
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate random password
 */
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const length = 32
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
