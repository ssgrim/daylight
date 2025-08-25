import { strict as assert } from 'assert'
import { describe, it } from 'node:test'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { handler: tripsHandler } = require('../dist/trips.js')
const { handler: planHandler } = require('../dist/plan.js')
const { handler: healthHandler } = require('../dist/health.js')

// Helper to create mock API Gateway events
function createMockEvent(method, path, body = null, queryParams = null, pathParams = null, headers = {}) {
  return {
    requestContext: {
      http: {
        method,
        path
      }
    },
    body: body ? JSON.stringify(body) : null,
    queryStringParameters: queryParams,
    pathParameters: pathParams,
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer test-token',
      ...headers
    }
  }
}

describe('Handler Integration Tests', () => {
  describe('Trips Handler', () => {
    it('creates a new trip with valid data', async () => {
      const tripData = {
        tripId: 'test-trip-1',
        name: 'Test Trip',
        anchors: [
          {
            id: 'anchor-1',
            name: 'Starting Point',
            start: '2025-08-24T10:00:00.000Z',
            end: '2025-08-24T11:00:00.000Z',
            lat: 47.6062,
            lng: -122.3321
          }
        ]
      }

      const event = createMockEvent('POST', '/trips', tripData)
      const response = await tripsHandler(event)

      assert.equal(response.statusCode, 201)
      const responseBody = JSON.parse(response.body)
      assert.equal(responseBody.tripId, tripData.tripId)
      assert.equal(responseBody.name, tripData.name)
      assert(responseBody.createdAt)
    })

    it('rejects trip creation with invalid data', async () => {
      const invalidTripData = {
        tripId: '', // Invalid: empty ID
        name: 'Invalid Trip'
      }

      const event = createMockEvent('POST', '/trips', invalidTripData)
      const response = await tripsHandler(event)

      assert.equal(response.statusCode, 400)
      const responseBody = JSON.parse(response.body)
      assert.equal(responseBody.error, 'VALIDATION_ERROR')
      assert(Array.isArray(responseBody.validationErrors))
    })

    it('requires authorization for trip operations', async () => {
      const tripData = {
        tripId: 'test-trip-1',
        name: 'Test Trip'
      }

      const event = createMockEvent('POST', '/trips', tripData, null, null, {})
      delete event.headers.authorization

      const response = await tripsHandler(event)

      assert.equal(response.statusCode, 401)
      const responseBody = JSON.parse(response.body)
      assert.equal(responseBody.error, 'UNAUTHORIZED')
    })

    it('gets an existing trip', async () => {
      // First create a trip
      const tripData = {
        tripId: 'test-trip-get',
        name: 'Trip to Get'
      }

      const createEvent = createMockEvent('POST', '/trips', tripData)
      await tripsHandler(createEvent)

      // Then get the trip
      const getEvent = createMockEvent('GET', '/trips/test-trip-get', null, null, { tripId: 'test-trip-get' })
      const response = await tripsHandler(getEvent)

      assert.equal(response.statusCode, 200)
      const responseBody = JSON.parse(response.body)
      assert.equal(responseBody.tripId, tripData.tripId)
      assert.equal(responseBody.name, tripData.name)
    })

    it('returns 404 for non-existent trip', async () => {
      const event = createMockEvent('GET', '/trips/non-existent', null, null, { tripId: 'non-existent' })
      const response = await tripsHandler(event)

      assert.equal(response.statusCode, 404)
      const responseBody = JSON.parse(response.body)
      assert.equal(responseBody.error, 'NOT_FOUND')
    })

    it('updates an existing trip', async () => {
      // First create a trip
      const tripData = {
        tripId: 'test-trip-update',
        name: 'Original Name'
      }

      const createEvent = createMockEvent('POST', '/trips', tripData)
      await tripsHandler(createEvent)

      // Then update the trip
      const updateData = {
        name: 'Updated Name'
      }

      const updateEvent = createMockEvent('PUT', '/trips/test-trip-update', updateData, null, { tripId: 'test-trip-update' })
      const response = await tripsHandler(updateEvent)

      assert.equal(response.statusCode, 200)
      const responseBody = JSON.parse(response.body)
      assert.equal(responseBody.tripId, tripData.tripId)
      assert.equal(responseBody.name, updateData.name)
    })

    it('deletes an existing trip', async () => {
      // First create a trip
      const tripData = {
        tripId: 'test-trip-delete',
        name: 'Trip to Delete'
      }

      const createEvent = createMockEvent('POST', '/trips', tripData)
      await tripsHandler(createEvent)

      // Then delete the trip
      const deleteEvent = createMockEvent('DELETE', '/trips/test-trip-delete', null, null, { tripId: 'test-trip-delete' })
      const response = await tripsHandler(deleteEvent)

      assert.equal(response.statusCode, 200)
      const responseBody = JSON.parse(response.body)
      assert.equal(responseBody.tripId, tripData.tripId)

      // Verify trip is actually deleted
      const getEvent = createMockEvent('GET', '/trips/test-trip-delete', null, null, { tripId: 'test-trip-delete' })
      const getResponse = await tripsHandler(getEvent)
      assert.equal(getResponse.statusCode, 404)
    })

    it('handles OPTIONS requests for CORS', async () => {
      const event = createMockEvent('OPTIONS', '/trips')
      const response = await tripsHandler(event)

      assert.equal(response.statusCode, 204)
      assert(response.headers['Access-Control-Allow-Origin'])
      assert(response.headers['Access-Control-Allow-Methods'])
    })
  })

  describe('Plan Handler', () => {
    it('handles GET request with lat/lng coordinates', async () => {
      const queryParams = {
        lat: '47.6062',
        lng: '-122.3321'
      }

      const event = createMockEvent('GET', '/plan', null, queryParams)
      const response = await planHandler(event)

      assert.equal(response.statusCode, 200)
      const responseBody = JSON.parse(response.body)
      assert(Array.isArray(responseBody))
      assert(responseBody.length > 0)
      
      const suggestion = responseBody[0]
      assert(suggestion.id)
      assert(suggestion.title)
      assert(suggestion.start)
      assert(suggestion.end)
      assert(typeof suggestion.score === 'number')
    })

    it('rejects GET request with invalid coordinates', async () => {
      const queryParams = {
        lat: 'invalid',
        lng: '-122.3321'
      }

      const event = createMockEvent('GET', '/plan', null, queryParams)
      const response = await planHandler(event)

      assert.equal(response.statusCode, 400)
      const responseBody = JSON.parse(response.body)
      assert.equal(responseBody.error, 'VALIDATION_ERROR')
    })

    it('handles POST request with plan data', async () => {
      const planRequest = {
        suggestFor: 'lunch',
        now: '2025-08-24T12:00:00.000Z',
        anchors: [
          {
            id: 'anchor-1',
            name: 'Current Location',
            start: '2025-08-24T12:00:00.000Z',
            end: '2025-08-24T13:00:00.000Z',
            lat: 47.6062,
            lng: -122.3321
          }
        ]
      }

      const event = createMockEvent('POST', '/plan', planRequest)
      const response = await planHandler(event)

      assert.equal(response.statusCode, 200)
      const responseBody = JSON.parse(response.body)
      assert(Array.isArray(responseBody))
      assert(responseBody.length > 0)
    })

    it('rejects POST request with invalid plan data', async () => {
      const invalidPlanRequest = {
        // Missing required suggestFor field
        now: '2025-08-24T12:00:00.000Z'
      }

      const event = createMockEvent('POST', '/plan', invalidPlanRequest)
      const response = await planHandler(event)

      assert.equal(response.statusCode, 400)
      const responseBody = JSON.parse(response.body)
      assert.equal(responseBody.error, 'VALIDATION_ERROR')
    })

    it('returns 405 for unsupported methods', async () => {
      const event = createMockEvent('PUT', '/plan')
      const response = await planHandler(event)

      assert.equal(response.statusCode, 405)
      const responseBody = JSON.parse(response.body)
      assert.equal(responseBody.error, 'METHOD_NOT_ALLOWED')
    })
  })

  describe('Health Handler', () => {
    it('returns health status', async () => {
      const event = createMockEvent('GET', '/health')
      const response = await healthHandler(event)

      // Should return 200 or 503 depending on health
      assert(response.statusCode === 200 || response.statusCode === 503)
      
      const responseBody = JSON.parse(response.body)
      assert(responseBody.status)
      assert(responseBody.timestamp)
      assert(['healthy', 'degraded', 'unhealthy'].includes(responseBody.status))
      
      if (responseBody.checks) {
        for (const [checkName, checkResult] of Object.entries(responseBody.checks)) {
          assert(['pass', 'fail', 'warn'].includes(checkResult.status))
        }
      }
    })
  })

  describe('Error Handling', () => {
    it('handles malformed JSON gracefully', async () => {
      const event = {
        requestContext: {
          http: {
            method: 'POST',
            path: '/trips'
          }
        },
        body: 'invalid-json-{',
        headers: {
          'authorization': 'Bearer test-token'
        }
      }

      const response = await tripsHandler(event)

      assert.equal(response.statusCode, 400)
      const responseBody = JSON.parse(response.body)
      assert.equal(responseBody.error, 'VALIDATION_ERROR')
    })

    it('includes CORS headers in error responses', async () => {
      const event = createMockEvent('POST', '/trips', { invalid: 'data' })
      const response = await tripsHandler(event)

      assert(response.headers['Access-Control-Allow-Origin'])
      assert(response.headers['Access-Control-Allow-Methods'])
      assert(response.headers['Access-Control-Allow-Headers'])
    })

    it('sanitizes error messages for security', async () => {
      const event = createMockEvent('GET', '/trips/test', null, null, { tripId: 'test' })
      const response = await tripsHandler(event)

      const responseBody = JSON.parse(response.body)
      // Error messages should not expose internal details
      assert(!responseBody.message.includes('database'))
      assert(!responseBody.message.includes('internal'))
    })
  })

  describe('Response Validation', () => {
    it('validates response structure for trips', async () => {
      const tripData = {
        tripId: 'response-validation-test',
        name: 'Test Response Validation'
      }

      const event = createMockEvent('POST', '/trips', tripData)
      const response = await tripsHandler(event)

      assert.equal(response.statusCode, 201)
      const responseBody = JSON.parse(response.body)
      
      // Check required fields are present and valid
      assert(responseBody.tripId)
      assert(responseBody.createdAt)
      assert(new Date(responseBody.createdAt).toISOString() === responseBody.createdAt)
    })

    it('validates response structure for plan suggestions', async () => {
      const event = createMockEvent('GET', '/plan', null, { lat: '47.6062', lng: '-122.3321' })
      const response = await planHandler(event)

      assert.equal(response.statusCode, 200)
      const responseBody = JSON.parse(response.body)
      
      assert(Array.isArray(responseBody))
      responseBody.forEach(suggestion => {
        assert(suggestion.id)
        assert(suggestion.title)
        assert(suggestion.start)
        assert(suggestion.end)
        assert(typeof suggestion.score === 'number')
        assert(suggestion.score >= 0 && suggestion.score <= 100)
        
        // Validate datetime formats
        assert(new Date(suggestion.start).toISOString() === suggestion.start)
        assert(new Date(suggestion.end).toISOString() === suggestion.end)
      })
    })
  })
})
