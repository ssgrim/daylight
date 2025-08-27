// Mock Cognito configuration to prevent errors during tests
jest.mock('./frontend/src/services/authService', () => {
  const originalModule = jest.requireActual('./frontend/src/services/authService');

  return {
    ...originalModule,
    getAuthConfig: jest.fn(() => ({
      Auth: {
        Cognito: {
          userPoolId: 'test-pool-id',
          userPoolClientId: 'test-client-id',
          loginWith: {
            oauth: {
              domain: 'test-domain',
              scopes: ['email', 'openid', 'profile'],
              redirectSignIn: ['http://localhost'],
              redirectSignOut: ['http://localhost'],
              responseType: 'code',
            },
          },
        },
      },
    })),
  };
});
