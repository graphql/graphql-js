// eslint-disable-next-line n/no-missing-import
import resolve from '@rollup/plugin-node-resolve';
// eslint-disable-next-line n/no-missing-import
import replace from '@rollup/plugin-replace';

const rollupConfig = {
  input: 'index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'es',
  },
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('production'),
      include: ['node_modules/graphql/**'],
    }),
    resolve(),
  ],
};

// eslint-disable-next-line no-restricted-exports, import/no-default-export
export default rollupConfig;
