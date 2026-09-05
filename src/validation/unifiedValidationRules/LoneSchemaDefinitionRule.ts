/** @category Validation Rules */

import { Kind } from '../../language/kinds.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * SDL documents must not define more than one schema, and schema extensions
 * must not define a new schema.
 *
 * See https://spec.graphql.org/draft/#sec-Schema
 * @category Validation Rules
 
 * @internal
 */
export const LoneSchemaDefinitionTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    const oldSchema = index.schema;
    const alreadyDefined =
      oldSchema?.astNode ??
      oldSchema?.getQueryType() ??
      oldSchema?.getMutationType() ??
      oldSchema?.getSubscriptionType();

    let schemaDefinitionsCount = 0;
    for (const definition of index.document.definitions) {
      if (definition.kind !== Kind.SCHEMA_DEFINITION) {
        continue;
      }

      if (alreadyDefined) {
        index.reportError(
          'Cannot define a new schema within a schema extension.',
          definition,
        );
        continue;
      }

      if (schemaDefinitionsCount > 0) {
        index.reportError(
          'Must provide only one schema definition.',
          definition,
        );
      }
      ++schemaDefinitionsCount;
    }
  };
