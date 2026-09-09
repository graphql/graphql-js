/** @category Validation Rules */

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Enum values must be uniquely named within an enum type.
 *
 * See https://spec.graphql.org/draft/#sec-Enums
 * @category Validation Rules
 
 * @internal
 */
export const UniqueEnumValueNamesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    for (const {
      message,
      nodes,
    } of index.getUniqueEnumValueDefinitionErrors()) {
      index.reportError(message, nodes);
    }
  };
