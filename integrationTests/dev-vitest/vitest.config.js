// eslint-disable-next-line n/no-missing-import
import { defineConfig } from 'vitest/config';

const vitestConfig = defineConfig({
  resolve: {
    conditions: ['development'],
  },
  test: {
    include: ['**/*.test.js'],
  },
});

// eslint-disable-next-line no-restricted-exports, import/no-default-export
export default vitestConfig;
