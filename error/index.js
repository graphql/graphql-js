'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.locatedError = exports.syntaxError = exports.GraphQLError = void 0;
var GraphQLError_js_1 = require('./GraphQLError.js');
Object.defineProperty(exports, 'GraphQLError', {
  enumerable: true,
  get: function () {
    return GraphQLError_js_1.GraphQLError;
  },
});
var syntaxError_js_1 = require('./syntaxError.js');
Object.defineProperty(exports, 'syntaxError', {
  enumerable: true,
  get: function () {
    return syntaxError_js_1.syntaxError;
  },
});
var locatedError_js_1 = require('./locatedError.js');
Object.defineProperty(exports, 'locatedError', {
  enumerable: true,
  get: function () {
    return locatedError_js_1.locatedError;
  },
});
