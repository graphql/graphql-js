/** @category Validation Rules */

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Field and directive arguments must be uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Field-Arguments
 * See https://spec.graphql.org/draft/#sec-Type-System.Directives
 * @category Validation Rules
 
 * @internal
 */
export const UniqueArgumentDefinitionNamesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    for (const {
      message,
      nodes,
    } of index.documentIndex.getUniqueArgumentDefinitionErrors()) {
      index.reportError(message, nodes);
    }
  };
