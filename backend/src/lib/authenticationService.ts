import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { 
  OAuth2Provider, 
  OAuth2Token, 
  AuthenticationContext,
  AuthenticateRequest,
  AuthenticateResponse,
  SecurityError as SecurityErrorType
} from '../../../shared/src/types/security';

// Custom error class for security errors
class SecurityError extends Error {
  public code: string;
  public details?: Record<string, any>;
  public timestamp: string;
  public requestId?: string;
  public userId?: string;
  public resource?: string;
  public action?: string;

  constructor(errorData: SecurityErrorType) {
    super(errorData.message);
    this.name = 'SecurityError';
    this.code = errorData.code;
    this.details = errorData.details;
    this.timestamp = errorData.timestamp;
    this.requestId = errorData.requestId;
    this.userId = errorData.userId;
    this.resource = errorData.resource;
    this.action = errorData.action;
  }
}
import { 
  docClient, 
  SECURITY_CONFIG, 
  KEY_PATTERNS,
  generateId,
  getTimestamp,
  createTTL,
  maskSensitiveData
} from './securityDb';
import { PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// OAuth2 & Authentication Service
// Issue #119 - Advanced Security Framework

export class AuthenticationService {
  private jwtSecret: string;
  private jwtIssuer: string;
  private providers: Map<string, OAuth2Provider> = new Map();

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    this.jwtIssuer = process.env.JWT_ISSUER || 'daylight-app';
    this.loadProviders();
  }

  // ===== OAuth2 Provider Management =====

  async addOAuth2Provider(provider: Omit<OAuth2Provider, 'id'>): Promise<OAuth2Provider> {
    const id = generateId();
    const fullProvider: OAuth2Provider = {
      id,
      ...provider,
      enabled: provider.enabled ?? true
    };

    const keys = KEY_PATTERNS.oauthProvider(id);
    
    await docClient.send(new PutCommand({
      TableName: SECURITY_CONFIG.TABLES.OAUTH_PROVIDERS,
      Item: {
        ...keys,
        ...fullProvider,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }));

    this.providers.set(id, fullProvider);
    return fullProvider;
  }

  async getOAuth2Provider(providerId: string): Promise<OAuth2Provider | null> {
    if (this.providers.has(providerId)) {
      return this.providers.get(providerId)!;
    }

    const keys = KEY_PATTERNS.oauthProvider(providerId);
    
    const result = await docClient.send(new GetCommand({
      TableName: SECURITY_CONFIG.TABLES.OAUTH_PROVIDERS,
      Key: keys
    }));

    if (!result.Item) {
      return null;
    }

    const provider = result.Item as OAuth2Provider;
    this.providers.set(providerId, provider);
    return provider;
  }

  private async loadProviders(): Promise<void> {
    try {
      const result = await docClient.send(new QueryCommand({
        TableName: SECURITY_CONFIG.TABLES.OAUTH_PROVIDERS,
        KeyConditionExpression: 'begins_with(PK, :prefix)',
        ExpressionAttributeValues: {
          ':prefix': 'provider#'
        }
      }));

      for (const item of result.Items || []) {
        const provider = item as OAuth2Provider;
        if (provider.enabled) {
          this.providers.set(provider.id, provider);
        }
      }
    } catch (error) {
      console.error('Failed to load OAuth2 providers:', error);
    }
  }

  // ===== OAuth2 Authentication Flow =====

  async initiateOAuth2Flow(providerId: string, redirectUri: string, state?: string): Promise<string> {
    const provider = await this.getOAuth2Provider(providerId);
    if (!provider || !provider.enabled) {
      throw new SecurityError({
        code: 'PROVIDER_NOT_FOUND',
        message: 'OAuth2 provider not found or disabled',
        timestamp: new Date().toISOString(),
        details: { providerId }
      });
    }

    // Generate PKCE parameters for security
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      scope: provider.scopes.join(' '),
      state: state || crypto.randomBytes(16).toString('hex'),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    // Store PKCE verifier for later validation
    await this.storePKCEVerifier(state || params.get('state')!, codeVerifier);

    return `${provider.authUrl}?${params.toString()}`;
  }

  async handleOAuth2Callback(request: AuthenticateRequest): Promise<AuthenticateResponse> {
    try {
      const provider = await this.getOAuth2Provider(request.provider);
      if (!provider) {
        throw new SecurityError({
          code: 'PROVIDER_NOT_FOUND',
          message: 'OAuth2 provider not found',
          timestamp: new Date().toISOString(),
          details: { provider: request.provider }
        });
      }

      // Exchange authorization code for tokens
      const tokenData = await this.exchangeCodeForTokens(
        provider,
        request.authorizationCode!,
        request.redirectUri!,
        request.codeVerifier!
      );

      // Get user info from provider
      const userInfo = await this.getUserInfo(provider, tokenData.accessToken);

      // Create authentication context
      const context = await this.createAuthenticationContext(
        provider,
        tokenData,
        userInfo,
        request
      );

      return {
        success: true,
        context
      };
    } catch (error) {
      const securityError = error as SecurityError;
      return {
        success: false,
        error: securityError.message
      };
    }
  }

  private async exchangeCodeForTokens(
    provider: OAuth2Provider,
    authorizationCode: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<OAuth2Token> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: provider.clientId,
      code: authorizationCode,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    });

    if (provider.clientSecret) {
      params.append('client_secret', provider.clientSecret);
    }

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new SecurityError({
        code: 'TOKEN_EXCHANGE_FAILED',
        message: 'Failed to exchange authorization code for tokens',
        timestamp: new Date().toISOString(),
        details: { status: response.status, statusText: response.statusText }
      });
    }

    const tokenResponse = await response.json();
    
    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      idToken: tokenResponse.id_token,
      tokenType: tokenResponse.token_type || 'Bearer',
      expiresIn: tokenResponse.expires_in || 3600,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
      scope: tokenResponse.scope ? tokenResponse.scope.split(' ') : provider.scopes,
      issuer: provider.name,
      audience: provider.clientId
    };
  }

  private async getUserInfo(provider: OAuth2Provider, accessToken: string): Promise<any> {
    if (!provider.userInfoUrl) {
      return {}; // Some providers include user info in ID token
    }

    const response = await fetch(provider.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new SecurityError({
        code: 'USER_INFO_FAILED',
        message: 'Failed to fetch user information',
        timestamp: new Date().toISOString(),
        details: { status: response.status }
      });
    }

    return response.json();
  }

  // ===== Session Management =====

  async createAuthenticationContext(
    provider: OAuth2Provider,
    tokenData: OAuth2Token,
    userInfo: any,
    request: AuthenticateRequest
  ): Promise<AuthenticationContext> {
    const sessionId = generateId();
    const userId = userInfo.sub || userInfo.id || userInfo.email;
    
    if (!userId) {
      throw new SecurityError({
        code: 'USER_ID_MISSING',
        message: 'Unable to extract user ID from provider response',
        timestamp: new Date().toISOString(),
        details: { provider: provider.name }
      });
    }

    const context: AuthenticationContext = {
      userId,
      sessionId,
      provider: provider.id,
      providerUserId: userId,
      authenticatedAt: getTimestamp(),
      expiresAt: getTimestamp() + (SECURITY_CONFIG.SESSION_TTL_HOURS * 60 * 60 * 1000),
      tokenData,
      mfaVerified: false, // Will be updated if MFA is performed
      ipAddress: request.additionalParams?.ipAddress || 'unknown',
      userAgent: request.additionalParams?.userAgent || 'unknown',
      metadata: {
        userInfo: maskSensitiveData(userInfo),
        authMethod: 'oauth2',
        provider: provider.name
      }
    };

    // Store session in database
    const keys = KEY_PATTERNS.authSession(sessionId, userId);
    
    await docClient.send(new PutCommand({
      TableName: SECURITY_CONFIG.TABLES.AUTH_SESSIONS,
      Item: {
        ...keys,
        ...context,
        ttl: createTTL(SECURITY_CONFIG.SESSION_TTL_HOURS / 24),
        createdAt: new Date().toISOString()
      }
    }));

    return context;
  }

  async validateSession(sessionId: string): Promise<AuthenticationContext | null> {
    try {
      // First try to find session by sessionId
      const result = await docClient.send(new QueryCommand({
        TableName: SECURITY_CONFIG.TABLES.AUTH_SESSIONS,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `session#${sessionId}`
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const session = result.Items[0] as AuthenticationContext;
      
      // Check if session is expired
      if (session.expiresAt < getTimestamp()) {
        await this.invalidateSession(sessionId);
        return null;
      }

      // Check if token needs refresh
      if (session.tokenData.expiresAt < getTimestamp() + SECURITY_CONFIG.TOKEN_REFRESH_THRESHOLD * 1000) {
        const refreshedContext = await this.refreshTokens(session);
        return refreshedContext || session;
      }

      return session;
    } catch (error) {
      console.error('Session validation failed:', error);
      return null;
    }
  }

  async refreshTokens(context: AuthenticationContext): Promise<AuthenticationContext | null> {
    if (!context.tokenData.refreshToken) {
      return null;
    }

    try {
      const provider = await this.getOAuth2Provider(context.provider);
      if (!provider) {
        return null;
      }

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: context.tokenData.refreshToken,
        client_id: provider.clientId
      });

      if (provider.clientSecret) {
        params.append('client_secret', provider.clientSecret);
      }

      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        return null;
      }

      const tokenResponse = await response.json();
      
      const newTokenData: OAuth2Token = {
        ...context.tokenData,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || context.tokenData.refreshToken,
        expiresIn: tokenResponse.expires_in || 3600,
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000)
      };

      const updatedContext: AuthenticationContext = {
        ...context,
        tokenData: newTokenData
      };

      // Update session in database
      const keys = KEY_PATTERNS.authSession(context.sessionId, context.userId);
      
      await docClient.send(new UpdateCommand({
        TableName: SECURITY_CONFIG.TABLES.AUTH_SESSIONS,
        Key: keys,
        UpdateExpression: 'SET tokenData = :tokenData, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':tokenData': newTokenData,
          ':updatedAt': new Date().toISOString()
        }
      }));

      return updatedContext;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  async invalidateSession(sessionId: string): Promise<void> {
    try {
      // Find session to get user ID
      const result = await docClient.send(new QueryCommand({
        TableName: SECURITY_CONFIG.TABLES.AUTH_SESSIONS,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `session#${sessionId}`
        }
      }));

      if (result.Items && result.Items.length > 0) {
        const session = result.Items[0];
        const keys = KEY_PATTERNS.authSession(sessionId, session.userId);
        
        await docClient.send(new DeleteCommand({
          TableName: SECURITY_CONFIG.TABLES.AUTH_SESSIONS,
          Key: keys
        }));
      }
    } catch (error) {
      console.error('Session invalidation failed:', error);
    }
  }

  // ===== JWT Token Management =====

  generateJWT(context: AuthenticationContext): string {
    const payload = {
      sub: context.userId,
      sessionId: context.sessionId,
      provider: context.provider,
      iat: Math.floor(context.authenticatedAt / 1000),
      exp: Math.floor(context.expiresAt / 1000),
      iss: this.jwtIssuer,
      aud: 'daylight-api'
    };

    return jwt.sign(payload, this.jwtSecret, { algorithm: 'HS256' });
  }

  validateJWT(token: string): AuthenticationContext | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // This would typically load the full context from the session
      // For now, return minimal context from JWT
      return {
        userId: decoded.sub,
        sessionId: decoded.sessionId,
        provider: decoded.provider,
        providerUserId: decoded.sub,
        authenticatedAt: decoded.iat * 1000,
        expiresAt: decoded.exp * 1000,
        tokenData: {} as OAuth2Token, // Would need to be loaded separately
        mfaVerified: false,
        ipAddress: 'unknown',
        userAgent: 'unknown',
        metadata: {}
      };
    } catch (error) {
      return null;
    }
  }

  // ===== Helper Methods =====

  private async storePKCEVerifier(state: string, codeVerifier: string): Promise<void> {
    // Store PKCE verifier temporarily (expires in 10 minutes)
    await docClient.send(new PutCommand({
      TableName: SECURITY_CONFIG.TABLES.AUTH_SESSIONS,
      Item: {
        PK: `pkce#${state}`,
        SK: 'verifier',
        codeVerifier,
        ttl: createTTL(1/144) // 10 minutes
      }
    }));
  }

  private async getPKCEVerifier(state: string): Promise<string | null> {
    const result = await docClient.send(new GetCommand({
      TableName: SECURITY_CONFIG.TABLES.AUTH_SESSIONS,
      Key: {
        PK: `pkce#${state}`,
        SK: 'verifier'
      }
    }));

    return result.Item?.codeVerifier || null;
  }
}

export const authenticationService = new AuthenticationService();
