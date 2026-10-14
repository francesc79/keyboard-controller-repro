module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/*.test.tsx'],
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|expo|@expo))',
  ],
};
