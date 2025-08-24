// Simple dev server for testing
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock Places API endpoint
app.get('/places', (req, res) => {
  const query = req.query.query || '';
  
  // Input validation (same as production)
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Query parameter is required and must be a string',
      field: 'query',
      type: 'validation_error'
    });
  }
  
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return res.status(400).json({
      error: 'Validation failed', 
      message: 'Query parameter cannot be empty',
      field: 'query',
      type: 'validation_error'
    });
  }
  
  if (trimmedQuery.length > 120) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Query parameter must be 120 characters or less',
      field: 'query', 
      type: 'validation_error'
    });
  }

  // Mock response for testing
  const mockResults = [
    {
      name: `Test Coffee Shop (${trimmedQuery})`,
      address: '123 Test St, Pasadena, CA 91101, USA',
      rating: 4.5,
      place_id: 'test_place_id_1',
      location: { lat: 34.1478, lng: -118.1445 }
    },
    {
      name: `Another Cafe (${trimmedQuery})`, 
      address: '456 Sample Ave, Pasadena, CA 91103, USA',
      rating: 4.2,
      place_id: 'test_place_id_2',
      location: { lat: 34.1561, lng: -118.1318 }
    }
  ];

  // Filter results based on query for more realistic testing
  const filteredResults = query.toLowerCase().includes('coffee') || query.toLowerCase().includes('pasadena') 
    ? mockResults 
    : [];

  res.json({
    query: trimmedQuery,
    count: filteredResults.length,
    results: filteredResults
  });
});

// Mock Plan API endpoint  
app.get('/plan', (req, res) => {
  const { lat, lng } = req.query;
  
  // Validate coordinates if provided
  if ((lat !== undefined || lng !== undefined)) {
    const numLat = Number(lat);
    const numLng = Number(lng);
    
    if (isNaN(numLat) || isNaN(numLng)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Latitude and longitude must be valid numbers',
        field: 'coordinates',
        type: 'validation_error'
      });
    }
    
    if (numLat < -90 || numLat > 90) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Latitude must be between -90 and 90 degrees',
        field: 'lat',
        type: 'validation_error'
      });
    }
    
    if (numLng < -180 || numLng > 180) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Longitude must be between -180 and 180 degrees', 
        field: 'lng',
        type: 'validation_error'
      });
    }
  }

  const now = new Date().toISOString();
  const location = lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined;
  
  const result = [{
    id: '1',
    title: location 
      ? `Demo Stop near ${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`
      : 'Demo Stop',
    start: now,
    end: now,
    score: 95,
    location
  }];

  res.json(result);
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    type: 'not_found_error'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    type: 'internal_error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Dev server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Places API: http://localhost:${PORT}/places?query=coffee`);
  console.log(`📍 Plan API: http://localhost:${PORT}/plan?lat=34.1&lng=-118.1`);
});
