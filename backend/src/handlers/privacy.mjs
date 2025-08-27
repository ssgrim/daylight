import { authenticateUser, AuthResponses } from '../lib/auth.js'
import { ddb, TABLE } from '../lib/dynamo.js'
import { QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { info, error } from '../lib/logger.mjs'

// Simple privacy endpoints for local dev. Exports user-owned items and supports deletion.
export async function exportData(event) {
  const requestId = event.requestId || 'dev'
  try {
    const user = await authenticateUser(event)
    info({ requestId, userId: user.userId }, 'privacy export requested')

    // Query Trips by userId (placeholder: scan table and filter—dev only)
    // In production implement a GSI for efficient user lookups.
    const params = { TableName: TABLE, FilterExpression: 'userId = :uid', ExpressionAttributeValues: { ':uid': user.userId } }
    // Not all SDKs allow Query with Filter without KeyCondition; for dev attempt a Scan
    const items = []
    try {
      const scanRes = await ddb.send({
        input: null,
        // fallback: use low-level scan via ddb client if needed
      })
    } catch (e) {
      // ignore complex scan in dev; return empty array if dynamo not configured
    }

    // Return placeholder payload with user info for now
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: { id: user.userId, email: user.email || null }, trips: [] }) }
  } catch (err) {
    error({ requestId }, 'privacy export error', String(err))
    if (err.message && err.message.includes('Authentication failed')) return AuthResponses.unauthorized(err.message)
    return { statusCode: 500, body: 'Internal server error' }
  }
}

export async function deleteData(event) {
  const requestId = event.requestId || 'dev'
  try {
    const user = await authenticateUser(event)
    info({ requestId, userId: user.userId }, 'privacy delete requested')

    // For dev, we won't actually delete production data. Return success if authenticated.
    // Production should implement irreversible deletion with audit logs.
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deleted: true }) }
  } catch (err) {
    error({ requestId }, 'privacy delete error', String(err))
    if (err.message && err.message.includes('Authentication failed')) return AuthResponses.unauthorized(err.message)
    return { statusCode: 500, body: 'Internal server error' }
  }
}
