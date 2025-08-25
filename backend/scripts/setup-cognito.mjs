#!/usr/bin/env node
/**
 * AWS Cognito Setup Script
 * Run this script to set up AWS Cognito User Pool for authentication
 */

import { 
  CognitoIdentityProviderClient, 
  CreateUserPoolCommand,
  CreateUserPoolClientCommand,
  DescribeUserPoolCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand
} from '@aws-sdk/client-cognito-identity-provider'

const region = process.env.AWS_REGION || 'us-west-1'
const client = new CognitoIdentityProviderClient({ region })

async function createUserPool() {
  console.log('🔧 Creating Cognito User Pool...')
  
  try {
    const command = new CreateUserPoolCommand({
      PoolName: 'daylight-users',
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireUppercase: true,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: false
        }
      },
      AutoVerifiedAttributes: ['email'],
      UsernameAttributes: ['email'],
      Schema: [
        {
          Name: 'email',
          AttributeDataType: 'String',
          Required: true,
          Mutable: true
        },
        {
          Name: 'name',
          AttributeDataType: 'String',
          Required: false,
          Mutable: true
        }
      ],
      UserPoolTags: {
        Project: 'daylight',
        Environment: process.env.NODE_ENV || 'development'
      }
    })

    const result = await client.send(command)
    console.log('✅ User Pool created successfully!')
    console.log(`📝 User Pool ID: ${result.UserPool.Id}`)
    
    return result.UserPool.Id
  } catch (error) {
    console.error('❌ Failed to create User Pool:', error.message)
    throw error
  }
}

async function createUserPoolClient(userPoolId) {
  console.log('🔧 Creating User Pool Client...')
  
  try {
    const command = new CreateUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientName: 'daylight-app',
      GenerateSecret: false, // For frontend applications
      ExplicitAuthFlows: [
        'ADMIN_NO_SRP_AUTH',
        'USER_PASSWORD_AUTH',
        'ALLOW_USER_PASSWORD_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH'
      ],
      SupportedIdentityProviders: ['COGNITO'],
      CallbackURLs: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://your-domain.com'
      ],
      LogoutURLs: [
        'http://localhost:5173',
        'http://localhost:3000', 
        'https://your-domain.com'
      ],
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: ['openid', 'email', 'profile'],
      AllowedOAuthFlowsUserPoolClient: true,
      TokenValidityUnits: {
        AccessToken: 'hours',
        IdToken: 'hours',
        RefreshToken: 'days'
      },
      AccessTokenValidity: 24,
      IdTokenValidity: 24,
      RefreshTokenValidity: 30
    })

    const result = await client.send(command)
    console.log('✅ User Pool Client created successfully!')
    console.log(`📝 Client ID: ${result.UserPoolClient.ClientId}`)
    
    return result.UserPoolClient.ClientId
  } catch (error) {
    console.error('❌ Failed to create User Pool Client:', error.message)
    throw error
  }
}

async function createTestUser(userPoolId, username, email, password) {
  console.log(`🔧 Creating test user: ${username}...`)
  
  try {
    // Create user
    const createCommand = new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: username,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: username }
      ],
      MessageAction: 'SUPPRESS',
      TemporaryPassword: password + '_temp'
    })

    await client.send(createCommand)

    // Set permanent password
    const passwordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: password,
      Permanent: true
    })

    await client.send(passwordCommand)
    
    console.log('✅ Test user created successfully!')
    console.log(`📝 Username: ${username}`)
    console.log(`📝 Email: ${email}`)
    console.log(`📝 Password: ${password}`)
    
  } catch (error) {
    console.error('❌ Failed to create test user:', error.message)
    throw error
  }
}

async function main() {
  console.log('🚀 Setting up AWS Cognito for Daylight Authentication\n')
  
  try {
    // Create User Pool
    const userPoolId = await createUserPool()
    
    // Create User Pool Client
    const clientId = await createUserPoolClient(userPoolId)
    
    // Create test user for development
    if (process.env.NODE_ENV !== 'production') {
      await createTestUser(userPoolId, 'testuser', 'test@example.com', 'TestPass123')
    }
    
    console.log('\n🎉 Cognito setup completed successfully!')
    console.log('\n📋 Configuration:')
    console.log(`export COGNITO_USER_POOL_ID=${userPoolId}`)
    console.log(`export COGNITO_CLIENT_ID=${clientId}`)
    console.log(`export AWS_REGION=${region}`)
    
    console.log('\n📝 Add these to your .env file:')
    console.log(`COGNITO_USER_POOL_ID=${userPoolId}`)
    console.log(`COGNITO_CLIENT_ID=${clientId}`)
    console.log(`AWS_REGION=${region}`)
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n🔧 Development Login:')
      console.log('Username: testuser')
      console.log('Password: TestPass123')
      console.log('Or use dev token: "dev-token"')
    }
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message)
    console.log('\n🔍 Make sure you have:')
    console.log('1. AWS CLI configured with proper credentials')
    console.log('2. Sufficient permissions for Cognito operations')
    console.log('3. Correct AWS region set')
    process.exit(1)
  }
}

// Check if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { createUserPool, createUserPoolClient, createTestUser }
