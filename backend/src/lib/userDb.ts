import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client);

export const TABLE = process.env.TABLE_USERS || 'daylight-users-dev';

// DynamoDB patterns for user data:
// USER#{userId} | PROFILE -> UserProfile
// USER#{userId} | LOCATION#{locationId} -> SavedLocation  
// USER#{userId} | TRIP#{tripId} -> TripHistory
// USER#{userId} | STATS -> UserStats
