const rollupConfig = {
  input: 'index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'es',
  },
};

// eslint-disable-next-line no-restricted-exports, import/no-default-export
export default rollupConfig;
