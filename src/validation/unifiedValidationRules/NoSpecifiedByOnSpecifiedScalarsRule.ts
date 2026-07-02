/** @category Validation Rules */

import type {
  ScalarTypeDefinitionNode,
  ScalarTypeExtensionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import { GraphQLSpecifiedByDirective } from '../../type/directives.ts';
import {
  isSpecifiedScalarType,
  specifiedScalarTypes,
} from '../../type/scalars.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * The @specifiedBy directive must not be used on specified scalar types.
 *
 * See https://spec.graphql.org/draft/#sec--specifiedBy
 * @category Validation Rules
 
 * @internal
 */
export const NoSpecifiedByOnSpecifiedScalarsTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      for (const type of index.getSchemaValidationElements().scalarTypes) {
        if (!isSpecifiedScalarType(type)) {
          continue;
        }

        if (type.specifiedByURL != null) {
          index.reportError(
            specifiedByOnSpecifiedScalarMessage(type.name),
            type.astNode,
          );
        }
      }
    }

    for (const definition of index.document.definitions) {
      if (
        definition.kind === Kind.SCALAR_TYPE_DEFINITION ||
        definition.kind === Kind.SCALAR_TYPE_EXTENSION
      ) {
        checkTypeSystemSpecifiedByOnSpecifiedScalar(index, definition);
      }
    }
  };

function checkTypeSystemSpecifiedByOnSpecifiedScalar(
  index: TypeSystemValidationIndex,
  node: ScalarTypeDefinitionNode | ScalarTypeExtensionNode,
): void {
  if (!isSpecifiedScalarTypeName(node.name.value)) {
    return;
  }

  const directives = node.directives;
  if (directives == null) {
    return;
  }

  for (const directiveNode of directives) {
    if (directiveNode.name.value === GraphQLSpecifiedByDirective.name) {
      index.reportError(
        specifiedByOnSpecifiedScalarMessage(node.name.value),
        directiveNode,
      );
    }
  }
}

const specifiedScalarTypeNames = new Set(
  specifiedScalarTypes.map((type) => type.name),
);

function isSpecifiedScalarTypeName(typeName: string): boolean {
  return specifiedScalarTypeNames.has(typeName);
}

function specifiedByOnSpecifiedScalarMessage(typeName: string): string {
  return `Directive "@specifiedBy" must not be used on built-in scalar type "${typeName}".`;
}
