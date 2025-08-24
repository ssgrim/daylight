// Input validation utilities for API endpoints

/**
 * Validation error class
 */
class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Validate query parameter
 * @param {string} query - Query string to validate
 * @throws {ValidationError} If validation fails
 */
function validateQuery(query) {
  if (!query || typeof query !== 'string') {
    throw new ValidationError('Query parameter is required and must be a string', 'query');
  }
  
  const trimmedQuery = query.trim();
  
  if (trimmedQuery.length === 0) {
    throw new ValidationError('Query parameter cannot be empty', 'query');
  }
  
  if (trimmedQuery.length > 120) {
    throw new ValidationError('Query parameter must be 120 characters or less', 'query');
  }
  
  return trimmedQuery;
}

/**
 * Validate coordinates
 * @param {any} lat - Latitude value
 * @param {any} lng - Longitude value
 * @throws {ValidationError} If validation fails
 */
function validateCoordinates(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  
  if (isNaN(numLat) || isNaN(numLng)) {
    throw new ValidationError('Latitude and longitude must be valid numbers', 'coordinates');
  }
  
  if (numLat < -90 || numLat > 90) {
    throw new ValidationError('Latitude must be between -90 and 90 degrees', 'lat');
  }
  
  if (numLng < -180 || numLng > 180) {
    throw new ValidationError('Longitude must be between -180 and 180 degrees', 'lng');
  }
  
  return { lat: numLat, lng: numLng };
}

/**
 * Create standardized validation error response
 * @param {ValidationError} error - Validation error
 * @returns {object} API error response
 */
function createValidationErrorResponse(error) {
  return {
    statusCode: 400,
    headers: {
      'Content-Type': 'application/json'
      // CORS headers will be added by the handler using the CORS utility
    },
    body: JSON.stringify({
      error: 'Validation failed',
      message: error.message,
      field: error.field,
      type: 'validation_error'
    })
  };
}

/**
 * Validate and sanitize input with error handling wrapper
 * @param {Function} validationFn - Validation function to execute
 * @returns {object} Either validation result or error response
 */
function validateWith(validationFn) {
  try {
    return { success: true, data: validationFn() };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, response: createValidationErrorResponse(error) };
    }
    throw error; // Re-throw non-validation errors
  }
}

module.exports = {
  ValidationError,
  validateQuery,
  validateCoordinates,
  createValidationErrorResponse,
  validateWith
};
