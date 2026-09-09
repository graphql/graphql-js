/** @category Validation Rules */

import type {
  DefinitionNode,
  DirectiveDefinitionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Directive definitions must include at least one valid location.
 *
 * See https://spec.graphql.org/draft/#sec-Directives
 * @category Validation Rules
 
 * @internal
 */
export const DirectiveDefinitionsHaveLocationsTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      for (const { locations, directive } of index.getSchemaValidationElements()
        .directiveLocations) {
        if (locations.length === 0) {
          index.reportError(
            directiveLocationsErrorMessage(String(directive)),
            directive.astNode,
          );
        }
      }
    }

    if (!hasDirectiveDefinitionOrExtension(index.document.definitions)) {
      return;
    }

    const directiveNodes = new Map<string, DirectiveDefinitionNode>();
    for (const definition of index.document.definitions) {
      if (definition.kind === Kind.DIRECTIVE_DEFINITION) {
        directiveNodes.set(definition.name.value, definition);
      }
    }

    for (const directiveName of index.getDirectiveNames()) {
      if (index.getDirectiveLocationSet(directiveName)?.size === 0) {
        index.reportError(
          directiveLocationsErrorMessage(`@${directiveName}`),
          directiveNodes.get(directiveName),
        );
      }
    }
  };

function directiveLocationsErrorMessage(directiveStr: string): string {
  return `Directive ${directiveStr} must include 1 or more locations.`;
}

function hasDirectiveDefinitionOrExtension(
  definitions: ReadonlyArray<DefinitionNode>,
): boolean {
  for (const definition of definitions) {
    if (
      definition.kind === Kind.DIRECTIVE_DEFINITION ||
      definition.kind === Kind.DIRECTIVE_EXTENSION
    ) {
      return true;
    }
  }
  return false;
}
