#!/usr/bin/env node
/**
 * Simple health check test
 */

const { handler } = require('./dist/health.js')

async function testHealthCheck() {
  console.log('Testing health check handler...')
  
  try {
    // Simulate a Lambda event
    const event = {
      requestContext: {
        http: {
          method: 'GET'
        }
      },
      queryStringParameters: {
        level: 'basic'
      },
      headers: {
        'user-agent': 'test-client'
      }
    }

    const context = {
      functionName: 'test-health',
      functionVersion: '1',
      getRemainingTimeInMillis: () => 30000
    }

    console.log('Calling health handler...')
    const result = await handler(event, context)
    
    console.log('Health check result:')
    console.log('Status Code:', result.statusCode)
    console.log('Headers:', result.headers)
    console.log('Body:', JSON.parse(result.body))
    
  } catch (error) {
    console.error('Health check failed:', error)
    process.exit(1)
  }
}

testHealthCheck().catch(console.error)
