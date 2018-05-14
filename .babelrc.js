module.exports = {
  "presets": [["env", {
    "modules": process.env.BABEL_MODULES ? false : 'commonjs',
    "targets": {
      "node": 6,
      "browsers": [
        "ie 9",
        "ios 9",
        "last 2 chrome versions",
        "last 2 edge versions",
        "last 2 firefox versions",
      ]
    }
  }]],
  "plugins": [
    "./resources/inline-invariant",
    "syntax-async-functions",
    "syntax-async-generators",
    "transform-class-properties",
    "transform-flow-strip-types",
    "transform-object-rest-spread",
    ["transform-es2015-classes", {"loose": true}],
    ["transform-es2015-destructuring", {"loose": true}],
    ["transform-es2015-spread", {"loose": true}]
  ]
};
