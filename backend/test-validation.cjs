// Test script for validation functionality
const { validateQuery, validateCoordinates, validateWith, ValidationError } = require('./src/lib/validation.cjs');

async function testValidation() {
  console.log('Testing validation functionality...\n');

  // Test 1: Query validation
  console.log('1. Testing query validation:');
  
  // Valid queries
  try {
    const result = validateQuery('coffee shops');
    console.log('  ✅ Valid query:', result);
  } catch (e) {
    console.log('  ❌ Unexpected error:', e.message);
  }
  
  // Empty query
  try {
    validateQuery('');
    console.log('  ❌ Should have failed for empty query');
  } catch (e) {
    console.log('  ✅ Correctly rejected empty query:', e.message);
  }
  
  // Whitespace only
  try {
    validateQuery('   ');
    console.log('  ❌ Should have failed for whitespace-only query');
  } catch (e) {
    console.log('  ✅ Correctly rejected whitespace-only query:', e.message);
  }
  
  // Too long query
  try {
    const longQuery = 'a'.repeat(121);
    validateQuery(longQuery);
    console.log('  ❌ Should have failed for too-long query');
  } catch (e) {
    console.log('  ✅ Correctly rejected too-long query:', e.message);
  }
  
  // Non-string
  try {
    validateQuery(null);
    console.log('  ❌ Should have failed for null query');
  } catch (e) {
    console.log('  ✅ Correctly rejected null query:', e.message);
  }

  // Test 2: Coordinates validation
  console.log('\n2. Testing coordinates validation:');
  
  // Valid coordinates
  try {
    const result = validateCoordinates('37.7749', '-122.4194');
    console.log('  ✅ Valid coordinates:', result);
  } catch (e) {
    console.log('  ❌ Unexpected error:', e.message);
  }
  
  // Invalid latitude
  try {
    validateCoordinates('91', '0');
    console.log('  ❌ Should have failed for invalid latitude');
  } catch (e) {
    console.log('  ✅ Correctly rejected invalid latitude:', e.message);
  }
  
  // Invalid longitude
  try {
    validateCoordinates('0', '181');
    console.log('  ❌ Should have failed for invalid longitude');
  } catch (e) {
    console.log('  ✅ Correctly rejected invalid longitude:', e.message);
  }
  
  // Non-numeric values
  try {
    validateCoordinates('abc', 'xyz');
    console.log('  ❌ Should have failed for non-numeric coordinates');
  } catch (e) {
    console.log('  ✅ Correctly rejected non-numeric coordinates:', e.message);
  }

  // Test 3: validateWith wrapper
  console.log('\n3. Testing validateWith wrapper:');
  
  // Successful validation
  const validResult = validateWith(() => validateQuery('test query'));
  if (validResult.success) {
    console.log('  ✅ validateWith success case:', validResult.data);
  } else {
    console.log('  ❌ Unexpected validation failure');
  }
  
  // Failed validation
  const invalidResult = validateWith(() => validateQuery(''));
  if (!invalidResult.success) {
    console.log('  ✅ validateWith failure case: returns response object');
    console.log('    Status Code:', invalidResult.response.statusCode);
    const body = JSON.parse(invalidResult.response.body);
    console.log('    Error:', body.error);
    console.log('    Field:', body.field);
    console.log('    Type:', body.type);
  } else {
    console.log('  ❌ Should have failed validation');
  }

  // Test 4: Edge cases
  console.log('\n4. Testing edge cases:');
  
  // Exactly 120 characters
  try {
    const exactQuery = 'a'.repeat(120);
    const result = validateQuery(exactQuery);
    console.log('  ✅ Exactly 120 chars accepted, length:', result.length);
  } catch (e) {
    console.log('  ❌ Should accept exactly 120 chars:', e.message);
  }
  
  // Boundary coordinates
  try {
    const result = validateCoordinates('-90', '180');
    console.log('  ✅ Boundary coordinates accepted:', result);
  } catch (e) {
    console.log('  ❌ Should accept boundary coordinates:', e.message);
  }
  
  console.log('\n✅ All validation tests completed!');
}

// Run tests
testValidation().catch(console.error);
