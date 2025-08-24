# Friendly Fallbacks Testing Guide

## Testing the Implementation

### 1. Testing 404 Route

**Navigate to non-existent routes:**
```
http://localhost:5173/nonexistent
http://localhost:5173/invalid-path  
http://localhost:5173/plan/missing
```

**Expected Behavior:**
- Shows custom 404 page with clear messaging
- "Go Home" button navigates back to root
- "Trip Planner" link provides alternative navigation
- Error ID displayed for support tracking
- Accessible design with proper ARIA labels

### 2. Testing Search Error Boundary

**Simulate search component errors:**

In `Plan.tsx`, temporarily add this to trigger an error:
```typescript
// Add to searchPlaces function for testing
if (searchQuery === 'error') {
  throw new Error('Test search error boundary');
}
```

**Test Steps:**
1. Navigate to `/plan`
2. Search for "error"
3. Observe error boundary activation

**Expected Behavior:**
- Search error boundary catches the error
- Rest of the application remains functional
- Error message shows with correlation ID
- "Try Again" and "Go Home" buttons available
- Error logged to console with correlation ID

### 3. Testing Correlation ID Logging

**Check browser console:**
```javascript
// View current correlation ID
sessionStorage.getItem('daylight_correlation_id')

// Trigger an error and check logging
console.log('Check for correlation ID in error logs')
```

**Test API Error Handling:**
1. Disconnect network
2. Try to search for places
3. Check error logs for correlation ID

**Expected Behavior:**
- Unique correlation ID generated per session
- All errors logged with correlation ID
- Error context includes component, action, browser info
- Correlation ID persists across page reloads
- Sentry integration captures errors (if configured)

### 4. Testing Global Error Boundary

**Simulate app-level crashes:**

Add to any component:
```typescript
// Trigger global error boundary
throw new Error('Test global error boundary');
```

**Expected Behavior:**
- Global error boundary catches unhandled errors
- Full-page error fallback with recovery options
- Correlation ID displayed prominently
- Multiple recovery strategies offered
- Development stack trace (in dev mode)

## Verification Checklist

### ✅ 404 Route Implementation
- [ ] Custom 404 page renders for invalid routes
- [ ] "Go Home" link navigates to root (`/`)
- [ ] Alternative navigation options available
- [ ] Clear, helpful error messaging
- [ ] Accessible design with ARIA labels
- [ ] Responsive layout for all devices

### ✅ Search Error Boundary
- [ ] Wraps search functionality in `Plan.tsx`
- [ ] Catches React component errors
- [ ] Shows contextual error message
- [ ] Provides "Try Again" functionality
- [ ] Includes "Go Home" fallback option
- [ ] Displays correlation ID for support
- [ ] Maintains app functionality outside search

### ✅ Correlation ID System
- [ ] Generates unique IDs per session
- [ ] Persists IDs in sessionStorage
- [ ] Includes IDs in all error logs
- [ ] Shows IDs to users in error messages
- [ ] Integrates with Sentry for tracking
- [ ] Adds context (component, action, browser info)
- [ ] Survives page reloads and navigation

### ✅ Error Logging Enhancement
- [ ] Structured error information in console
- [ ] Component and action context included
- [ ] Browser and session metadata captured
- [ ] Sentry integration working (if configured)
- [ ] Development debugging information
- [ ] User-friendly error presentation

## Browser Developer Tools Testing

### Console Verification:
```javascript
// Check correlation ID persistence
sessionStorage.getItem('daylight_correlation_id')

// Verify error structure
// Look for logs like: [correlation-id] Error in ComponentName:
```

### Network Tab:
```
// Check for correlation ID headers in requests
X-Correlation-ID: timestamp-random
```

### Application Tab:
```
// SessionStorage should contain:
daylight_correlation_id: "timestamp-random"
```

## Manual Test Scenarios

### Scenario 1: New User Journey
1. Fresh browser session
2. Navigate to app
3. Trigger an error
4. Verify correlation ID generation
5. Check error logging

### Scenario 2: Error Recovery
1. Navigate to search page
2. Trigger search error
3. Use "Try Again" button
4. Verify error clearing
5. Confirm functionality restoration

### Scenario 3: Navigation Fallbacks
1. Navigate to invalid URL
2. Use "Go Home" from 404 page
3. Navigate to valid pages
4. Verify normal functionality

### Scenario 4: Session Persistence
1. Generate correlation ID (trigger error)
2. Reload page
3. Trigger another error
4. Verify same correlation ID used
5. Check session storage

## Error Simulation Commands

### React Error Boundary Test:
```typescript
// Add to any component render method
if (Math.random() > 0.5) throw new Error('Random error test');
```

### API Error Test:
```typescript
// Modify API client to simulate failures
throw new Error('Simulated API failure');
```

### Network Error Test:
```bash
# Disconnect network and try API calls
# Or use browser dev tools to throttle network
```

---

*Use this guide to verify all friendly fallback implementations are working correctly.*
