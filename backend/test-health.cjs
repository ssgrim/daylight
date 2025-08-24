const { handler } = require('./dist/health-test.cjs');

console.log('Testing health handler...');
console.log('Handler type:', typeof handler);

if (typeof handler === 'function') {
  handler().then(result => {
    console.log('Success! Response:');
    console.log(JSON.stringify(result, null, 2));
    
    const body = JSON.parse(result.body);
    console.log('\nParsed body:');
    console.log('ok:', body.ok);
    console.log('ts:', body.ts);
    
    if (body.ok === true && typeof body.ts === 'string') {
      console.log('\n✅ Health endpoint test PASSED');
    } else {
      console.log('\n❌ Health endpoint test FAILED - incorrect response format');
    }
  }).catch(error => {
    console.error('❌ Error executing handler:', error);
  });
} else {
  console.log('❌ Handler is not a function');
}
