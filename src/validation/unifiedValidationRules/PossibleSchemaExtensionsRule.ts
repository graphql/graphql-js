/** @category Validation Rules */

import { Kind } from '../../language/kinds.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Schema extensions must extend an existing schema definition.
 *
 * See https://spec.graphql.org/draft/#sec-Schema-Extension
 * @category Validation Rules
 
 * @internal
 */
export const PossibleSchemaExtensionsTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    const definitions = index.document.definitions;
    const hasSchemaDefinition =
      index.schema != null ||
      definitions.some(
        (definition) => definition.kind === Kind.SCHEMA_DEFINITION,
      );

    if (hasSchemaDefinition) {
      return;
    }

    for (const definition of definitions) {
      if (definition.kind === Kind.SCHEMA_EXTENSION) {
        index.reportError(
          'Cannot extend schema because it is not defined.',
          definition,
        );
      }
    }
  };

/** AST validation rule variant of {@link PossibleSchemaExtensionsTypeSystemValidation}. */
