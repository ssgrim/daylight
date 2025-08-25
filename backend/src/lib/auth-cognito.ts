// AWS Cognito Authentication Implementation
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { APIGatewayProxyEventV2 } from "aws-lambda";

interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
}

interface AuthResult {
  isValid: boolean;
  userId?: string;
  username?: string;
  email?: string;
  groups?: string[];
  error?: string;
}

// Initialize Cognito JWT verifier
let jwtVerifier: any = null;

function getJwtVerifier(): any {
  if (!jwtVerifier) {
    const config = getCognitoConfig();
    if (!config) {
      throw new Error("Cognito configuration not found");
    }

    jwtVerifier = CognitoJwtVerifier.create({
      userPoolId: config.userPoolId,
      tokenUse: "access",
      clientId: config.clientId,
    });
  }
  return jwtVerifier;
}

function getCognitoConfig(): CognitoConfig | null {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const region =
    process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-west-1";

  if (!userPoolId || !clientId) {
    console.warn(
      "Cognito configuration missing. Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID environment variables.",
    );
    return null;
  }

  return { userPoolId, clientId, region };
}

/**
 * Authenticate request using AWS Cognito JWT token
 */
export async function authenticateRequest(
  event: APIGatewayProxyEventV2,
): Promise<AuthResult> {
  try {
    // Extract authorization header
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;

    if (!authHeader) {
      return { isValid: false, error: "Missing authorization header" };
    }

    if (!authHeader.startsWith("Bearer ")) {
      return {
        isValid: false,
        error: "Invalid authorization format. Expected: Bearer <token>",
      };
    }

    const token = authHeader.substring(7);

    if (!token) {
      return { isValid: false, error: "Empty token" };
    }

    // Check if Cognito is configured
    const config = getCognitoConfig();
    if (!config) {
      // Fallback for development - accept dev tokens
      if (process.env.NODE_ENV === "development" && token === "dev-token") {
        return {
          isValid: true,
          userId: "dev-user-123",
          username: "dev-user",
          email: "dev@example.com",
        };
      }
      return { isValid: false, error: "Authentication service not configured" };
    }

    // Verify JWT token with Cognito
    try {
      const verifier = getJwtVerifier();
      const payload = await verifier.verify(token);

      return {
        isValid: true,
        userId: payload.sub,
        username: payload.username || payload["cognito:username"],
        email: payload.email,
        groups: payload["cognito:groups"] || [],
      };
    } catch (verifyError: any) {
      console.error("JWT verification failed:", verifyError.message);

      // Provide specific error messages for common issues
      if (verifyError.message.includes("expired")) {
        return { isValid: false, error: "Token expired" };
      } else if (verifyError.message.includes("invalid")) {
        return { isValid: false, error: "Invalid token" };
      } else {
        return { isValid: false, error: "Token verification failed" };
      }
    }
  } catch (error: any) {
    console.error("Authentication error:", error);
    return { isValid: false, error: "Authentication service error" };
  }
}

/**
 * Check if user has required role/group
 */
export function hasRole(authResult: AuthResult, requiredRole: string): boolean {
  if (!authResult.isValid || !authResult.groups) {
    return false;
  }

  return authResult.groups.includes(requiredRole);
}

/**
 * Check if user is admin
 */
export function isAdmin(authResult: AuthResult): boolean {
  return hasRole(authResult, "admin") || hasRole(authResult, "administrators");
}

/**
 * Generate authentication setup instructions
 */
export function getAuthSetupInstructions(): string {
  return `
To set up AWS Cognito authentication:

1. Create Cognito User Pool:
   aws cognito-idp create-user-pool --pool-name daylight-users --region us-west-1

2. Create Cognito User Pool Client:
   aws cognito-idp create-user-pool-client --user-pool-id <pool-id> --client-name daylight-app

3. Set environment variables:
   export COGNITO_USER_POOL_ID=us-west-1_xxxxxxxxx
   export COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
   export AWS_REGION=us-west-1

4. Install dependencies:
   npm install aws-jwt-verify

For development, you can use the dev token: "dev-token"
`;
}

/**
 * Development helper - create test user
 */
export async function createTestUser(
  username: string,
  email: string,
  tempPassword: string,
): Promise<void> {
  const config = getCognitoConfig();
  if (!config) {
    throw new Error("Cognito not configured");
  }

  try {
    const { CognitoIdentityProviderClient, AdminCreateUserCommand } =
      await import("@aws-sdk/client-cognito-identity-provider");

    const client = new CognitoIdentityProviderClient({ region: config.region });

    const command = new AdminCreateUserCommand({
      UserPoolId: config.userPoolId,
      Username: username,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
      ],
      TemporaryPassword: tempPassword,
      MessageAction: "SUPPRESS", // Don't send welcome email
    });

    await client.send(command);
    console.log(`Test user created: ${username}`);
  } catch (error: any) {
    console.error("Failed to create test user:", error.message);
    throw error;
  }
}
