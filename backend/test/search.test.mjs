import { test } from 'node:test';
import assert from 'node:assert';

function search(query) {
  if (query === 'example') {
    return ['result1', 'result2'];
  }
  return [];
}

test('Search Functionality', async (t) => {
  await t.test('should return results for a valid query', () => {
    const query = 'example';
    const results = search(query);

    assert.ok(results);
    assert(results.length > 0);
  });

  await t.test('should return an empty array for an invalid query', () => {
    const query = 'invalid';
    const results = search(query);

    assert.deepStrictEqual(results, []);
  });
});
