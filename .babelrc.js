module.exports = {
  "presets": [["@babel/preset-env", {
    "modules": process.env.BABEL_MODULES ? false : 'commonjs',
    "targets": [
      "node 6",
      "ie 9",
      "ios 9",
      "last 2 chrome versions",
      "last 2 edge versions",
      "last 2 firefox versions",
    ],
  }]],
  "plugins": [
    "./resources/inline-invariant",
    "@babel/plugin-syntax-async-generators",
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-transform-flow-strip-types",
    "@babel/plugin-proposal-object-rest-spread",
    ["@babel/plugin-transform-classes", {"loose": true}],
    ["@babel/plugin-transform-destructuring", {"loose": true}],
    ["@babel/plugin-transform-spread", {"loose": true}]
  ]
};
