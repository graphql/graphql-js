'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.concatAST = void 0;
const kinds_js_1 = require('../language/kinds.js');
/**
 * Provided a collection of ASTs, presumably each from different files,
 * concatenate the ASTs together into batched AST, useful for validating many
 * GraphQL source files which together represent one conceptual application.
 */
function concatAST(documents) {
  const definitions = [];
  for (const doc of documents) {
    definitions.push(...doc.definitions);
  }
  return { kind: kinds_js_1.Kind.DOCUMENT, definitions };
}
exports.concatAST = concatAST;
