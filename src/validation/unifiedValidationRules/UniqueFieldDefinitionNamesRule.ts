/** @category Validation Rules */

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Object, interface, and input object fields must be uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Objects
 * See https://spec.graphql.org/draft/#sec-Interfaces
 * See https://spec.graphql.org/draft/#sec-Input-Objects
 * @category Validation Rules
 
 * @internal
 */
export const UniqueFieldDefinitionNamesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    for (const { message, nodes } of index.getUniqueFieldDefinitionErrors()) {
      index.reportError(message, nodes);
    }
  };
