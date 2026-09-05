/** @category Validation Rules */

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Directive definitions must be uniquely named within a schema.
 *
 * See https://spec.graphql.org/draft/#sec-Type-System.Directives
 * @category Validation Rules
 
 * @internal
 */
export const UniqueDirectiveNamesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      const knownDirectiveNames = new Set<string>();

      for (const directive of index.getSchemaValidationElements().directives) {
        if (knownDirectiveNames.has(directive.name)) {
          index.reportError(
            `There can be only one directive named "@${directive.name}".`,
            directive.astNode,
          );
        } else {
          knownDirectiveNames.add(directive.name);
        }
      }
    }

    for (const {
      message,
      nodes,
    } of index.getUniqueDirectiveDefinitionErrors()) {
      index.reportError(message, nodes);
    }
  };
