# Cognito Authentication Implementation

This document describes the complete AWS Cognito authentication system implemented for the Daylight trip planning application.

## Overview

The authentication system provides:
- User registration and email verification
- Secure login with JWT tokens
- Role-based access control (RBAC)
- Protected API routes
- Frontend authentication state management
- Automatic token refresh and session management

## Architecture

### Backend Components

#### AWS Cognito Infrastructure (`infra/terraform/main.tf`)
- **Cognito User Pool**: Manages user identities with custom attributes
- **User Pool Client**: Handles authentication flows
- **Cognito Domain**: Provides hosted authentication endpoints
- **API Gateway Authorizer**: Validates JWT tokens for protected routes

#### Authentication Middleware (`backend/src/lib/auth.js`)
- JWT token verification using JWKS
- Role-based permission checking
- User authentication and authorization utilities

#### Protected API Routes (`backend/src/handlers/trips.ts`)
- Complete RBAC implementation for trip management
- User ownership and sharing permissions
- Role hierarchy: viewer < editor < owner

### Frontend Components

#### Authentication Service (`frontend/src/services/authService.ts`)
- AWS Amplify integration for Cognito operations
- Sign up, sign in, sign out functionality
- Session management and token handling

#### Authentication Store (`frontend/src/stores/authStore.ts`)
- Zustand-based state management
- Persistent authentication state
- User profile and token storage

#### Authentication Components
- **LoginForm**: User sign-in interface
- **SignupForm**: User registration with validation
- **ConfirmationForm**: Email verification workflow
- **ProtectedRoute**: Route protection with role requirements
- **UserMenu**: Authenticated user interface

#### API Service (`frontend/src/services/apiService.ts`)
- Authenticated API calls with automatic token inclusion
- Trip management with user permissions
- Error handling and response processing

## User Roles and Permissions

### Role Hierarchy
1. **Viewer**: Read-only access to own trips and shared trips
2. **Editor**: Can create and edit own trips, edit shared trips with editor access
3. **Owner**: Full access to trips, can share trips with others, admin capabilities

### Permission Matrix
| Action | Viewer | Editor | Owner |
|--------|--------|--------|--------|
| View own trips | ✅ | ✅ | ✅ |
| View shared trips | ✅ | ✅ | ✅ |
| Create trips | ❌ | ✅ | ✅ |
| Edit own trips | ❌ | ✅ | ✅ |
| Edit shared trips | ❌ | ✅* | ✅ |
| Delete own trips | ❌ | ✅ | ✅ |
| Share trips | ❌ | ❌ | ✅ |
| Admin operations | ❌ | ❌ | ✅ |

*Editor can only edit if explicitly granted editor access to the trip

## Configuration

### Environment Variables

#### Frontend (`.env.local`)
```bash
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_USER_POOL_CLIENT_ID=your-client-id
VITE_COGNITO_DOMAIN=your-cognito-domain.auth.us-east-1.amazoncognito.com
```

#### Backend Environment Variables
Set via Terraform outputs and Lambda environment variables:
- `COGNITO_USER_POOL_ID`
- `COGNITO_USER_POOL_CLIENT_ID`
- `AWS_REGION`

### Terraform Configuration

The Cognito infrastructure is defined in `infra/terraform/main.tf`:

```hcl
# User Pool with custom attributes
resource "aws_cognito_user_pool" "daylight_user_pool" {
  name = "daylight-user-pool-${var.stage}"
  
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  schema {
    name     = "user_role"
    attribute_data_type = "String"
    required = false
    mutable  = true
  }
}
```

## API Routes

### Public Routes
- `GET /health` - Health check
- `GET /plan` - Trip suggestions (no auth required)

### Protected Routes
All require valid JWT token with appropriate role:

#### Trip Management
- `GET /trips` - List user's trips (viewer+)
- `POST /trips` - Create new trip (editor+)
- `GET /trips/{id}` - Get trip details (viewer+ with access)
- `PUT /trips/{id}` - Update trip (editor+ with permission)
- `DELETE /trips/{id}` - Delete trip (owner of trip)

#### Trip Sharing
- `POST /trips/{id}/share` - Share trip with user (owner only)
- `POST /trips/{id}/unshare` - Remove trip access (owner only)

## Authentication Flow

### Registration Flow
1. User submits registration form
2. Frontend calls `AuthService.signUp()`
3. Cognito sends verification email
4. User enters confirmation code
5. Frontend calls `AuthService.confirmSignUp()`
6. Account is activated with default 'viewer' role

### Login Flow
1. User submits login credentials
2. Frontend calls `AuthService.signIn()`
3. Cognito validates credentials and returns JWT tokens
4. Frontend stores tokens and user info in auth store
5. Subsequent API calls include JWT token in Authorization header

