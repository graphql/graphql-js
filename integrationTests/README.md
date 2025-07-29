# Integration Tests

This directory contains integration tests for GraphQL.js across different environments and bundlers, testing basic GraphQL.JS functionality, as well as development mode and production mode behavior.

Tests are run via the main integration test suite in `resources/integration-test.ts`.

## Test Structure

### Basic GraphQL.JS Functionality Tests

Each subdirectory represents a different environment/bundler:

- `node` - tests for supported Node.js versions
- `ts` - tests for supported Typescript versions
- `webpack` - tests for Webpack

### Verifying Conditional Exports

The `conditions` subdirectory contains tests that verify the conditional exports of GraphQL.js. These tests ensure that the correct files are imported based on the environment being used.

### Verifying Development Mode Tests

Each subdirectory represents a different platform/bundler demonstrating enabling development mode by enabling the `development` condition or by calling `enableDevMode()`.

### Verifying Production Mode Tests

Each subdirectory represents a different environment/bundler demonstrating production mode when development mode is not enabled.
