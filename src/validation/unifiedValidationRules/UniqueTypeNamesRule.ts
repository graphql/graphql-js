/** @category Validation Rules */

import type { GraphQLNamedType } from '../../type/definition.ts';
import { specifiedScalarTypes } from '../../type/scalars.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Type definitions must be uniquely named within a schema.
 *
 * See https://spec.graphql.org/draft/#sec-Type-System
 * @category Validation Rules
 
 * @internal
 */
export const UniqueTypeNamesTypeSystemValidation: TypeSystemValidationFn = (
  index: TypeSystemValidationIndex,
): void => {
  if (index.shouldValidateSchemaOnlyElements()) {
    for (const type of index.getSchemaValidationElements().scalarTypes) {
      if (isBuiltInScalarTypeName(type.name)) {
        validateBuiltInScalarType(index, type);
      }
    }
  }

  for (const { message, nodes } of index.getUniqueTypeDefinitionErrors()) {
    index.reportError(message, nodes);
  }
};

const builtInScalarTypeNames = new Set(
  specifiedScalarTypes.map((type) => type.name),
);
const builtInScalarTypes = new Set<GraphQLNamedType>(specifiedScalarTypes);

function isBuiltInScalarTypeName(typeName: string): boolean {
  return builtInScalarTypeNames.has(typeName);
}

function validateBuiltInScalarType(
  index: TypeSystemValidationIndex,
  type: GraphQLNamedType,
): void {
  if (builtInScalarTypes.has(type)) {
    return;
  }

  index.reportError(
    `Built-in scalar type "${type.name}" cannot be redefined.`,
    type.astNode,
  );
}
