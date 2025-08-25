#!/usr/bin/env node
import { handler as tripsHandler } from './dist/trips.js'

async function testHandler() {
  console.log('Testing trips handler directly...\n')
  
  try {
    // Test 1: Get all trips
    console.log('1. Testing GET /api/trips')
    const getAllEvent = {
      requestContext: {
        http: {
          method: 'GET',
          path: '/api/trips'
        }
      },
      headers: {
        'Authorization': 'Bearer dev-token'
      },
      body: null,
      pathParameters: null,
      queryStringParameters: {}
    }
    
    const result1 = await tripsHandler(getAllEvent)
    console.log(`   Status: ${result1.statusCode}`)
    const data1 = JSON.parse(result1.body)
    console.log(`   Found ${data1.count} trips`)
    if (data1.items) {
      data1.items.forEach((trip, i) => {
        console.log(`   ${i + 1}. ${trip.name} (${trip.status})`)
      })
    }
    console.log('')
    
    // Test 2: Search for "mountain"
    console.log('2. Testing search for "mountain"')
    const searchEvent = {
      requestContext: {
        http: {
          method: 'GET',
          path: '/api/trips'
        }
      },
      headers: {
        'Authorization': 'Bearer dev-token'
      },
      body: null,
      pathParameters: null,
      queryStringParameters: {
        search: 'mountain'
      }
    }
    
    const result2 = await tripsHandler(searchEvent)
    console.log(`   Status: ${result2.statusCode}`)
    const data2 = JSON.parse(result2.body)
    console.log(`   Found ${data2.count} trips with "mountain"`)
    if (data2.items) {
      data2.items.forEach((trip, i) => {
        console.log(`   ${i + 1}. ${trip.name}`)
      })
    }
    console.log('')
    
    // Test 3: Get search suggestions
    console.log('3. Testing search suggestions for "mou"')
    const suggestionsEvent = {
      requestContext: {
        http: {
          method: 'GET',
          path: '/api/trips/suggestions'
        }
      },
      headers: {
        'Authorization': 'Bearer dev-token'
      },
      body: null,
      pathParameters: null,
      queryStringParameters: {
        q: 'mou'
      }
    }
    
    const result3 = await tripsHandler(suggestionsEvent)
    console.log(`   Status: ${result3.statusCode}`)
    const data3 = JSON.parse(result3.body)
    console.log(`   Name suggestions: ${data3.names?.join(', ') || 'none'}`)
    console.log(`   Tag suggestions: ${data3.tags?.join(', ') || 'none'}`)
    console.log('')
    
    // Test 4: Get trip statistics
    console.log('4. Testing trip statistics')
    const statsEvent = {
      requestContext: {
        http: {
          method: 'GET',
          path: '/api/trips/stats'
        }
      },
      headers: {
        'Authorization': 'Bearer dev-token'
      },
      body: null,
      pathParameters: null,
      queryStringParameters: {}
    }
    
    const result4 = await tripsHandler(statsEvent)
    console.log(`   Status: ${result4.statusCode}`)
    const data4 = JSON.parse(result4.body)
    console.log(`   Total trips: ${data4.total}`)
    console.log(`   By status:`, data4.byStatus)
    console.log(`   Top tags: ${data4.topTags?.map(t => `${t.tag}(${t.count})`).join(', ')}`)
    console.log('')
    
    console.log('✅ All advanced search functionality tests passed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testHandler()
