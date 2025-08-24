// Comprehensive caching layer with LRU + optional DynamoDB
const AWS = require('aws-sdk');
const { LRUCache } = require('./lru-cache.cjs');

const dynamodb = new AWS.DynamoDB.DocumentClient();

// In-memory cache instances (per Lambda warm instance)
const cacheInstances = new Map();

// Cache configuration
const DEFAULT_TTL_SECONDS = 3600; // 1 hour
const DEFAULT_LRU_SIZE = 100;

/**
 * Get or create cache instance for a specific namespace
 * @param {string} namespace - Cache namespace (e.g., 'places', 'weather')
 * @param {number} maxSize - LRU cache size
 * @returns {LRUCache}
 */
function getCacheInstance(namespace, maxSize = DEFAULT_LRU_SIZE) {
  if (!cacheInstances.has(namespace)) {
    cacheInstances.set(namespace, new LRUCache(maxSize));
  }
  return cacheInstances.get(namespace);
}

/**
 * Generate cache key from parameters
 * @param {string} prefix - Key prefix
 * @param {object} params - Parameters to hash
 * @returns {string}
 */
function generateCacheKey(prefix, params) {
  const paramsStr = typeof params === 'string' ? params : JSON.stringify(params);
  return `${prefix}:${Buffer.from(paramsStr).toString('base64').substr(0, 32)}`;
}

/**
 * Get cached value with fallback chain: LRU -> DynamoDB -> null
 * @param {string} namespace - Cache namespace
 * @param {string} key - Cache key
 * @param {object} options - Cache options
 * @returns {Promise<any|null>}
 */
async function getCached(namespace, key, options = {}) {
  const { useDynamoDB = false, tableName = 'daylight-cache' } = options;
  
  // Try LRU cache first
  const lruCache = getCacheInstance(namespace);
  const lruValue = lruCache.get(key);
  
  if (lruValue) {
    // Check if expired
    if (lruValue.expiresAt && Date.now() > lruValue.expiresAt) {
      lruCache.delete(key);
    } else {
      console.log(`Cache HIT (LRU): ${namespace}:${key}`);
      return lruValue.data;
    }
  }
  
  // Try DynamoDB if enabled
  if (useDynamoDB) {
    try {
      const result = await dynamodb.get({
        TableName: tableName,
        Key: { pk: `${namespace}:${key}` }
      }).promise();
      
      if (result.Item) {
        // Check TTL (DynamoDB TTL might not have cleaned up yet)
        if (result.Item.ttl && result.Item.ttl < Math.floor(Date.now() / 1000)) {
          console.log(`Cache EXPIRED (DDB): ${namespace}:${key}`);
          return null;
        }
        
        console.log(`Cache HIT (DDB): ${namespace}:${key}`);
        
        // Store back in LRU for faster access
        const expiresAt = result.Item.ttl ? result.Item.ttl * 1000 : null;
        lruCache.set(key, { data: result.Item.data, expiresAt });
        
        return result.Item.data;
      }
    } catch (error) {
      console.warn(`DynamoDB cache read error: ${error.message}`);
      // Continue without DDB cache
    }
  }
  
  console.log(`Cache MISS: ${namespace}:${key}`);
  return null;
}

/**
 * Set cached value in both LRU and optionally DynamoDB
 * @param {string} namespace - Cache namespace
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {object} options - Cache options
 */
async function setCached(namespace, key, data, options = {}) {
  const { 
    ttlSeconds = DEFAULT_TTL_SECONDS, 
    useDynamoDB = false, 
    tableName = 'daylight-cache' 
  } = options;
  
  const expiresAt = Date.now() + (ttlSeconds * 1000);
  
  // Store in LRU cache
  const lruCache = getCacheInstance(namespace);
  lruCache.set(key, { data, expiresAt });
  
  // Store in DynamoDB if enabled
  if (useDynamoDB) {
    try {
      await dynamodb.put({
        TableName: tableName,
        Item: {
          pk: `${namespace}:${key}`,
          data,
          ttl: Math.floor(expiresAt / 1000),
          createdAt: new Date().toISOString()
        }
      }).promise();
      
      console.log(`Cache SET (LRU+DDB): ${namespace}:${key}`);
    } catch (error) {
      console.warn(`DynamoDB cache write error: ${error.message}`);
      console.log(`Cache SET (LRU only): ${namespace}:${key}`);
    }
  } else {
    console.log(`Cache SET (LRU): ${namespace}:${key}`);
  }
}

/**
 * Generate cache-control header based on TTL
 * @param {number} ttlSeconds - TTL in seconds
 * @param {boolean} isPrivate - Whether cache is private
 * @returns {string}
 */
function getCacheControlHeader(ttlSeconds = DEFAULT_TTL_SECONDS, isPrivate = false) {
  const visibility = isPrivate ? 'private' : 'public';
  return `${visibility}, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`;
}

/**
 * Wrap a function with caching
 * @param {Function} fn - Function to wrap
 * @param {string} namespace - Cache namespace
 * @param {object} options - Cache options
 * @returns {Function}
 */
function withCache(fn, namespace, options = {}) {
  return async (...args) => {
    const keyParams = options.keyParams ? options.keyParams(...args) : args;
    const key = generateCacheKey(namespace, keyParams);
    
    // Try cache first
    const cached = await getCached(namespace, key, options);
    if (cached !== null) {
      return cached;
    }
    
    // Execute function and cache result
    const result = await fn(...args);
    await setCached(namespace, key, result, options);
    
    return result;
  };
}

module.exports = {
  getCached,
  setCached,
  generateCacheKey,
  getCacheControlHeader,
  withCache,
  getCacheInstance
};
