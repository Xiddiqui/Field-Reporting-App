// Backend integration tests; they need the Firestore + Storage emulators (see npm run test:backend)
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['babel-jest', { configFile: require.resolve('../babel.config.js') }] },
  testTimeout: 30000,
}