### Protected Route Access
1. User navigates to protected route
2. `ProtectedRoute` component checks authentication status
3. If not authenticated, redirects to `/auth`
4. If authenticated but insufficient role, shows access denied
5. If authorized, renders the protected content

## Security Features

### JWT Token Validation
- Tokens are validated using JWKS from Cognito
- Token expiration is checked on each request
- Invalid tokens result in 401 Unauthorized response

### Role-Based Access Control
- User roles are stored in Cognito custom attributes
- Backend validates user permissions for each operation
- Frontend shows/hides UI elements based on user role

### API Security
- All sensitive operations require authentication
- User can only access their own resources or explicitly shared resources
- SQL injection protection through parameterized queries
- XSS protection through proper input validation

## Development Setup

### Prerequisites
1. AWS CLI configured with appropriate permissions
2. Terraform installed
3. Node.js 18+ for backend and frontend

### Deployment Steps

1. **Deploy Infrastructure**:
   ```bash
   cd infra/terraform
   terraform init
   terraform plan
   terraform apply
   ```

2. **Configure Environment Variables**:
   - Copy Terraform outputs to frontend `.env.local`
   - Verify Lambda environment variables are set

3. **Build and Deploy Backend**:
   ```bash
   cd backend
   npm install
   npm run build
   # Deploy via Terraform or AWS CLI
   ```

4. **Configure Frontend**:
   ```bash
   cd frontend
   npm install
   # Update .env.local with Cognito configuration
   npm run build
   ```

### Local Development

1. **Start Backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Access Application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5174

## Testing

### Manual Testing Scenarios

1. **User Registration**:
   - Register new user with valid email
   - Verify email confirmation flow
   - Confirm account activation

2. **Authentication**:
   - Test login with valid credentials
   - Test login with invalid credentials
   - Verify token persistence across page refreshes

3. **Role-Based Access**:
   - Test viewer role limitations
   - Test editor trip creation
   - Test owner sharing capabilities

4. **API Protection**:
   - Verify unauthenticated requests are rejected
   - Test insufficient role permissions
   - Confirm proper error messages

### Automated Testing

Run the test suites:
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

## Troubleshooting

### Common Issues

1. **Cognito Configuration Errors**:
   - Verify environment variables are correctly set
   - Check Cognito domain and client configuration
   - Ensure OAuth settings match application URLs

2. **JWT Token Issues**:
   - Check token expiration
   - Verify JWKS endpoint accessibility
   - Confirm token format and signature

3. **Permission Denied Errors**:
   - Verify user role is correctly set in Cognito
   - Check API route permission requirements
   - Confirm user has access to requested resources

### Debug Commands

1. **Check Cognito Configuration**:
   ```bash
   aws cognito-idp describe-user-pool --user-pool-id <pool-id>
   ```

2. **Verify JWT Token**:
   ```bash
   # Decode JWT token (use online JWT decoder)
   echo "<token>" | base64 -d
   ```

3. **Test API Endpoints**:
   ```bash
   # Test with authorization header
   curl -H "Authorization: Bearer <token>" https://api.daylight.app/trips
   ```

## Security Considerations

### Production Deployment

1. **Environment Variables**:
   - Use AWS Systems Manager Parameter Store or Secrets Manager
   - Never commit sensitive credentials to version control
   - Rotate secrets regularly

2. **Network Security**:
   - Use HTTPS for all communications
   - Configure proper CORS policies
   - Implement rate limiting

3. **Monitoring**:
   - Set up CloudWatch alarms for authentication failures
   - Monitor API usage patterns
   - Log security events for audit trails

### Security Best Practices

1. **Token Management**:
   - Implement automatic token refresh
   - Use secure storage for sensitive data
   - Clear tokens on logout

2. **Input Validation**:
   - Validate all user inputs on both frontend and backend
   - Sanitize data before database operations
   - Use parameterized queries for database access

3. **Error Handling**:
   - Don't expose sensitive information in error messages
   - Log errors for debugging without revealing secrets
   - Implement proper error boundaries in frontend

## Future Enhancements

### Planned Features

1. **Multi-Factor Authentication (MFA)**:
   - SMS-based verification
   - TOTP app integration
   - Backup codes

2. **Social Login**:
   - Google OAuth integration
   - Facebook login
   - Apple Sign In

3. **Advanced RBAC**:
   - Organization-level permissions
   - Custom role definitions
   - Permission inheritance

4. **Session Management**:
   - Device tracking
   - Session revocation
   - Concurrent session limits

### Technical Improvements

1. **Performance Optimization**:
   - Token caching strategies
   - API response caching
   - Database query optimization

2. **Monitoring and Analytics**:
   - User authentication metrics
   - Performance monitoring
   - Security event tracking

3. **Testing Coverage**:
   - Automated integration tests
   - Security penetration testing
   - Load testing for authentication endpoints

---

This authentication system provides a robust foundation for the Daylight application with enterprise-level security and scalability features.
