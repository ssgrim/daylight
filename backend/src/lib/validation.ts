/**
 * Data Validation Schemas
 * Provides comprehensive validation for all API inputs and data structures
 */

import { z } from 'zod'

// Base validation schemas
export const ISODateTimeSchema = z.string().datetime({ message: 'Must be a valid ISO 8601 datetime string' })

export const CoordinateSchema = z.object({
  lat: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  lng: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
})

// Anchor validation schema
export const AnchorSchema = z.object({
  id: z.string()
    .min(1, 'Anchor ID cannot be empty')
    .max(100, 'Anchor ID cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Anchor ID can only contain alphanumeric characters, hyphens, and underscores'),
  name: z.string()
    .min(1, 'Anchor name cannot be empty')
    .max(200, 'Anchor name cannot exceed 200 characters')
    .trim(),
  start: ISODateTimeSchema,
  end: ISODateTimeSchema,
  lat: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  lng: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  locked: z.boolean().optional()
}).refine(data => {
  const start = new Date(data.start)
  const end = new Date(data.end)
  return start < end
}, {
  message: 'End time must be after start time',
  path: ['end']
})

// Trip validation schemas
export const TripCreateSchema = z.object({
  tripId: z.string()
    .min(1, 'Trip ID cannot be empty')
    .max(100, 'Trip ID cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Trip ID can only contain alphanumeric characters, hyphens, and underscores'),
  name: z.string()
    .min(1, 'Trip name cannot be empty')
    .max(300, 'Trip name cannot exceed 300 characters')
    .trim()
    .optional(),
  anchors: z.array(AnchorSchema)
    .max(50, 'Cannot have more than 50 anchors per trip')
    .optional()
    .default([])
})

export const TripUpdateSchema = TripCreateSchema.partial().extend({
  tripId: z.string()
    .min(1, 'Trip ID cannot be empty')
    .max(100, 'Trip ID cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Trip ID can only contain alphanumeric characters, hyphens, and underscores')
})

export const TripSchema = TripCreateSchema.extend({
  createdAt: ISODateTimeSchema
})

// Preferences validation schema
export const PrefsSchema = z.object({
  heatMaxF: z.number()
    .min(-100, 'Heat max temperature cannot be below -100°F')
    .max(200, 'Heat max temperature cannot exceed 200°F')
    .optional(),
  driveCapMin: z.number()
    .min(0, 'Drive capacity cannot be negative')
    .max(1440, 'Drive capacity cannot exceed 24 hours (1440 minutes)')
    .optional(),
  weights: z.object({
    distance: z.number().min(0).max(10).optional(),
    rating: z.number().min(0).max(10).optional(),
    openNow: z.number().min(0).max(10).optional(),
    categoryAffinity: z.record(z.string(), z.number().min(0).max(10)).optional(),
    weather: z.number().min(0).max(10).optional(),
    crowding: z.number().min(0).max(10).optional(),
    cost: z.number().min(0).max(10).optional()
  }).optional()
})

// Plan request validation schema
export const PlanRequestSchema = z.object({
  suggestFor: z.string()
    .min(1, 'suggestFor cannot be empty')
    .max(100, 'suggestFor cannot exceed 100 characters'),
  now: ISODateTimeSchema.optional(),
  tripId: z.string()
    .min(1, 'Trip ID cannot be empty')
    .max(100, 'Trip ID cannot exceed 100 characters')
    .optional(),
  anchors: z.array(AnchorSchema)
    .max(50, 'Cannot have more than 50 anchors')
    .optional(),
  prefs: PrefsSchema.optional()
})

// Query parameter validation schemas
export const LatLngQuerySchema = z.object({
  lat: z.string()
    .refine(val => !isNaN(Number(val)), 'Latitude must be a valid number')
    .transform(val => Number(val))
    .refine(val => val >= -90 && val <= 90, 'Latitude must be between -90 and 90'),
  lng: z.string()
    .refine(val => !isNaN(Number(val)), 'Longitude must be a valid number')
    .transform(val => Number(val))
    .refine(val => val >= -180 && val <= 180, 'Longitude must be between -180 and 180')
})

export const PaginationQuerySchema = z.object({
  limit: z.string()
    .optional()
    .refine(val => !val || !isNaN(Number(val)), 'Limit must be a valid number')
    .transform(val => val ? Number(val) : 100)
    .refine(val => val >= 1 && val <= 1000, 'Limit must be between 1 and 1000'),
  offset: z.string()
    .optional()
    .refine(val => !val || !isNaN(Number(val)), 'Offset must be a valid number')
    .transform(val => val ? Number(val) : 0)
    .refine(val => val >= 0, 'Offset cannot be negative')
})

// Suggestion validation schema (for response validation)
export const SuggestionSchema = z.object({
  id: z.string().min(1, 'Suggestion ID cannot be empty'),
  title: z.string().min(1, 'Suggestion title cannot be empty'),
  start: ISODateTimeSchema,
  end: ISODateTimeSchema,
  score: z.number()
    .min(0, 'Score cannot be negative')
    .max(100, 'Score cannot exceed 100'),
  reason: z.string().optional()
}).refine(data => {
  const start = new Date(data.start)
  const end = new Date(data.end)
  return start <= end
}, {
  message: 'End time must be after or equal to start time',
  path: ['end']
})

export const PlanResponseSchema = z.array(SuggestionSchema)

// Path parameter validation schemas
export const TripIdParamSchema = z.object({
  tripId: z.string()
    .min(1, 'Trip ID cannot be empty')
    .max(100, 'Trip ID cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Trip ID can only contain alphanumeric characters, hyphens, and underscores')
})

// Generic validation schemas
export const NonEmptyStringSchema = z.string().min(1, 'Cannot be empty').trim()
export const OptionalNonEmptyStringSchema = z.string().min(1, 'Cannot be empty').trim().optional()

// Health check schema
export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: ISODateTimeSchema,
  version: z.string().optional(),
  checks: z.record(z.string(), z.object({
    status: z.enum(['pass', 'fail', 'warn']),
    time: z.string().optional(),
    output: z.string().optional()
  })).optional()
})

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  timestamp: ISODateTimeSchema,
  path: z.string().optional(),
  validationErrors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    code: z.string()
  })).optional()
})

// Export types inferred from schemas
export type Anchor = z.infer<typeof AnchorSchema>
export type TripCreate = z.infer<typeof TripCreateSchema>
export type TripUpdate = z.infer<typeof TripUpdateSchema>
export type Trip = z.infer<typeof TripSchema>
export type Prefs = z.infer<typeof PrefsSchema>
export type PlanRequest = z.infer<typeof PlanRequestSchema>
export type Suggestion = z.infer<typeof SuggestionSchema>
export type PlanResponse = z.infer<typeof PlanResponseSchema>
export type LatLngQuery = z.infer<typeof LatLngQuerySchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type TripIdParam = z.infer<typeof TripIdParamSchema>
export type HealthResponse = z.infer<typeof HealthResponseSchema>
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
