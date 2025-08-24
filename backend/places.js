'use strict';

// AWS SDK v2 is available in Lambda Node 18 runtime
const AWS = require('aws-sdk');
const sm = new AWS.SecretsManager();

let CACHED_KEY = null;
async function getPlacesKey() {
  if (CACHED_KEY) return CACHED_KEY;
  const r = await sm.getSecretValue({ SecretId: 'daylight/dev/google-places-api-key' }).promise();
  CACHED_KEY = r.SecretString || '';
  return CACHED_KEY;
}

exports.handler = async (event) => {
  try {
    const q = event?.queryStringParameters?.query || '';
    if (!q) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing query' }) };
    }

    const key = await getPlacesKey();
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', q);
    url.searchParams.set('key', key);

    const res = await fetch(url.toString(), { method: 'GET' });
    const data = await res.json();

    const results = (data.results || []).map(r => ({
      name: r.name,
      address: r.formatted_address,
      rating: r.rating,
      place_id: r.place_id,
      location: r.geometry?.location
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // TODO: tighten this in prod to your DEV/PROD domains
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ query: q, count: results.length, results })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 502, body: JSON.stringify({ error: 'Upstream fetch failed' }) };
  }
};
