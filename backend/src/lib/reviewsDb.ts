import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client);

export const TABLE = process.env.TABLE_REVIEWS || 'daylight-reviews-dev';

// DynamoDB patterns for review data:
// REVIEW#{reviewId} | META -> Review
// LOCATION#{locationId} | REVIEW#{reviewId} -> Review (GSI for location queries)
// USER#{userId} | REVIEW#{reviewId} -> Review (GSI for user reviews)
// REVIEW#{reviewId} | VOTE#{userId} -> ReviewVote
// REVIEW#{reviewId} | FLAG#{flagId} -> ReviewFlag
// LOCATION#{locationId} | RATING -> LocationRating
// USER#{userId} | STATS -> ReviewStats
