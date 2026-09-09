/** @category Validation Rules */

import type { DefinitionNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { isExecutableDefinitionNode } from '../../language/predicates.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Executable definitions
 *
 * A GraphQL document is only valid for execution if all definitions are either
 * operation or fragment definitions.
 *
 * See https://spec.graphql.org/draft/#sec-Executable-Definitions
 * @category Validation Rules
 
 * @internal
 */
export const ExecutableDefinitionsTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    for (const definition of index.document.definitions) {
      if (!isExecutableDefinitionNode(definition)) {
        index.reportError(
          nonExecutableDefinitionMessage(definition),
          definition,
        );
      }
    }
  };

function nonExecutableDefinitionMessage(definition: DefinitionNode): string {
  const defName =
    definition.kind === Kind.SCHEMA_DEFINITION ||
    definition.kind === Kind.SCHEMA_EXTENSION
      ? 'schema'
      : `"${definition.name?.value}"`;
  return `The ${defName} definition is not executable.`;
}
