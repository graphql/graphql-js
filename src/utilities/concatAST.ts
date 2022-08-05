import type { DefinitionNode, DocumentNode } from '../language/ast';
import { Kind } from '../language/kinds';

/**
 * Provided a collection of ASTs, presumably each from different files,
 * concatenate the ASTs together into batched AST, useful for validating many
 * GraphQL source files which together represent one conceptual application.
 */
export function concatAST(
  documents: ReadonlyArray<DocumentNode>,
): DocumentNode {
  const definitions: Array<DefinitionNode> = [];
  for (let i = 0; i < documents.length; i++) {
    definitions.push(...documents[i].definitions);
  }
  return { kind: Kind.DOCUMENT, definitions };
}
