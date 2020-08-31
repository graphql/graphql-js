/**
 * Provided a collection of ASTs, presumably each from different files,
 * concatenate the ASTs together into batched AST, useful for validating many
 * GraphQL source files which together represent one conceptual application.
 */
export function concatAST(documents) {
  let definitions = [];

  for (const doc of documents) {
    definitions = definitions.concat(doc.definitions);
  }

  return {
    kind: 'Document',
    definitions
  };
}
