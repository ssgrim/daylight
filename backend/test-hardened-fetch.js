// Test script to verify hardened Google Places fetch
const { timeoutFetch, retryWithBackoff, mapToApiError } = require('./src/lib/http-utils.js');

async function testHardenedFetch() {
  console.log('Testing hardened fetch utilities...');
  
  // Test 1: Timeout functionality
  console.log('\n1. Testing timeout (should fail fast):');
  try {
    // Using a deliberately slow endpoint
    await timeoutFetch('https://httpbin.org/delay/10', {}, 2000);
    console.log('❌ Timeout test failed - should have timed out');
  } catch (err) {
    if (err.message.includes('timeout')) {
      console.log('✅ Timeout test passed:', err.message);
    } else {
      console.log('❌ Timeout test failed with unexpected error:', err.message);
    }
  }
  
  // Test 2: Retry with 5xx
  console.log('\n2. Testing retry with 5xx status:');
  let attempt = 0;
  try {
    await retryWithBackoff(async () => {
      attempt++;
      console.log(`  Attempt ${attempt}`);
      return await timeoutFetch('https://httpbin.org/status/502', {}, 3000);
    }, 3, 100);
  } catch (err) {
    console.log(`✅ Retry test completed after ${attempt} attempts`);
  }
  
  // Test 3: Fast-fail with 4xx
  console.log('\n3. Testing fast-fail with 4xx status:');
  attempt = 0;
  try {
    const result = await retryWithBackoff(async () => {
      attempt++;
      console.log(`  Attempt ${attempt}`);
      return await timeoutFetch('https://httpbin.org/status/404', {}, 3000);
    }, 3, 100);
    
    if (attempt === 1 && result.status === 404) {
      console.log('✅ Fast-fail test passed - no retries on 4xx');
    } else {
      console.log('❌ Fast-fail test failed - should not retry 4xx');
    }
  } catch (err) {
    console.log('❌ Fast-fail test failed with error:', err.message);
  }
  
  // Test 4: Error mapping
  console.log('\n4. Testing error mapping:');
  const timeoutError = new Error('Request timeout after 5000ms');
  const networkError = new Error('Network connection failed');
  const response5xx = { status: 503 };
  const response4xx = { status: 400 };
  
  console.log('  Timeout error maps to:', mapToApiError(timeoutError));
  console.log('  Network error maps to:', mapToApiError(networkError));
  console.log('  5xx response maps to:', mapToApiError(response5xx));
  console.log('  4xx response maps to:', mapToApiError(response4xx));
  
  console.log('\n✅ All tests completed!');
}

testHardenedFetch().catch(console.error);
