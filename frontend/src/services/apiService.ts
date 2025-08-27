import { useAuthStore } from '../stores/authStore'

// Core API functionality
const API_BASE = 'https://api.daylight.example.com'

export interface Trip {
  id: string
  title: string
  description?: string
  startDate: string
  endDate: string
  locations: string[]
  participants: string[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
  sharedWith: string[]
}

export interface CreateTripRequest {
  title: string
  description?: string
  startDate: string
  endDate: string
  locations?: string[]
  participants?: string[]
  isPublic?: boolean
}

export interface UpdateTripRequest extends Partial<CreateTripRequest> {
  id: string
}

export interface Stop {
  id: string
  name: string
  location: {
    lat: number
    lng: number
  }
}

export interface RouteResult {
  optimizedOrder: Stop[]
  totalDistance: number
  totalDuration: number
}

class ApiService {
  private getAuthHeaders(): Record<string, string> {
    const { token } = useAuthStore.getState()
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return headers
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.text()
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      
      try {
        const parsedError = JSON.parse(errorData)
        errorMessage = parsedError.message || errorMessage
      } catch {
        // Use default error message if JSON parsing fails
      }

      throw new Error(errorMessage)
    }

    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    }
    
    return response.text() as T
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers
    }

    const config: RequestInit = {
      ...options,
      headers
    }

    try {
      const response = await fetch(url, config)
      return this.handleResponse<T>(response)
    } catch (error) {
      console.error(`API request failed: ${options.method || 'GET'} ${url}`, error)
      throw error
    }
  }

  // Trip Management API
  async getTrips(): Promise<Trip[]> {
    return this.request<Trip[]>('/trips')
  }

  async getTrip(id: string): Promise<Trip> {
    return this.request<Trip>(`/trips/${id}`)
  }

  async createTrip(trip: CreateTripRequest): Promise<Trip> {
    return this.request<Trip>('/trips', {
      method: 'POST',
      body: JSON.stringify(trip)
    })
  }

  async updateTrip(trip: UpdateTripRequest): Promise<Trip> {
    const { id, ...updateData } = trip
    return this.request<Trip>(`/trips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    })
  }

  async deleteTrip(id: string): Promise<void> {
    return this.request<void>(`/trips/${id}`, {
      method: 'DELETE'
    })
  }

  async shareTrip(id: string, email: string, role: 'viewer' | 'editor' = 'viewer'): Promise<void> {
    return this.request<void>(`/trips/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email, role })
    })
  }

  async unshareTrip(id: string, email: string): Promise<void> {
    return this.request<void>(`/trips/${id}/unshare`, {
      method: 'POST',
      body: JSON.stringify({ email })
    })
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health')
  }

  // Privacy endpoints
  async exportData(): Promise<any> {
    return this.request<any>('/privacy/export')
  }

  async deleteData(): Promise<any> {
    return this.request<any>('/privacy/delete', { method: 'POST' })
  }

  // Route Optimization API
  async optimizeRoute(stops: Stop[]): Promise<RouteResult> {
    return this.request<RouteResult>('/routes/optimize', {
      method: 'POST',
      body: JSON.stringify({ stops })
    });
  }
}

export const apiService = new ApiService()
