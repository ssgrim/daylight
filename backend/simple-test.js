// Simple test to verify trips API
import http from 'http'

function testAPI() {
  const options = {
    hostname: 'localhost',
    port: 5174,
    path: '/api/trips',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer dev-token',
      'Content-Type': 'application/json'
    }
  }

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`)
    console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`)
    
    let data = ''
    res.on('data', (chunk) => {
      data += chunk
    })
    
    res.on('end', () => {
      console.log('Response body:')
      try {
        const parsed = JSON.parse(data)
        console.log(JSON.stringify(parsed, null, 2))
      } catch (e) {
        console.log(data)
      }
    })
  })

  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`)
  })

  req.end()
}

console.log('Testing trips API...')
testAPI()
