import { strict as assert } from 'assert'
import { describe, it } from 'node:test'

// Simple fetch stub helper
async function withFetch(mockFn, fn) {
  const orig = global.fetch
  global.fetch = mockFn
  try { return await fn() } finally { global.fetch = orig }
}

import { fetchEvents } from '../src/lib/events.mjs'

describe('events adapter', () => {
  it('maps ticketmaster response to event model', async () => {
    const fakeResponse = {
      _embedded: {
        events: [
          {
            id: 'e1',
            name: 'Concert',
            dates: { start: { dateTime: '2025-09-01T20:00:00Z' } },
            _embedded: { venues: [{ name: 'The Venue', city: { name: 'Town' } }] },
            images: [{ url: 'https://img' }],
            url: 'https://tickets'
          }
        ]
      }
    }

    const origProvider = process.env.EVENTS_PROVIDER
    const origKey = process.env.EVENTS_API_KEY
    process.env.EVENTS_PROVIDER = 'ticketmaster'
    process.env.EVENTS_API_KEY = 'testkey'
    let results
    try {
      results = await withFetch((...args) => {
        // mimic Response shape
        // console.log('mock fetch called', args)
        return Promise.resolve({ ok: true, status: 200, json: async () => fakeResponse })
      }, async () => {
        return await fetchEvents(47.6, -122.33)
      })
    } finally {
      process.env.EVENTS_PROVIDER = origProvider
      process.env.EVENTS_API_KEY = origKey
    }

    // adapter returns { provider, events }
    assert.equal(typeof results, 'object')
    assert(Array.isArray(results.events))
    assert(results.events.length === 1)
    const ev = results.events[0]
    assert.equal(ev.id, 'e1')
    assert.equal(ev.name, 'Concert')
    assert.equal(ev.venue, 'The Venue')
    assert.equal(ev.url, 'https://tickets')
  })
})
