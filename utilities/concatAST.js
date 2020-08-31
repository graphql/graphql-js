"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.concatAST = concatAST;

/**
 * Provided a collection of ASTs, presumably each from different files,
 * concatenate the ASTs together into batched AST, useful for validating many
 * GraphQL source files which together represent one conceptual application.
 */
function concatAST(documents) {
  var definitions = [];

  for (var _i2 = 0; _i2 < documents.length; _i2++) {
    var doc = documents[_i2];
    definitions = definitions.concat(doc.definitions);
  }

  return {
    kind: 'Document',
    definitions: definitions
  };
}
