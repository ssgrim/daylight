/**
 * Advanced Trips Management with Search Functionality
 * Provides comprehensive CRUD operations with filtering, sorting, and search
 */

import { APIGatewayProxyHandlerV2 } from 'aws-lambda'

// Simple in-memory cache for development
interface SimpleCache {
  get(key: string): Promise<any>
  set(key: string, value: any, ttlMs?: number): Promise<void>
  clear(): Promise<void>
}

// Create a simple cache implementation
function createSimpleCache(): SimpleCache {
  const cache = new Map<string, { value: any; expires: number }>()
  
  return {
    async get(key: string) {
      const item = cache.get(key)
      if (!item) return undefined
      if (Date.now() > item.expires) {
        cache.delete(key)
        return undefined
      }
      return item.value
    },
    
    async set(key: string, value: any, ttlMs = 60000) {
      cache.set(key, {
        value,
        expires: Date.now() + ttlMs
      })
    },
    
    async clear() {
      cache.clear()
    }
  }
}

// Enhanced Trip interface
export interface Trip {
  tripId: string
  ownerId: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  tags: string[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
  anchors: Array<{
    lat: number
    lng: number
    name: string
    description?: string
  }>
  preferences?: Record<string, any>
  metadata?: Record<string, any>
}

// Search and filter parameters
export interface TripSearchParams {
  limit?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'name'
  sortOrder?: 'asc' | 'desc'
  status?: string
  tag?: string
  search?: string
  lastKey?: string
  ownerId?: string
}

// In-memory storage for development (replace with DynamoDB in production)
const trips: Map<string, Trip> = new Map()

// Simple cache for search results
const cache = createSimpleCache()

/**
 * Generate a unique trip ID
 */
function generateTripId(): string {
  return `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new trip
 */
export async function createTrip(tripData: Partial<Trip>, ownerId: string): Promise<Trip> {
  const tripId = generateTripId()
  const now = new Date().toISOString()
  
  const trip: Trip = {
    tripId,
    ownerId,
    name: tripData.name || 'Untitled Trip',
    description: tripData.description,
    status: tripData.status || 'draft',
    tags: tripData.tags || [],
    isPublic: tripData.isPublic || false,
    createdAt: now,
    updatedAt: now,
    anchors: tripData.anchors || [],
    preferences: tripData.preferences,
    metadata: tripData.metadata
  }
  
  trips.set(tripId, trip)
  
  // Clear search cache when new trip is created
  if (cache) {
    await cache.clear()
  }
  
  return trip
}

/**
 * Get a single trip by ID
 */
export async function getTrip(tripId: string, ownerId: string): Promise<Trip | null> {
  const trip = trips.get(tripId)
  if (!trip || trip.ownerId !== ownerId) {
    return null
  }
  return trip
}

/**
 * Update an existing trip
 */
export async function updateTrip(tripId: string, updates: Partial<Trip>, ownerId: string): Promise<Trip | null> {
  const existing = trips.get(tripId)
  if (!existing || existing.ownerId !== ownerId) {
    return null
  }
  
  const updated: Trip = {
    ...existing,
    ...updates,
    tripId, // Ensure ID can't be changed
    ownerId, // Ensure owner can't be changed
    updatedAt: new Date().toISOString()
  }
  
  trips.set(tripId, updated)
  
  // Clear search cache when trip is updated
  if (cache) {
    await cache.clear()
  }
  
  return updated
}

/**
 * Delete a trip
 */
export async function deleteTrip(tripId: string, ownerId: string): Promise<boolean> {
  const existing = trips.get(tripId)
  if (!existing || existing.ownerId !== ownerId) {
    return false
  }
  
  trips.delete(tripId)
  
  // Clear search cache when trip is deleted
  if (cache) {
    await cache.clear()
  }
  
  return true
}

/**
 * Advanced search functionality with filtering, sorting, and pagination
 */
export async function searchTrips(params: TripSearchParams): Promise<{
  items: Trip[]
  count: number
  hasMore: boolean
  lastKey?: string
}> {
  const {
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    status,
    tag,
    search,
    lastKey,
    ownerId
  } = params
  
  // Generate cache key for search results
  const cacheKey = `trips:search:${JSON.stringify(params)}`
  
  // Check cache first
  if (cache) {
    const cached = await cache.get(cacheKey)
    if (cached) {
      return cached
    }
  }
  
  // Get all trips for the owner
  let userTrips = Array.from(trips.values()).filter(trip => 
    !ownerId || trip.ownerId === ownerId
  )
  
  // Apply filters
  if (status) {
    userTrips = userTrips.filter(trip => trip.status === status)
  }
  
  if (tag) {
    userTrips = userTrips.filter(trip => trip.tags.includes(tag))
  }
  
  if (search) {
    const searchLower = search.toLowerCase()
    userTrips = userTrips.filter(trip => 
      trip.name.toLowerCase().includes(searchLower) ||
      (trip.description && trip.description.toLowerCase().includes(searchLower)) ||
      trip.tags.some(t => t.toLowerCase().includes(searchLower))
    )
  }
  
  // Apply sorting
  userTrips.sort((a, b) => {
    let aValue: any, bValue: any
    
    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
        break
      case 'updatedAt':
        aValue = new Date(a.updatedAt).getTime()
        bValue = new Date(b.updatedAt).getTime()
        break
      case 'createdAt':
      default:
        aValue = new Date(a.createdAt).getTime()
        bValue = new Date(b.createdAt).getTime()
        break
    }
    
    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    }
  })
  
  // Handle pagination
  let startIndex = 0
  if (lastKey) {
    try {
      const decoded = JSON.parse(Buffer.from(lastKey, 'base64').toString())
      const lastTripId = decoded.tripId
      startIndex = userTrips.findIndex(trip => trip.tripId === lastTripId) + 1
    } catch (e) {
      // Invalid lastKey, start from beginning
      startIndex = 0
    }
  }
  
  const endIndex = Math.min(startIndex + limit, userTrips.length)
  const items = userTrips.slice(startIndex, endIndex)
  const hasMore = endIndex < userTrips.length
  
  let nextLastKey: string | undefined
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1]
    nextLastKey = Buffer.from(JSON.stringify({ tripId: lastItem.tripId })).toString('base64')
  }
  
  const result = {
    items,
    count: items.length,
    hasMore,
    lastKey: nextLastKey
  }
  
  // Cache the results
  if (cache) {
    await cache.set(cacheKey, result, 60000) // Cache for 1 minute
  }
  
  return result
}

/**
 * Get search suggestions based on partial input
 */
export async function getSearchSuggestions(query: string, ownerId: string): Promise<{
  names: string[]
  tags: string[]
  descriptions: string[]
}> {
  const queryLower = query.toLowerCase()
  const userTrips = Array.from(trips.values()).filter(trip => 
    trip.ownerId === ownerId
  )
  
  const names = new Set<string>()
  const tags = new Set<string>()
  const descriptions = new Set<string>()
  
  userTrips.forEach(trip => {
    // Collect matching names
    if (trip.name.toLowerCase().includes(queryLower)) {
      names.add(trip.name)
    }
    
    // Collect matching tags
    trip.tags.forEach(tag => {
      if (tag.toLowerCase().includes(queryLower)) {
        tags.add(tag)
      }
    })
    
    // Collect matching description phrases
    if (trip.description && trip.description.toLowerCase().includes(queryLower)) {
      const words = trip.description.split(' ')
      words.forEach((word, index) => {
        if (word.toLowerCase().includes(queryLower) && words.length > index + 1) {
          descriptions.add(words.slice(index, index + 3).join(' '))
        }
      })
    }
  })
  
  return {
    names: Array.from(names).slice(0, 5),
    tags: Array.from(tags).slice(0, 10),
    descriptions: Array.from(descriptions).slice(0, 5)
  }
}

/**
 * Get trip statistics for the owner
 */
export async function getTripStats(ownerId: string): Promise<{
  total: number
  byStatus: Record<string, number>
  topTags: Array<{ tag: string; count: number }>
  recentActivity: number
}> {
  const userTrips = Array.from(trips.values()).filter(trip => 
    trip.ownerId === ownerId
  )
  
  const byStatus: Record<string, number> = {}
  const tagCounts: Record<string, number> = {}
  
  let recentActivity = 0
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime()
  
  userTrips.forEach(trip => {
    // Count by status
    byStatus[trip.status] = (byStatus[trip.status] || 0) + 1
    
    // Count tags
    trip.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
    
    // Count recent activity
    if (new Date(trip.updatedAt).getTime() > oneWeekAgo) {
      recentActivity++
    }
  })
  
  const topTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
  
  return {
    total: userTrips.length,
    byStatus,
    topTags,
    recentActivity
  }
}

/**
 * Initialize with some sample data for development
 */
export async function initializeSampleData() {
  const sampleTrips = [
    {
      name: 'Mountain Adventure',
      description: 'Epic hiking in the Rocky Mountains with stunning views',
      status: 'active' as const,
      tags: ['hiking', 'mountains', 'adventure', 'nature'],
      isPublic: true,
      anchors: [
        { lat: 40.3772, lng: -105.5217, name: 'Rocky Mountain National Park' },
        { lat: 40.4619, lng: -105.5378, name: 'Bear Lake Trailhead' }
      ]
    },
    {
      name: 'City Food Tour',
      description: 'Exploring the best restaurants and food trucks in downtown',
      status: 'completed' as const,
      tags: ['food', 'city', 'restaurants', 'culture'],
      isPublic: false,
      anchors: [
        { lat: 39.7392, lng: -104.9903, name: 'Denver Downtown' },
        { lat: 39.7516, lng: -104.9969, name: 'RiNo District' }
      ]
    },
    {
      name: 'Beach Relaxation',
      description: 'A peaceful weekend by the ocean with sun and surf',
      status: 'draft' as const,
      tags: ['beach', 'relaxation', 'ocean', 'weekend'],
      isPublic: true,
      anchors: [
        { lat: 32.7157, lng: -117.1611, name: 'La Jolla Cove' },
        { lat: 32.6801, lng: -117.2340, name: 'Sunset Cliffs' }
      ]
    }
  ]
  
  const ownerId = 'user-123'
  
  for (const tripData of sampleTrips) {
    await createTrip(tripData, ownerId)
  }
  
  console.log('Sample trip data initialized')
}
