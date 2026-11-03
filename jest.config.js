module.exports = {
  preset: '@react-native/jest-preset',
  // Backend rule tests need the Firebase emulators: npm run test:backend
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/firebase/'],
};
