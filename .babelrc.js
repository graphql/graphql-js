//ignore all "__*__" directories, e.g. __tests__, __fixtures__
const ignore = [/\/__[^/]*__\//]; // **/__*__

module.exports = {
  presets: ['@babel/preset-env'],
  plugins: [
    './resources/inline-invariant',
    '@babel/plugin-transform-flow-strip-types',
    ['@babel/plugin-transform-classes', { loose: true }],
    ['@babel/plugin-transform-destructuring', { loose: true }],
    ['@babel/plugin-transform-spread', { loose: true }],
  ],
  env: {
    cjs: {
      presets: [
        ['@babel/preset-env', { modules: 'commonjs' }],
      ],
      ignore,
    },
    mjs: {
      presets: [
        ['@babel/preset-env', { modules: false }],
      ],
      ignore,
    },
  },
};
