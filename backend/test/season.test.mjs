import assert from 'assert'
import { getSeasonFor } from '../src/lib/season.mjs'

function dateYm(m, d) {
  return new Date(Date.UTC(2025, m - 1, d))
}

// Northern hemisphere
assert.strictEqual(getSeasonFor(47.6, dateYm(6, 21)).season, 'summer')
assert.strictEqual(getSeasonFor(47.6, dateYm(12, 21)).season, 'winter')

// Southern hemisphere
assert.strictEqual(getSeasonFor(-33.9, dateYm(6, 21)).season, 'winter')
assert.strictEqual(getSeasonFor(-33.9, dateYm(12, 21)).season, 'summer')

console.log('season tests passed')
