import { strict as assert } from 'assert'
import { describe, it } from 'node:test'

// Import validation schemas from compiled ES modules
import { 
  AnchorSchema,
  TripCreateSchema,
  TripUpdateSchema,
  PlanRequestSchema,
  LatLngQuerySchema,
  PaginationQuerySchema,
  SuggestionSchema
} from '../dist/lib/validation.js'

// Import middleware functions from compiled ES modules
import { 
  ValidationError,
  formatZodErrors,
  validateBody,
  validateQuery,
  validateParams
} from '../dist/lib/middleware.js'

describe('Data Validation Tests', () => {
  describe('AnchorSchema', () => {
    it('validates valid anchor data', () => {
      const validAnchor = {
        id: 'anchor-1',
        name: 'Starting Point',
        start: '2025-08-24T10:00:00.000Z',
        end: '2025-08-24T11:00:00.000Z',
        lat: 47.6062,
        lng: -122.3321,
        locked: true
      }

      const result = AnchorSchema.parse(validAnchor)
      assert.deepEqual(result, validAnchor)
    })

    it('rejects anchor with invalid coordinates', () => {
      const invalidAnchor = {
        id: 'anchor-1',
        name: 'Invalid Location',
        start: '2025-08-24T10:00:00.000Z',
        end: '2025-08-24T11:00:00.000Z',
        lat: 91, // Invalid latitude
        lng: -122.3321
      }

      assert.throws(() => AnchorSchema.parse(invalidAnchor))
    })

    it('rejects anchor with end time before start time', () => {
      const invalidAnchor = {
        id: 'anchor-1',
        name: 'Time Travel',
        start: '2025-08-24T11:00:00.000Z',
        end: '2025-08-24T10:00:00.000Z', // End before start
        lat: 47.6062,
        lng: -122.3321
      }

      assert.throws(() => AnchorSchema.parse(invalidAnchor))
    })

    it('rejects anchor with invalid ID format', () => {
      const invalidAnchor = {
        id: 'anchor with spaces!',
        name: 'Bad ID',
        start: '2025-08-24T10:00:00.000Z',
        end: '2025-08-24T11:00:00.000Z',
        lat: 47.6062,
        lng: -122.3321
      }

      assert.throws(() => AnchorSchema.parse(invalidAnchor))
    })
  })

  describe('TripCreateSchema', () => {
    it('validates valid trip creation data', () => {
      const validTrip = {
        tripId: 'trip-123',
        name: 'Weekend Getaway',
        anchors: [
          {
            id: 'anchor-1',
            name: 'Hotel',
            start: '2025-08-24T10:00:00.000Z',
            end: '2025-08-24T11:00:00.000Z',
            lat: 47.6062,
            lng: -122.3321
          }
        ]
      }

      const result = TripCreateSchema.parse(validTrip)
      assert.equal(result.tripId, validTrip.tripId)
      assert.equal(result.name, validTrip.name)
      assert.equal(result.anchors.length, 1)
    })

    it('provides default empty anchors array', () => {
      const tripWithoutAnchors = {
        tripId: 'trip-123',
        name: 'Simple Trip'
      }

      const result = TripCreateSchema.parse(tripWithoutAnchors)
      assert.deepEqual(result.anchors, [])
    })

    it('rejects trip with too many anchors', () => {
      const anchors = Array.from({ length: 51 }, (_, i) => ({
        id: `anchor-${i}`,
        name: `Anchor ${i}`,
        start: '2025-08-24T10:00:00.000Z',
        end: '2025-08-24T11:00:00.000Z',
        lat: 47.6062,
        lng: -122.3321
      }))

      const tripWithTooManyAnchors = {
        tripId: 'trip-123',
        name: 'Overloaded Trip',
        anchors
      }

      assert.throws(() => TripCreateSchema.parse(tripWithTooManyAnchors))
    })
  })

  describe('PlanRequestSchema', () => {
    it('validates valid plan request', () => {
      const validRequest = {
        suggestFor: 'lunch',
        now: '2025-08-24T12:00:00.000Z',
        tripId: 'trip-123',
        anchors: [
          {
            id: 'anchor-1',
            name: 'Current Location',
            start: '2025-08-24T12:00:00.000Z',
            end: '2025-08-24T13:00:00.000Z',
            lat: 47.6062,
            lng: -122.3321
          }
        ],
        prefs: {
          heatMaxF: 85,
          driveCapMin: 30,
          weights: {
            distance: 8,
            rating: 6,
            openNow: 10
          }
        }
      }

      const result = PlanRequestSchema.parse(validRequest)
      assert.equal(result.suggestFor, 'lunch')
      assert.equal(result.tripId, 'trip-123')
      assert.equal(result.prefs?.heatMaxF, 85)
    })

    it('rejects request with invalid preference weights', () => {
      const invalidRequest = {
        suggestFor: 'lunch',
        prefs: {
          weights: {
            distance: 15 // Invalid: exceeds max of 10
          }
        }
      }

      assert.throws(() => PlanRequestSchema.parse(invalidRequest))
    })
  })

  describe('LatLngQuerySchema', () => {
    it('validates and transforms valid coordinates', () => {
      const validQuery = {
        lat: '47.6062',
        lng: '-122.3321'
      }

      const result = LatLngQuerySchema.parse(validQuery)
      assert.equal(typeof result.lat, 'number')
      assert.equal(typeof result.lng, 'number')
      assert.equal(result.lat, 47.6062)
      assert.equal(result.lng, -122.3321)
    })

    it('rejects invalid coordinate strings', () => {
      const invalidQuery = {
        lat: 'not-a-number',
        lng: '-122.3321'
      }

      assert.throws(() => LatLngQuerySchema.parse(invalidQuery))
    })
  })

  describe('SuggestionSchema', () => {
    it('validates valid suggestion data', () => {
      const validSuggestion = {
        id: 'sug-1',
        title: 'Great Restaurant',
        start: '2025-08-24T12:00:00.000Z',
        end: '2025-08-24T13:00:00.000Z',
        score: 85,
        reason: 'Highly rated nearby option'
      }

      const result = SuggestionSchema.parse(validSuggestion)
      assert.deepEqual(result, validSuggestion)
    })

    it('rejects suggestion with invalid score', () => {
      const invalidSuggestion = {
        id: 'sug-1',
        title: 'Bad Score',
        start: '2025-08-24T12:00:00.000Z',
        end: '2025-08-24T13:00:00.000Z',
        score: 150 // Invalid: exceeds max of 100
      }

      assert.throws(() => SuggestionSchema.parse(invalidSuggestion))
    })
  })

  describe('Middleware Functions', () => {
    it('validateBody parses valid JSON and validates', () => {
      const validBody = JSON.stringify({
        tripId: 'trip-123',
        name: 'Test Trip'
      })

      const result = validateBody(validBody, TripCreateSchema)
      assert.equal(result.tripId, 'trip-123')
      assert.equal(result.name, 'Test Trip')
    })

    it('validateBody throws ValidationError for invalid JSON', () => {
      const invalidBody = 'not-json'

      assert.throws(
        () => validateBody(invalidBody, TripCreateSchema),
        ValidationError
      )
    })

    it('validateBody throws ValidationError for missing required fields', () => {
      const invalidBody = JSON.stringify({
        name: 'Trip without ID'
        // Missing required tripId
      })

      assert.throws(
        () => validateBody(invalidBody, TripCreateSchema),
        ValidationError
      )
    })

    it('validateQuery handles optional parameters', () => {
      const query = { limit: '50' }
      const result = validateQuery(query, PaginationQuerySchema)
      assert.equal(result.limit, 50)
      assert.equal(result.offset, 0) // Default value
    })

    it('formatZodErrors creates readable error messages', () => {
      try {
        AnchorSchema.parse({
          id: '',
          name: '',
          start: 'invalid-date',
          end: 'invalid-date',
          lat: 100,
          lng: 200
        })
      } catch (error) {
        const formatted = formatZodErrors(error)
        assert(Array.isArray(formatted))
        assert(formatted.length > 0)
        assert(formatted.every(issue => 
          typeof issue.field === 'string' && 
          typeof issue.message === 'string' &&
          typeof issue.code === 'string'
        ))
      }
    })
  })

  describe('Edge Cases', () => {
    it('handles null and undefined values appropriately', () => {
      assert.throws(() => validateBody(null, TripCreateSchema))
      assert.throws(() => validateBody(undefined, TripCreateSchema))
    })

    it('trims whitespace in string fields', () => {
      const tripWithWhitespace = {
        tripId: 'trip-123',
        name: '  Whitespace Trip  '
      }

      const result = TripCreateSchema.parse(tripWithWhitespace)
      assert.equal(result.name, 'Whitespace Trip')
    })

    it('validates maximum string lengths', () => {
      const longName = 'x'.repeat(301)
      const tripWithLongName = {
        tripId: 'trip-123',
        name: longName
      }

      assert.throws(() => TripCreateSchema.parse(tripWithLongName))
    })

    it('validates datetime formats strictly', () => {
      const invalidDates = [
        '2025-08-24', // Missing time
        '2025-08-24T12:00:00', // Missing timezone
        '2025-13-45T25:70:70.000Z', // Invalid values
        'not-a-date'
      ]

      invalidDates.forEach(invalidDate => {
        const anchor = {
          id: 'test',
          name: 'Test',
          start: invalidDate,
          end: '2025-08-24T13:00:00.000Z',
          lat: 47.6062,
          lng: -122.3321
        }

        assert.throws(() => AnchorSchema.parse(anchor))
      })
    })
  })
})
