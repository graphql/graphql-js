const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './input',
  output: {
    filename: 'output.js',
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production'),
      },
    }),
  ],
};
