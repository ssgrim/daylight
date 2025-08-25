import {
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { authenticateRequest } from "../lib/auth-cognito.js";
import { withSecurity } from "../lib/security.js";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_TRIPS || "daylight_trips";

interface Trip {
  tripId: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  anchors?: any[];
  preferences?: any;
}

// Enhanced error handling and security with Cognito authentication
const baseHandler = async (
  event: any,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    // 1. AUTHENTICATION CHECK using Cognito
    const authResult = await authenticateRequest(event);
    if (!authResult.isValid) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Unauthorized",
          message: authResult.error,
        }),
      };
    }

    const { method } = event.requestContext.http;
    const { tripId } = event.pathParameters || {};
    const userId = authResult.userId!;

    // 2. INPUT VALIDATION AND SANITIZATION
    switch (method) {
      case "POST":
        return await createTrip(event, userId);

      case "GET":
        if (!tripId) {
          return await listUserTrips(userId);
        }
        return await getTrip(tripId, userId);

      case "PUT":
        if (!tripId) {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Trip ID required" }),
          };
        }
        return await updateTrip(tripId, event, userId);

      case "DELETE":
        if (!tripId) {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Trip ID required" }),
          };
        }
        return await deleteTrip(tripId, userId);

      default:
        return {
          statusCode: 405,
          headers: {
            Allow: "GET, POST, PUT, DELETE",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ error: "Method Not Allowed" }),
        };
    }
  } catch (error) {
    console.error("Trip handler error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

// Apply security middleware with proper CORS and rate limiting
export const handler: APIGatewayProxyHandlerV2 = withSecurity(baseHandler, {
  cors: {
    allowedOrigins:
      process.env.NODE_ENV === "production"
        ? [process.env.FRONTEND_URL || "https://your-domain.com"]
        : [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:5174",
          ],
    allowCredentials: true,
    allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100, // 100 requests per minute per user
    keyGenerator: (event) => {
      // Rate limit by user ID if authenticated, otherwise by IP
      const authHeader =
        event.headers?.authorization || event.headers?.Authorization;
      const ip = event.requestContext.http.sourceIp;
      return authHeader ? `user:${authHeader.substring(0, 20)}` : `ip:${ip}`;
    },
  },
  sanitizeInput: true,
  requireAuth: true,
});

// Input validation
function validateTripInput(body: any): { isValid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (
    !body.name ||
    typeof body.name !== "string" ||
    body.name.trim().length === 0
  ) {
    errors.push("Trip name is required");
  }

  if (body.name && body.name.length > 100) {
    errors.push("Trip name must be less than 100 characters");
  }

  if (body.anchors && !Array.isArray(body.anchors)) {
    errors.push("Anchors must be an array");
  }

  // Validate anchors structure
  if (body.anchors) {
    for (let i = 0; i < body.anchors.length; i++) {
      const anchor = body.anchors[i];
      if (
        !anchor.lat ||
        !anchor.lng ||
        typeof anchor.lat !== "number" ||
        typeof anchor.lng !== "number"
      ) {
        errors.push(`Anchor ${i + 1} must have valid lat/lng coordinates`);
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}

async function createTrip(
  event: any,
  userId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const body = JSON.parse(event.body || "{}");

  // Validate input
  const validation = validateTripInput(body);
  if (!validation.isValid) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Validation failed",
        details: validation.errors,
      }),
    };
  }

  const tripId = generateTripId();
  const now = new Date().toISOString();

  const trip: Trip = {
    tripId,
    name: body.name.trim(),
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
    anchors: body.anchors || [],
    preferences: body.preferences || {},
  };

  try {
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: trip,
        ConditionExpression: "attribute_not_exists(tripId)", // Prevent overwrites
      }),
    );

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, message: "Trip created successfully" }),
    };
  } catch (error: any) {
    if (error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 409,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Trip ID already exists" }),
      };
    }
    throw error;
  }
}

async function getTrip(
  tripId: string,
  userId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const result = await dynamodb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { tripId },
      }),
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Trip not found" }),
      };
    }

    // Authorization check - user can only access their own trips
    if (result.Item.ownerId !== userId) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Access denied" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.Item),
    };
  } catch (error) {
    throw error;
  }
}

async function listUserTrips(
  userId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    // TODO: Add GSI for ownerId if querying by owner frequently
    // For now, this is a placeholder - you'd need to scan with filter
    // which is not efficient for large datasets

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trips: [],
        message: "Trip listing requires GSI implementation",
        userId,
      }),
    };
  } catch (error) {
    throw error;
  }
}

async function updateTrip(
  tripId: string,
  event: any,
  userId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const body = JSON.parse(event.body || "{}");

  // Validate input
  const validation = validateTripInput(body);
  if (!validation.isValid) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Validation failed",
        details: validation.errors,
      }),
    };
  }

  try {
    // First check if trip exists and user owns it
    const existing = await dynamodb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { tripId },
      }),
    );

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Trip not found" }),
      };
    }

    if (existing.Item.ownerId !== userId) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Access denied" }),
      };
    }

    // Update the trip
    const now = new Date().toISOString();
    const updatedTrip = {
      ...existing.Item,
      name: body.name.trim(),
      anchors: body.anchors || existing.Item.anchors,
      preferences: body.preferences || existing.Item.preferences,
      updatedAt: now,
    };

    await dynamodb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: updatedTrip,
      }),
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Trip updated successfully",
        trip: updatedTrip,
      }),
    };
  } catch (error) {
    throw error;
  }
}

async function deleteTrip(
  tripId: string,
  userId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    // First check if trip exists and user owns it
    const existing = await dynamodb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { tripId },
      }),
    );

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Trip not found" }),
      };
    }

    if (existing.Item.ownerId !== userId) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Access denied" }),
      };
    }

    await dynamodb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { tripId },
      }),
    );

    return {
      statusCode: 204,
      headers: { "Content-Type": "application/json" },
      body: "",
    };
  } catch (error) {
    throw error;
  }
}

function generateTripId(): string {
  return `trip_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
