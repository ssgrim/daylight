"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/lru-cache.cjs
var require_lru_cache = __commonJS({
  "src/lib/lru-cache.cjs"(exports2, module2) {
    "use strict";
    var LRUCache = class {
      constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = /* @__PURE__ */ new Map();
      }
      get(key) {
        if (!this.cache.has(key)) {
          return null;
        }
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
      }
      set(key, value) {
        if (this.cache.has(key)) {
          this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
      }
      has(key) {
        return this.cache.has(key);
      }
      delete(key) {
        return this.cache.delete(key);
      }
      clear() {
        this.cache.clear();
      }
      size() {
        return this.cache.size;
      }
    };
    module2.exports = { LRUCache };
  }
});

// src/lib/cache-layer.cjs
var require_cache_layer = __commonJS({
  "src/lib/cache-layer.cjs"(exports2, module2) {
    "use strict";
    var AWS = require("aws-sdk");
    var { LRUCache } = require_lru_cache();
    var dynamodb = new AWS.DynamoDB.DocumentClient();
    var cacheInstances = /* @__PURE__ */ new Map();
    var DEFAULT_TTL_SECONDS = 3600;
    var DEFAULT_LRU_SIZE = 100;
    function getCacheInstance(namespace, maxSize = DEFAULT_LRU_SIZE) {
      if (!cacheInstances.has(namespace)) {
        cacheInstances.set(namespace, new LRUCache(maxSize));
      }
      return cacheInstances.get(namespace);
    }
    function generateCacheKey(prefix, params) {
      const paramsStr = typeof params === "string" ? params : JSON.stringify(params);
      return `${prefix}:${Buffer.from(paramsStr).toString("base64").substr(0, 32)}`;
    }
    async function getCached2(namespace, key, options = {}) {
      const { useDynamoDB = false, tableName = "daylight-cache" } = options;
      const lruCache = getCacheInstance(namespace);
      const lruValue = lruCache.get(key);
      if (lruValue) {
        if (lruValue.expiresAt && Date.now() > lruValue.expiresAt) {
          lruCache.delete(key);
        } else {
          console.log(`Cache HIT (LRU): ${namespace}:${key}`);
          return lruValue.data;
        }
      }
      if (useDynamoDB) {
        try {
          const result = await dynamodb.get({
            TableName: tableName,
            Key: { pk: `${namespace}:${key}` }
          }).promise();
          if (result.Item) {
            if (result.Item.ttl && result.Item.ttl < Math.floor(Date.now() / 1e3)) {
              console.log(`Cache EXPIRED (DDB): ${namespace}:${key}`);
              return null;
            }
            console.log(`Cache HIT (DDB): ${namespace}:${key}`);
            const expiresAt = result.Item.ttl ? result.Item.ttl * 1e3 : null;
            lruCache.set(key, { data: result.Item.data, expiresAt });
            return result.Item.data;
          }
        } catch (error) {
          console.warn(`DynamoDB cache read error: ${error.message}`);
        }
      }
      console.log(`Cache MISS: ${namespace}:${key}`);
      return null;
    }
    async function setCached2(namespace, key, data, options = {}) {
      const {
        ttlSeconds = DEFAULT_TTL_SECONDS,
        useDynamoDB = false,
        tableName = "daylight-cache"
      } = options;
      const expiresAt = Date.now() + ttlSeconds * 1e3;
      const lruCache = getCacheInstance(namespace);
      lruCache.set(key, { data, expiresAt });
      if (useDynamoDB) {
        try {
          await dynamodb.put({
            TableName: tableName,
            Item: {
              pk: `${namespace}:${key}`,
              data,
              ttl: Math.floor(expiresAt / 1e3),
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
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
    function getCacheControlHeader2(ttlSeconds = DEFAULT_TTL_SECONDS, isPrivate = false) {
      const visibility = isPrivate ? "private" : "public";
      return `${visibility}, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`;
    }
    function withCache(fn, namespace, options = {}) {
      return async (...args) => {
        const keyParams = options.keyParams ? options.keyParams(...args) : args;
        const key = generateCacheKey(namespace, keyParams);
        const cached = await getCached2(namespace, key, options);
        if (cached !== null) {
          return cached;
        }
        const result = await fn(...args);
        await setCached2(namespace, key, result, options);
        return result;
      };
    }
    module2.exports = {
      getCached: getCached2,
      setCached: setCached2,
      generateCacheKey,
      getCacheControlHeader: getCacheControlHeader2,
      withCache,
      getCacheInstance
    };
  }
});

// src/lib/validation.cjs
var require_validation = __commonJS({
  "src/lib/validation.cjs"(exports2, module2) {
    "use strict";
    var ValidationError = class extends Error {
      constructor(message, field = null) {
        super(message);
        this.name = "ValidationError";
        this.field = field;
      }
    };
    function validateQuery(query) {
      if (!query || typeof query !== "string") {
        throw new ValidationError("Query parameter is required and must be a string", "query");
      }
      const trimmedQuery = query.trim();
      if (trimmedQuery.length === 0) {
        throw new ValidationError("Query parameter cannot be empty", "query");
      }
      if (trimmedQuery.length > 120) {
        throw new ValidationError("Query parameter must be 120 characters or less", "query");
      }
      return trimmedQuery;
    }
    function validateCoordinates2(lat, lng) {
      const numLat = Number(lat);
      const numLng = Number(lng);
      if (isNaN(numLat) || isNaN(numLng)) {
        throw new ValidationError("Latitude and longitude must be valid numbers", "coordinates");
      }
      if (numLat < -90 || numLat > 90) {
        throw new ValidationError("Latitude must be between -90 and 90 degrees", "lat");
      }
      if (numLng < -180 || numLng > 180) {
        throw new ValidationError("Longitude must be between -180 and 180 degrees", "lng");
      }
      return { lat: numLat, lng: numLng };
    }
    function createValidationErrorResponse(error) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
          // CORS headers will be added by the handler using the CORS utility
        },
        body: JSON.stringify({
          error: "Validation failed",
          message: error.message,
          field: error.field,
          type: "validation_error"
        })
      };
    }
    function validateWith2(validationFn) {
      try {
        return { success: true, data: validationFn() };
      } catch (error) {
        if (error instanceof ValidationError) {
          return { success: false, response: createValidationErrorResponse(error) };
        }
        throw error;
      }
    }
    module2.exports = {
      ValidationError,
      validateQuery,
      validateCoordinates: validateCoordinates2,
      createValidationErrorResponse,
      validateWith: validateWith2
    };
  }
});

// src/handlers/plan.ts
var plan_exports = {};
__export(plan_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(plan_exports);

// src/lib/sentry.ts
var Sentry = __toESM(require("@sentry/node"), 1);
function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || "development";
  const release = process.env.SENTRY_RELEASE || process.env.GIT_SHA || "unknown";
  if (!dsn) {
    console.warn("SENTRY_DSN not configured - error tracking disabled");
    return false;
  }
  Sentry.init({
    dsn,
    environment,
    release,
    // Serverless configuration
    tracesSampleRate: environment === "production" ? 0.1 : 1,
    debug: environment === "development",
    // Capture additional context
    beforeSend(event) {
      if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        event.tags = {
          ...event.tags,
          lambda_function: process.env.AWS_LAMBDA_FUNCTION_NAME,
          lambda_version: process.env.AWS_LAMBDA_FUNCTION_VERSION,
          lambda_region: process.env.AWS_REGION
        };
      }
      if (event.request?.url?.includes("/health")) {
        return null;
      }
      return event;
    },
    // Integration configuration
    integrations: [
      // Add performance monitoring
      Sentry.httpIntegration()
    ]
  });
  console.log(`Sentry initialized for environment: ${environment}, release: ${release}`);
  return true;
}
function withSentry(handler2) {
  return async (...args) => {
    try {
      const result = await handler2(...args);
      return result;
    } catch (error) {
      Sentry.captureException(error, {
        contexts: {
          lambda: {
            event: args[0],
            // Lambda event
            context: args[1]
            // Lambda context
          }
        }
      });
      throw error;
    }
  };
}
function captureError(error, context) {
  Sentry.captureException(error, {
    contexts: {
      custom: context
    }
  });
}
function captureMessage2(message, level = "info", context) {
  Sentry.captureMessage(message, level, {
    contexts: {
      custom: context
    }
  });
}

// src/lib/cors.ts
var getDefaultCorsConfig = () => {
  const env = process.env.NODE_ENV || "development";
  const commonConfig = {
    allowCredentials: false,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "X-API-Key"
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-Request-ID", "X-Rate-Limit-Remaining", "X-Rate-Limit-Reset"],
    maxAge: 86400
    // 24 hours
  };
  switch (env) {
    case "production":
      return {
        ...commonConfig,
        allowOrigins: [
          "https://daylight.app",
          "https://www.daylight.app",
          // Add CloudFront distribution URLs from environment
          ...process.env.CLOUDFRONT_DOMAIN ? [`https://${process.env.CLOUDFRONT_DOMAIN}`] : [],
          ...process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []
        ]
      };
    case "staging":
      return {
        ...commonConfig,
        allowOrigins: [
          "https://staging.daylight.app",
          "https://daylight-staging.netlify.app",
          ...process.env.CLOUDFRONT_DOMAIN ? [`https://${process.env.CLOUDFRONT_DOMAIN}`] : [],
          ...process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []
        ]
      };
    case "development":
    case "dev":
      return {
        ...commonConfig,
        allowOrigins: [
          "http://localhost:3000",
          "http://localhost:5173",
          // Vite dev server
          "http://127.0.0.1:3000",
          "http://127.0.0.1:5173",
          ...process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []
        ]
      };
    default:
      return {
        ...commonConfig,
        allowOrigins: ["http://localhost:3000"]
      };
  }
};
var isOriginAllowed = (origin, config) => {
  if (!origin) return false;
  const corsConfig = config || getDefaultCorsConfig();
  if (!corsConfig.allowOrigins || corsConfig.allowOrigins.length === 0) {
    return false;
  }
  if (corsConfig.allowOrigins.includes("*")) {
    const env = process.env.NODE_ENV || "development";
    return env === "development" || env === "dev";
  }
  if (corsConfig.allowOrigins.includes(origin)) {
    return true;
  }
  return corsConfig.allowOrigins.some((allowedOrigin) => {
    if (allowedOrigin.startsWith("*.")) {
      const domain = allowedOrigin.slice(2);
      return origin.endsWith(`.${domain}`) || origin === domain;
    }
    return false;
  });
};
var getCorsHeaders = (requestOrigin, requestMethod, config) => {
  const corsConfig = config || getDefaultCorsConfig();
  const headers = {};
  if (isOriginAllowed(requestOrigin, corsConfig)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
    headers["Vary"] = "Origin";
  } else if (corsConfig.allowOrigins?.includes("*")) {
    const env = process.env.NODE_ENV || "development";
    if (env === "development" || env === "dev") {
      headers["Access-Control-Allow-Origin"] = "*";
    }
  }
  if (headers["Access-Control-Allow-Origin"]) {
    if (corsConfig.allowMethods && corsConfig.allowMethods.length > 0) {
      headers["Access-Control-Allow-Methods"] = corsConfig.allowMethods.join(", ");
    }
    if (corsConfig.allowHeaders && corsConfig.allowHeaders.length > 0) {
      headers["Access-Control-Allow-Headers"] = corsConfig.allowHeaders.join(", ");
    }
    if (corsConfig.allowCredentials) {
      headers["Access-Control-Allow-Credentials"] = "true";
    }
    if (corsConfig.exposeHeaders && corsConfig.exposeHeaders.length > 0) {
      headers["Access-Control-Expose-Headers"] = corsConfig.exposeHeaders.join(", ");
    }
    if (corsConfig.maxAge) {
      headers["Access-Control-Max-Age"] = corsConfig.maxAge.toString();
    }
  }
  return headers;
};
var addCorsHeaders = (headers = {}, requestOrigin, config) => {
  const corsHeaders = getCorsHeaders(requestOrigin, void 0, config);
  const filteredCorsHeaders = {};
  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (value !== void 0) {
      filteredCorsHeaders[key] = value;
    }
  });
  return {
    ...headers,
    ...filteredCorsHeaders
  };
};

