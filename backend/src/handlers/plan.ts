import { APIGatewayProxyHandlerV2 } from 'aws-lambda'

export const handler: APIGatewayProxyHandlerV2 = async () => {
  const now = new Date().toISOString()
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify([{ id:'1', title:'Demo Stop', start:now, end:now, score:95 }])
  }
}
