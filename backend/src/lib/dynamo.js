import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

export const TABLE = process.env.TRIPS_TABLE || 'daylight_trips'
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-2'

const low = new DynamoDBClient({ region: REGION })
export const ddb = DynamoDBDocumentClient.from(low, {
  marshallOptions: { removeUndefinedValues: true }
})
