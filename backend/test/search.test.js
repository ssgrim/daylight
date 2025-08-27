function search(query) {
  if (query === 'example') {
    return ['result1', 'result2'];
  }
  return [];
}

describe('Search Functionality', () => {
  it('should return results for a valid query', () => {
    const query = 'example';
    const results = search(query); // Assuming `search` is the function to test

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
  });

  it('should return an empty array for an invalid query', () => {
    const query = 'invalid';
    const results = search(query);

    expect(results).toEqual([]);
  });
});