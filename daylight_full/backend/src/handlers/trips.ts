import { APIGatewayProxyHandlerV2 } from 'aws-lambda'

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === 'POST') {
    const body = JSON.parse(event.body || '{}')
    return { statusCode:200, body: JSON.stringify({ ok:true, tripId: body.tripId || 'demo' }) }
  }
  return { statusCode:405, body:'Method Not Allowed' }
}
