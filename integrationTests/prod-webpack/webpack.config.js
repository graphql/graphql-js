import { fileURLToPath } from 'node:url';

const webpackConfig = {
  entry: './index.js',
  output: {
    filename: 'main.js',
    path: fileURLToPath(new URL('dist', import.meta.url)),
    library: {
      type: 'commonjs2',
    },
  },
  target: 'node',
};

// eslint-disable-next-line no-restricted-exports, import/no-default-export
export default webpackConfig;
