/** @category Validation Rules */

import { inspect } from '../../jsutils/inspect.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Constructed schema directive entries must be GraphQL directives.
 *
 * TypeScript programmatic schemas reject these invalid values statically; this
 * runtime guard covers JavaScript callers and intentionally bypassed types.
 * @category Validation Rules
 
 * @internal
 */
export const DirectivesAreDirectivesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    for (const { directive } of index.getSchemaValidationElements()
      .invalidDirectives) {
      index.reportError(
        `Expected directive but got: ${inspect(directive)}.`,
        (directive as any)?.astNode,
      );
    }
  };
