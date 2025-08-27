module.exports = {
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { configFile: './babel.config.json' }],
  },
  transformIgnorePatterns: [
    '/node_modules/',
  ],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  testPathIgnorePatterns: ['/tests/example.spec.ts'],
  setupFilesAfterEnv: ['./jest.setup.js'],
};
