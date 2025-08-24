// Test script for caching functionality
const { LRUCache } = require('./src/lib/lru-cache.js');
const { getCached, setCached, getCacheControlHeader, withCache } = require('./src/lib/cache-layer.js');

async function testCaching() {
  console.log('Testing caching functionality...\n');

  // Test 1: LRU Cache basic functionality
  console.log('1. Testing LRU Cache:');
  const lru = new LRUCache(3);
  
  lru.set('a', 'value-a');
  lru.set('b', 'value-b');
  lru.set('c', 'value-c');
  
  console.log('  Set a, b, c');
  console.log('  Get a:', lru.get('a')); // Should move 'a' to end
  
  lru.set('d', 'value-d'); // Should evict 'b' (least recently used)
  
  console.log('  After adding d:');
  console.log('    Has a:', lru.has('a')); // true
  console.log('    Has b:', lru.has('b')); // false (evicted)
  console.log('    Has c:', lru.has('c')); // true
  console.log('    Has d:', lru.has('d')); // true
  
  // Test 2: Cache layer with TTL
  console.log('\n2. Testing cache layer with TTL:');
  
  // Set with short TTL
  await setCached('test', 'key1', { data: 'test-value' }, { ttlSeconds: 2 });
  
  let cached = await getCached('test', 'key1');
  console.log('  Immediate retrieval:', cached ? 'HIT' : 'MISS');
  
  // Wait for expiration
  console.log('  Waiting 3 seconds for expiration...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  cached = await getCached('test', 'key1');
  console.log('  After expiration:', cached ? 'HIT' : 'MISS');
  
  // Test 3: withCache wrapper
  console.log('\n3. Testing withCache wrapper:');
  
  let callCount = 0;
  const expensiveFunction = async (input) => {
    callCount++;
    console.log(`  Expensive function called with: ${input} (call #${callCount})`);
    return { result: `processed-${input}`, timestamp: Date.now() };
  };
  
  const cachedFunction = withCache(expensiveFunction, 'expensive', {
    ttlSeconds: 5,
    keyParams: (input) => input // Use input as cache key
  });
  
  console.log('  First call:');
  await cachedFunction('test-input');
  
  console.log('  Second call (should use cache):');
  await cachedFunction('test-input');
  
  console.log('  Third call with different input:');
  await cachedFunction('different-input');
  
  console.log(`  Total function calls: ${callCount} (should be 2)`);
  
  // Test 4: Cache control headers
  console.log('\n4. Testing cache control headers:');
  console.log('  Public, 1 hour:', getCacheControlHeader(3600, false));
  console.log('  Private, 30 min:', getCacheControlHeader(1800, true));
  
  console.log('\n✅ All caching tests completed!');
}

// Run tests
testCaching().catch(console.error);
