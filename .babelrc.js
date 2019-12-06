module.exports = {
  presets: ['@babel/preset-env'],
  plugins: [
    './resources/inline-invariant',
    '@babel/plugin-transform-flow-strip-types',
    ['@babel/plugin-transform-classes', { loose: true }],
    ['@babel/plugin-transform-destructuring', { loose: true }],
    ['@babel/plugin-transform-spread', { loose: true }],
    ['@babel/plugin-transform-for-of', { assumeArray: true }],
  ],
  env: {
    cjs: {
      presets: [['@babel/preset-env', { modules: 'commonjs' }]],
    },
    mjs: {
      presets: [['@babel/preset-env', { modules: false }]],
    },
    esm: {
      presets: [['@babel/preset-env', { modules: false }]],
      plugins: [
        function({ types }) {
          return {
            visitor: {
              ImportDeclaration: function(path, state) {
                var source = path.node.source.value;
                if (source.match(/^\.{0,2}\//) && !source.endsWith('.es.js')) {
                  path.replaceWith(
                    types.importDeclaration(
                      path.node.specifiers,
                      types.stringLiteral(source + '.es.js'),
                    ),
                  );
                }
              },
            },
          };
        },
      ],
    },
  },
};
