// eslint-disable-next-line n/no-missing-import
import resolve from '@rollup/plugin-node-resolve';

const rollupConfig = {
  input: 'index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'es',
  },
  plugins: [
    resolve({
      exportConditions: ['development'],
    }),
  ],
};

// eslint-disable-next-line no-restricted-exports, import/no-default-export
export default rollupConfig;
