"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/handlers/trips.ts
var trips_exports = {};
__export(trips_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(trips_exports);

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
var handlePreflightRequest = (event, config) => {
  const origin = event.headers?.origin || event.headers?.Origin;
  const requestMethod = event.headers?.[`access-control-request-method`] || event.headers?.[`Access-Control-Request-Method`];
  const corsHeaders = getCorsHeaders(origin, requestMethod, config);
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: ""
  };
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

// src/handlers/trips.ts
initSentry();
var tripsHandler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    if (event.requestContext.http.method === "OPTIONS") {
      return handlePreflightRequest(event);
    }
    if (event.requestContext.http.method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return {
        statusCode: 200,
        headers: addCorsHeaders({
          "Content-Type": "application/json"
        }, origin),
        body: JSON.stringify({ ok: true, tripId: body.tripId || "demo" })
      };
    }
    if (event.requestContext.http.method === "GET") {
      return {
        statusCode: 200,
        headers: addCorsHeaders({
          "Content-Type": "application/json"
        }, origin),
        body: JSON.stringify({ trips: [] })
        // Placeholder - implement actual trip retrieval
      };
    }
    return {
      statusCode: 405,
      headers: addCorsHeaders({
        "Content-Type": "application/json"
      }, origin),
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  } catch (error) {
    captureError(error, {
      event_method: event.requestContext.http.method,
      event_path: event.requestContext.http.path,
      request_body: event.body
    });
    return {
      statusCode: 500,
      headers: addCorsHeaders({
        "content-type": "application/json"
      }, origin),
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};
var handler = withSentry(tripsHandler);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