// src/handlers/plan.ts
var { getCached, setCached, getCacheControlHeader } = require_cache_layer();
var { validateCoordinates, validateWith } = require_validation();
initSentry();
var planHandler = async (event) => {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const q = event.queryStringParameters || {};
    const latParam = q.lat;
    const lngParam = q.lng;
    let coordinates = null;
    if (latParam !== void 0 || lngParam !== void 0) {
      const validation = validateWith(() => validateCoordinates(latParam, lngParam));
      if (!validation.success) {
        captureMessage2("Invalid coordinates provided", "warning", {
          lat: latParam,
          lng: lngParam,
          validation_error: validation.response
        });
        return {
          ...validation.response,
          headers: addCorsHeaders(validation.response.headers, origin)
        };
      }
      coordinates = validation.data;
    }
    const CACHE_TTL = 1800;
    const USE_DYNAMODB = process.env.ENABLE_CACHE_DDB === "true";
    let cacheKey = "plan:default";
    if (coordinates) {
      const roundedLat = Math.round(coordinates.lat * 1e3) / 1e3;
      const roundedLng = Math.round(coordinates.lng * 1e3) / 1e3;
      cacheKey = `plan:${roundedLat},${roundedLng}`;
    }
    const cached = await getCached("plan", cacheKey, {
      useDynamoDB: USE_DYNAMODB,
      tableName: process.env.CACHE_TABLE_NAME || "daylight-cache"
    });
    if (cached) {
      console.log(`Returning cached plan result for: ${cacheKey}`);
      return {
        statusCode: 200,
        headers: addCorsHeaders({
          "content-type": "application/json",
          "Cache-Control": getCacheControlHeader(CACHE_TTL, false),
          "X-Cache": "HIT"
        }, origin),
        body: JSON.stringify(cached)
      };
    }
    const result = [{
      id: "1",
      title: coordinates ? `Demo Stop near ${coordinates.lat.toFixed(3)},${coordinates.lng.toFixed(3)}` : "Demo Stop",
      start: now,
      end: now,
      score: 95,
      location: coordinates || void 0
    }];
    await setCached("plan", cacheKey, result, {
      ttlSeconds: CACHE_TTL,
      useDynamoDB: USE_DYNAMODB,
      tableName: process.env.CACHE_TABLE_NAME || "daylight-cache"
    });
    return {
      statusCode: 200,
      headers: addCorsHeaders({
        "content-type": "application/json",
        "Cache-Control": getCacheControlHeader(CACHE_TTL, false),
        "X-Cache": "MISS"
      }, origin),
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error("Plan handler error:", err);
    captureError(err, {
      event_method: event.requestContext?.http?.method,
      event_path: event.requestContext?.http?.path,
      query_parameters: event.queryStringParameters,
      cache_enabled: process.env.ENABLE_CACHE_DDB,
      timestamp: now
    });
    return {
      statusCode: 500,
      headers: addCorsHeaders({
        "content-type": "application/json"
      }, origin),
      body: JSON.stringify({
        error: "Internal server error",
        type: "internal_error"
      })
    };
  }
};
var handler = withSentry(planHandler);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
