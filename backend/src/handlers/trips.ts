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
  ScanCommand,
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
  description?: string;
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
  tags?: string[];
  isPublic?: boolean;
}

interface ListTripsQueryParams {
  limit?: number;
  lastKey?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
  tag?: string;
  search?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  count: number;
  lastKey?: string;
  hasMore: boolean;
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
    const queryParams = event.queryStringParameters || {};
    const userId = authResult.userId!;

    // 2. INPUT VALIDATION AND SANITIZATION
    switch (method) {
      case "POST":
        return await createTrip(event, userId);

      case "GET":
        if (!tripId) {
          return await listUserTrips(userId, queryParams);
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

  if (body.description && typeof body.description !== "string") {
    errors.push("Description must be a string");
  }

  if (body.description && body.description.length > 500) {
    errors.push("Description must be less than 500 characters");
  }

  if (body.status && !['draft', 'active', 'completed', 'cancelled'].includes(body.status)) {
    errors.push("Status must be one of: draft, active, completed, cancelled");
  }

  if (body.isPublic && typeof body.isPublic !== "boolean") {
    errors.push("isPublic must be a boolean");
  }

  if (body.tags && !Array.isArray(body.tags)) {
    errors.push("Tags must be an array");
  }

  if (body.tags && body.tags.some((tag: any) => typeof tag !== "string")) {
    errors.push("All tags must be strings");
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

// Query parameter validation
function validateListQueryParams(params: any): ListTripsQueryParams {
  const validated: ListTripsQueryParams = {};

  if (params.limit) {
    const limit = parseInt(params.limit);
    if (!isNaN(limit) && limit > 0 && limit <= 100) {
      validated.limit = limit;
    }
  }

  if (params.lastKey && typeof params.lastKey === 'string') {
    try {
      // Validate that lastKey is a valid base64 encoded string
      JSON.parse(Buffer.from(params.lastKey, 'base64').toString());
      validated.lastKey = params.lastKey;
    } catch {
      // Invalid lastKey, ignore it
    }
  }

  if (params.sortBy && ['createdAt', 'updatedAt', 'name'].includes(params.sortBy)) {
    validated.sortBy = params.sortBy;
  }

  if (params.sortOrder && ['asc', 'desc'].includes(params.sortOrder)) {
    validated.sortOrder = params.sortOrder;
  }

  if (params.status && ['draft', 'active', 'completed', 'cancelled'].includes(params.status)) {
    validated.status = params.status;
  }

  if (params.tag && typeof params.tag === 'string') {
    validated.tag = params.tag;
  }

  if (params.search && typeof params.search === 'string') {
    validated.search = params.search.trim();
  }

  return validated;
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
    description: body.description?.trim() || '',
    status: body.status || 'draft',
    tags: body.tags || [],
    isPublic: body.isPublic || false,
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
      body: JSON.stringify({ 
        tripId, 
        message: "Trip created successfully",
        trip 
      }),
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
  queryParams: any,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const params = validateListQueryParams(queryParams);
    const limit = params.limit || 20;
    
    // Use GSI for efficient querying by ownerId
    const queryCommandParams: any = {
      TableName: TABLE_NAME,
      IndexName: "OwnerIndex",
      KeyConditionExpression: "ownerId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      Limit: limit,
      ScanIndexForward: params.sortOrder !== 'desc', // Default to DESC (newest first)
    };

    // Add additional filters beyond the GSI key
    const filterExpressions: string[] = [];
    const attributeNames: Record<string, string> = {};
    const attributeValues: Record<string, any> = { ":userId": userId };

    if (params.status) {
      filterExpressions.push("#status = :status");
      attributeNames["#status"] = "status";
      attributeValues[":status"] = params.status;
    }

    if (params.tag) {
      filterExpressions.push("contains(tags, :tag)");
      attributeValues[":tag"] = params.tag;
    }

    if (params.search) {
      filterExpressions.push("(contains(#name, :search) OR contains(description, :search))");
      attributeNames["#name"] = "name";
      attributeValues[":search"] = params.search;
    }

    if (filterExpressions.length > 0) {
      queryCommandParams.FilterExpression = filterExpressions.join(" AND ");
    }

    if (Object.keys(attributeNames).length > 0) {
      queryCommandParams.ExpressionAttributeNames = attributeNames;
    }

    queryCommandParams.ExpressionAttributeValues = attributeValues;

    // Add pagination
    if (params.lastKey) {
      try {
        queryCommandParams.ExclusiveStartKey = JSON.parse(
          Buffer.from(params.lastKey, 'base64').toString()
        );
      } catch {
        // Invalid lastKey, ignore pagination
      }
    }

    // For sorting by name, we need to use scan since GSI is sorted by createdAt
    let result;
    if (params.sortBy === 'name') {
      // Fall back to scan for name sorting
      const scanParams = {
        TableName: TABLE_NAME,
        FilterExpression: "ownerId = :userId" + (filterExpressions.length > 0 ? " AND " + filterExpressions.join(" AND ") : ""),
        ExpressionAttributeNames: Object.keys(attributeNames).length > 0 ? attributeNames : undefined,
        ExpressionAttributeValues: attributeValues,
        Limit: limit,
        ExclusiveStartKey: queryCommandParams.ExclusiveStartKey,
      };
      result = await dynamodb.send(new ScanCommand(scanParams));
    } else {
      result = await dynamodb.send(new QueryCommand(queryCommandParams));
    }
    
    let trips = result.Items || [];

    // Apply name sorting if requested (since we can't sort by name in GSI)
    if (params.sortBy === 'name') {
      trips.sort((a, b) => {
        const aName = a.name?.toLowerCase() || '';
        const bName = b.name?.toLowerCase() || '';
        if (aName < bName) return params.sortOrder === 'asc' ? -1 : 1;
        if (aName > bName) return params.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Prepare pagination response
    const hasMore = !!result.LastEvaluatedKey;
    let nextKey: string | undefined;
    
    if (hasMore && result.LastEvaluatedKey) {
      nextKey = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    const response: PaginatedResponse<Trip> = {
      items: trips as Trip[],
      count: trips.length,
      lastKey: nextKey,
      hasMore,
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error listing trips:', error);
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

    // Update the trip with new and existing values
    const now = new Date().toISOString();
    const updatedTrip: Trip = {
      tripId: existing.Item.tripId,
      ownerId: existing.Item.ownerId,
      createdAt: existing.Item.createdAt,
      name: body.name?.trim() || existing.Item.name,
      anchors: body.anchors !== undefined ? body.anchors : existing.Item.anchors,
      preferences: body.preferences !== undefined ? body.preferences : existing.Item.preferences,
      description: body.description !== undefined ? body.description?.trim() : existing.Item.description,
      status: body.status !== undefined ? body.status : existing.Item.status,
      tags: body.tags !== undefined ? body.tags : existing.Item.tags,
      isPublic: body.isPublic !== undefined ? body.isPublic : existing.Item.isPublic,
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
