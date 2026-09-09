/** @category Validation Rules */

import { inspect } from '../../jsutils/inspect.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Constructed schema type-map entries must be GraphQL named types.
 *
 * TypeScript programmatic schemas reject these invalid values statically; this
 * runtime guard covers JavaScript callers and intentionally bypassed types.
 * @category Validation Rules
 
 * @internal
 */
export const NamedTypesAreNamedTypesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    for (const { type } of index.getSchemaValidationElements()
      .invalidNamedTypes) {
      index.reportError(
        `Expected GraphQL named type but got: ${inspect(type)}.`,
        (type as any)?.astNode,
      );
    }
  };
