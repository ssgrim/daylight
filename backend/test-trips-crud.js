/**
 * Integration tests for trips CRUD operations
 * 
 * This test file verifies all trip operations including:
 * - Create trip (POST /trips)
 * - List trips (GET /trips) with pagination, filtering, and sorting
 * - Get single trip (GET /trips/{id})
 * - Update trip (PUT /trips/{id})
 * - Delete trip (DELETE /trips/{id})
 */

const API_BASE_URL = 'http://localhost:5174/api';
const DEV_TOKEN = 'dev-token'; // Development token for testing

// Helper function to make API requests
async function apiRequest(method, endpoint, body, queryParams) {
  let url = `${API_BASE_URL}${endpoint}`;
  
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEV_TOKEN}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Test data
const testTrips = [
  {
    name: 'Mountain Adventure',
    description: 'A thrilling mountain climbing experience',
    status: 'draft',
    tags: ['adventure', 'mountains', 'outdoors'],
    isPublic: false,
    anchors: [
      { lat: 40.7589, lng: -73.9851, name: 'Times Square' },
      { lat: 40.7505, lng: -73.9934, name: 'Empire State Building' }
    ],
    preferences: { difficulty: 'hard', duration: '3 days' }
  },
  {
    name: 'Beach Relaxation',
    description: 'A peaceful beach vacation',
    status: 'active',
    tags: ['beach', 'relaxation', 'vacation'],
    isPublic: true,
    anchors: [
      { lat: 25.7617, lng: -80.1918, name: 'Miami Beach' }
    ],
    preferences: { difficulty: 'easy', duration: '1 week' }
  },
  {
    name: 'City Tour',
    description: 'Exploring the urban landscape',
    status: 'completed',
    tags: ['city', 'culture', 'sightseeing'],
    isPublic: false,
    anchors: [
      { lat: 40.7831, lng: -73.9712, name: 'Central Park' }
    ]
  }
];

// Test functions
async function testCreateTrips() {
  console.log('🧪 Testing trip creation...');
  const tripIds = [];

  for (const [index, tripData] of testTrips.entries()) {
    console.log(`  Creating trip ${index + 1}: ${tripData.name}`);
    
    const response = await apiRequest('POST', '/trips', tripData);
    
    if (response.status === 201) {
      console.log(`  ✅ Trip created: ${response.data.tripId}`);
      tripIds.push(response.data.tripId);
    } else {
      console.error(`  ❌ Failed to create trip: ${response.status}`, response.data);
    }
  }

  return tripIds;
}

async function testListTrips() {
  console.log('🧪 Testing trip listing...');

  // Test basic listing
  const basicResponse = await apiRequest('GET', '/trips');
  console.log(`  Basic list: ${basicResponse.status}`, {
    count: basicResponse.data.count,
    hasMore: basicResponse.data.hasMore
  });

  // Test with pagination
  const paginatedResponse = await apiRequest('GET', '/trips', undefined, { limit: '2' });
  console.log(`  Paginated list (limit 2): ${paginatedResponse.status}`, {
    count: paginatedResponse.data.count,
    hasMore: paginatedResponse.data.hasMore
  });

  // Test filtering by status
  const filteredResponse = await apiRequest('GET', '/trips', undefined, { status: 'active' });
  console.log(`  Filtered by status 'active': ${filteredResponse.status}`, {
    count: filteredResponse.data.count
  });

  // Test filtering by tag
  const tagFilteredResponse = await apiRequest('GET', '/trips', undefined, { tag: 'adventure' });
  console.log(`  Filtered by tag 'adventure': ${tagFilteredResponse.status}`, {
    count: tagFilteredResponse.data.count
  });

  // Test search
  const searchResponse = await apiRequest('GET', '/trips', undefined, { search: 'mountain' });
  console.log(`  Search for 'mountain': ${searchResponse.status}`, {
    count: searchResponse.data.count
  });

  // Test sorting
  const sortedResponse = await apiRequest('GET', '/trips', undefined, { 
    sortBy: 'name', 
    sortOrder: 'asc' 
  });
  console.log(`  Sorted by name (asc): ${sortedResponse.status}`, {
    count: sortedResponse.data.count,
    firstItemName: sortedResponse.data.items?.[0]?.name
  });
}

async function testGetSingleTrip(tripId) {
  console.log('🧪 Testing single trip retrieval...');

  const response = await apiRequest('GET', `/trips/${tripId}`);
  
  if (response.status === 200) {
    console.log(`  ✅ Retrieved trip: ${response.data.name}`);
  } else {
    console.error(`  ❌ Failed to retrieve trip: ${response.status}`, response.data);
  }
}

async function testUpdateTrip(tripId) {
  console.log('🧪 Testing trip update...');

  const updateData = {
    name: 'Updated Mountain Adventure',
    description: 'An updated thrilling mountain climbing experience',
    status: 'active',
    tags: ['adventure', 'mountains', 'outdoors', 'updated']
  };

  const response = await apiRequest('PUT', `/trips/${tripId}`, updateData);
  
  if (response.status === 200) {
    console.log(`  ✅ Updated trip: ${response.data.trip.name}`);
  } else {
    console.error(`  ❌ Failed to update trip: ${response.status}`, response.data);
  }
}

async function testDeleteTrip(tripId) {
  console.log('🧪 Testing trip deletion...');

  const response = await apiRequest('DELETE', `/trips/${tripId}`);
  
  if (response.status === 204) {
    console.log(`  ✅ Deleted trip: ${tripId}`);
  } else {
    console.error(`  ❌ Failed to delete trip: ${response.status}`, response.data);
  }
}

async function testErrorCases() {
  console.log('🧪 Testing error cases...');

  // Test unauthorized access (without token)
  try {
    const response = await fetch(`${API_BASE_URL}/trips`);
    console.log(`  Unauthorized access: ${response.status}`);
  } catch (error) {
    console.log(`  Unauthorized access test failed: ${error}`);
  }

  // Test invalid trip ID
  const invalidResponse = await apiRequest('GET', '/trips/invalid-id');
  console.log(`  Invalid trip ID: ${invalidResponse.status}`);

  // Test invalid input
  const invalidInputResponse = await apiRequest('POST', '/trips', {
    name: '', // Empty name should fail validation
  });
  console.log(`  Invalid input: ${invalidInputResponse.status}`, invalidInputResponse.data);
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting TRIPS CRUD Integration Tests');
  console.log('=====================================');

  try {
    // 1. Create test trips
    const tripIds = await testCreateTrips();
    console.log('');

    // 2. Test listing with various options
    await testListTrips();
    console.log('');

    // 3. Test retrieving a single trip
    if (tripIds.length > 0) {
      await testGetSingleTrip(tripIds[0]);
      console.log('');
    }

    // 4. Test updating a trip
    if (tripIds.length > 0) {
      await testUpdateTrip(tripIds[0]);
      console.log('');
    }

    // 5. Test error cases
    await testErrorCases();
    console.log('');

    // 6. Clean up - delete test trips
    console.log('🧹 Cleaning up test data...');
    for (const tripId of tripIds) {
      await testDeleteTrip(tripId);
    }

    console.log('');
    console.log('✅ All tests completed!');

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run tests if this file is executed directly
if (typeof module !== 'undefined' && require.main === module) {
  // Add fetch polyfill for Node.js
  global.fetch = require('node-fetch');
  runAllTests();
}

// Export for use in other test files
module.exports = {
  runAllTests,
  testCreateTrips,
  testListTrips,
  testGetSingleTrip,
  testUpdateTrip,
  testDeleteTrip,
  testErrorCases
};
