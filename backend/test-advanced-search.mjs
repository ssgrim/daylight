import http from 'http'

async function testTripsAPI() {
  const baseUrl = 'http://localhost:5174'
  
  // Helper function to make HTTP requests
  function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl)
      const options = {
        method,
        headers: {
          'Authorization': 'Bearer dev-token',
          'Content-Type': 'application/json'
        }
      }
      
      const req = http.request(url, options, (res) => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('end', () => {
          try {
            const parsedBody = body ? JSON.parse(body) : null
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: parsedBody
            })
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: body
            })
          }
        })
      })
      
      req.on('error', reject)
      
      if (data) {
        req.write(JSON.stringify(data))
      }
      
      req.end()
    })
  }
  
  console.log('🚀 Testing Advanced Search Functionality...\n')
  
  try {
    // Test 1: Get all trips (should include sample data)
    console.log('1️⃣ Testing: Get all trips')
    const allTrips = await makeRequest('GET', '/api/trips')
    console.log(`   Status: ${allTrips.status}`)
    console.log(`   Found ${allTrips.data?.count || 0} trips`)
    if (allTrips.data?.items) {
      allTrips.data.items.forEach((trip, i) => {
        console.log(`   ${i + 1}. ${trip.name} (${trip.status}) - Tags: ${trip.tags.join(', ')}`)
      })
    }
    console.log('')
    
    // Test 2: Search by text
    console.log('2️⃣ Testing: Search for "mountain"')
    const searchResults = await makeRequest('GET', '/api/trips?search=mountain')
    console.log(`   Status: ${searchResults.status}`)
    console.log(`   Found ${searchResults.data?.count || 0} trips matching "mountain"`)
    if (searchResults.data?.items) {
      searchResults.data.items.forEach((trip, i) => {
        console.log(`   ${i + 1}. ${trip.name} - ${trip.description}`)
      })
    }
    console.log('')
    
    // Test 3: Filter by status
    console.log('3️⃣ Testing: Filter by status "active"')
    const activeTrips = await makeRequest('GET', '/api/trips?status=active')
    console.log(`   Status: ${activeTrips.status}`)
    console.log(`   Found ${activeTrips.data?.count || 0} active trips`)
    if (activeTrips.data?.items) {
      activeTrips.data.items.forEach((trip, i) => {
        console.log(`   ${i + 1}. ${trip.name} (${trip.status})`)
      })
    }
    console.log('')
    
    // Test 4: Filter by tag
    console.log('4️⃣ Testing: Filter by tag "food"')
    const foodTrips = await makeRequest('GET', '/api/trips?tag=food')
    console.log(`   Status: ${foodTrips.status}`)
    console.log(`   Found ${foodTrips.data?.count || 0} trips with "food" tag`)
    if (foodTrips.data?.items) {
      foodTrips.data.items.forEach((trip, i) => {
        console.log(`   ${i + 1}. ${trip.name} - Tags: ${trip.tags.join(', ')}`)
      })
    }
    console.log('')
    
    // Test 5: Sorting
    console.log('5️⃣ Testing: Sort by name (ascending)')
    const sortedTrips = await makeRequest('GET', '/api/trips?sortBy=name&sortOrder=asc')
    console.log(`   Status: ${sortedTrips.status}`)
    if (sortedTrips.data?.items) {
      console.log('   Trips sorted by name:')
      sortedTrips.data.items.forEach((trip, i) => {
        console.log(`   ${i + 1}. ${trip.name}`)
      })
    }
    console.log('')
    
    // Test 6: Search suggestions
    console.log('6️⃣ Testing: Search suggestions for "mou"')
    const suggestions = await makeRequest('GET', '/api/trips/suggestions?q=mou')
    console.log(`   Status: ${suggestions.status}`)
    if (suggestions.data) {
      console.log(`   Name suggestions: ${suggestions.data.names?.join(', ') || 'none'}`)
      console.log(`   Tag suggestions: ${suggestions.data.tags?.join(', ') || 'none'}`)
      console.log(`   Description suggestions: ${suggestions.data.descriptions?.join(', ') || 'none'}`)
    }
    console.log('')
    
    // Test 7: Trip statistics
    console.log('7️⃣ Testing: Trip statistics')
    const stats = await makeRequest('GET', '/api/trips/stats')
    console.log(`   Status: ${stats.status}`)
    if (stats.data) {
      console.log(`   Total trips: ${stats.data.total}`)
      console.log(`   By status: ${JSON.stringify(stats.data.byStatus)}`)
      console.log(`   Top tags: ${stats.data.topTags?.map(t => `${t.tag}(${t.count})`).join(', ')}`)
      console.log(`   Recent activity: ${stats.data.recentActivity}`)
    }
    console.log('')
    
    // Test 8: Create a new trip
    console.log('8️⃣ Testing: Create new trip')
    const newTrip = {
      name: 'Test Adventure',
      description: 'A test trip created by the search functionality test',
      status: 'draft',
      tags: ['test', 'api', 'search'],
      isPublic: false,
      anchors: [
        { lat: 37.7749, lng: -122.4194, name: 'San Francisco' }
      ]
    }
    const createResult = await makeRequest('POST', '/api/trips', newTrip)
    console.log(`   Status: ${createResult.status}`)
    if (createResult.data) {
      console.log(`   Created trip: ${createResult.data.trip?.name} (ID: ${createResult.data.tripId})`)
    }
    console.log('')
    
    // Test 9: Combined filters
    console.log('9️⃣ Testing: Combined search + tag filter')
    const combinedSearch = await makeRequest('GET', '/api/trips?search=test&tag=api&sortBy=createdAt&sortOrder=desc')
    console.log(`   Status: ${combinedSearch.status}`)
    console.log(`   Found ${combinedSearch.data?.count || 0} trips matching search="test" AND tag="api"`)
    if (combinedSearch.data?.items) {
      combinedSearch.data.items.forEach((trip, i) => {
        console.log(`   ${i + 1}. ${trip.name} - Tags: ${trip.tags.join(', ')}`)
      })
    }
    console.log('')
    
    console.log('✅ Advanced Search Functionality Test Complete!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testTripsAPI()
