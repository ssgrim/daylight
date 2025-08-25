import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { fetchWeather, reverseGeocode, fetchEvents, fetchTrafficInfo } from '../lib/external'
import { 
  PlanRequestSchema, 
  LatLngQuerySchema, 
  PlanResponseSchema 
} from '../lib/validation'
import { 
  withValidation, 
  createSuccessResponse, 
  createErrorResponse,
  validateResponse
} from '../lib/middleware'

// GET /plan?lat=X&lng=Y - Simple location-based planning (for dev/testing)
const getLocationPlanHandler = withValidation(
  async (event, body, query, params) => {
    const { lat, lng } = query as { lat: number; lng: number }
    const now = new Date().toISOString()
    
    try {
      let reason: string | undefined
      let season = null
      let events = null
      let traffic = null
      
      // Fetch external data in parallel
      const [w, g, ev, tr] = await Promise.all([
        fetchWeather(lat, lng),
        reverseGeocode(lat, lng),
        fetchEvents(lat, lng),
        fetchTrafficInfo(lat, lng)
      ])
      
      reason = [g.display_name, w.summary].filter(Boolean).join(' — ')
      season = (w && w.season) || null
      events = ev
      traffic = tr

      // Simple season-aware scoring: base 95, + for summer, - for winter, and penalize high congestion
      let baseScore = 95
      if (season?.season === 'summer') baseScore += 3
      if (season?.season === 'winter') baseScore -= 5
      if (traffic?.congestion != null && traffic.congestion > 70) baseScore -= 10

      const suggestions = [
        { 
          id: '1', 
          title: 'Live Stop', 
          start: now, 
          end: now, 
          score: baseScore, 
          reason 
        }
      ]

      // Validate response before returning
      const validatedResponse = validateResponse(suggestions, PlanResponseSchema)
      return createSuccessResponse(validatedResponse)
      
    } catch (err: any) {
      console.error('Plan enrichment error:', err)
      
      const fallbackSuggestions = [
        { 
          id: '1', 
          title: 'Demo Stop', 
          start: now, 
          end: now, 
          score: 95, 
          reason: `Enrichment failed: ${err.message}` 
        }
      ]
      
      const validatedResponse = validateResponse(fallbackSuggestions, PlanResponseSchema)
      return createSuccessResponse(validatedResponse)
    }
  },
  {
    querySchema: LatLngQuerySchema
  }
)

// POST /plan - Full planning with trip context
const postPlanHandler = withValidation(
  async (event, body, query, params) => {
    const planRequest = body as any
    const now = planRequest.now || new Date().toISOString()
    
    try {
      // For now, return a demo suggestion
      // In a full implementation, this would:
      // 1. Fetch the trip if tripId is provided
      // 2. Use anchors to determine time windows
      // 3. Generate candidates based on location and preferences
      // 4. Score candidates using the scoring engine
      // 5. Return top-scored suggestions
      
      const suggestions = [
        {
          id: 'demo-post',
          title: `Suggestion for ${planRequest.suggestFor}`,
          start: now,
          end: now,
          score: 90,
          reason: 'Demo suggestion from POST /plan'
        }
      ]

      // Validate response before returning
      const validatedResponse = validateResponse(suggestions, PlanResponseSchema)
      return createSuccessResponse(validatedResponse)
      
    } catch (err: any) {
      console.error('Plan generation error:', err)
      
      return createErrorResponse(
        'PLAN_GENERATION_ERROR',
        `Failed to generate plan: ${err.message}`,
        500,
        event.requestContext.http.path
      )
    }
  },
  {
    bodySchema: PlanRequestSchema
  }
)

// Main handler that routes to appropriate sub-handlers
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method
  const path = event.requestContext.http.path
  
  try {
    switch (method) {
      case 'GET':
        if (path === '/plan' || path.endsWith('/plan')) {
          return await getLocationPlanHandler(event)
        }
        break
        
      case 'POST':
        if (path === '/plan' || path.endsWith('/plan')) {
          return await postPlanHandler(event)
        }
        break
        
      case 'OPTIONS':
        return {
          statusCode: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Max-Age': '86400'
          }
        }
        
      default:
        return createErrorResponse(
          'METHOD_NOT_ALLOWED',
          `Method ${method} not allowed`,
          405,
          path
        )
    }
    
    return createErrorResponse(
      'NOT_FOUND',
      `Endpoint not found: ${method} ${path}`,
      404,
      path
    )
    
  } catch (error) {
    console.error('Plan handler error:', error)
    
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Internal server error',
      500,
      path
    )
  }
}
