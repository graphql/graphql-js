const jestConfig = {
  testEnvironment: 'node',

  testEnvironmentOptions: {
    customExportConditions: ['development'],
  },

  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },

  transformIgnorePatterns: [
    // Allow 'graphql' to be transformed, ignore all other node_modules.
    // This regex means: "match /node_modules/ unless it's followed by graphql/"
    '/node_modules/(?!graphql/)',
    // Keep Jest's default for .pnp.js files if using Yarn PnP
    '\\.pnp\\.[^\\/]+$',
  ],
};

// eslint-disable-next-line no-restricted-exports, import/no-default-export
export default jestConfig;
