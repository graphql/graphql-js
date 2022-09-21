'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.syntaxError = void 0;
const GraphQLError_js_1 = require('./GraphQLError.js');
/**
 * Produces a GraphQLError representing a syntax error, containing useful
 * descriptive information about the syntax error's position in the source.
 */
function syntaxError(source, position, description) {
  return new GraphQLError_js_1.GraphQLError(`Syntax Error: ${description}`, {
    source,
    positions: [position],
  });
}
exports.syntaxError = syntaxError;
