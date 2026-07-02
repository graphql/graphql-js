/** @category Validation Rules */

import type {
  DefinitionNode,
  InputValueDefinitionNode,
  NameNode,
  TypeDefinitionNode,
  TypeExtensionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import { isNamedType } from '../../type/definition.ts';
import { isIntrospectionType } from '../../type/introspection.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Type system names must not begin with "__" unless they are introspection
 * types.
 *
 * See https://spec.graphql.org/draft/#sec-Type-System
 * @category Validation Rules
 
 * @internal
 */
export const NoReservedTypeSystemNamesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      for (const element of index.getSchemaValidationElements().namedElements) {
        if (!element.name.startsWith('__')) {
          continue;
        }

        if (isNamedType(element) && isIntrospectionType(element)) {
          continue;
        }

        index.reportError(
          reservedTypeSystemNameErrorMessage(element.name),
          element.astNode,
        );
      }
    }

    for (const definition of index.document.definitions) {
      checkTypeSystemDefinitionReservedNames(index, definition);
    }
  };

function checkTypeSystemDefinitionReservedNames(
  index: TypeSystemValidationIndex,
  definition: DefinitionNode,
): void {
  switch (definition.kind) {
    case Kind.SCALAR_TYPE_DEFINITION:
    case Kind.SCALAR_TYPE_EXTENSION:
    case Kind.OBJECT_TYPE_DEFINITION:
    case Kind.OBJECT_TYPE_EXTENSION:
    case Kind.INTERFACE_TYPE_DEFINITION:
    case Kind.INTERFACE_TYPE_EXTENSION:
    case Kind.UNION_TYPE_DEFINITION:
    case Kind.UNION_TYPE_EXTENSION:
    case Kind.ENUM_TYPE_DEFINITION:
    case Kind.ENUM_TYPE_EXTENSION:
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
    case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      checkTypeDefinitionOrExtensionReservedNames(index, definition);
      break;
    case Kind.DIRECTIVE_DEFINITION:
      checkReservedTypeSystemName(index, definition.name);
      checkInputValueReservedNames(index, definition.arguments);
      break;
    default:
      break;
  }
}

function checkTypeDefinitionOrExtensionReservedNames(
  index: TypeSystemValidationIndex,
  definition: TypeDefinitionNode | TypeExtensionNode,
): void {
  checkReservedTypeSystemName(index, definition.name);

  switch (definition.kind) {
    case Kind.OBJECT_TYPE_DEFINITION:
    case Kind.OBJECT_TYPE_EXTENSION:
    case Kind.INTERFACE_TYPE_DEFINITION:
    case Kind.INTERFACE_TYPE_EXTENSION: {
      const fields = definition.fields;
      if (fields == null) {
        break;
      }
      for (const field of fields) {
        checkReservedTypeSystemName(index, field.name);
        checkInputValueReservedNames(index, field.arguments);
      }
      break;
    }
    case Kind.ENUM_TYPE_DEFINITION:
    case Kind.ENUM_TYPE_EXTENSION: {
      const values = definition.values;
      if (values == null) {
        break;
      }
      for (const value of values) {
        checkReservedTypeSystemName(index, value.name);
      }
      break;
    }
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
    case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      checkInputValueReservedNames(index, definition.fields);
      break;
    default:
      break;
  }
}

function checkInputValueReservedNames(
  index: TypeSystemValidationIndex,
  inputValues: ReadonlyArray<InputValueDefinitionNode> | undefined,
): void {
  if (inputValues == null) {
    return;
  }
  for (const inputValue of inputValues) {
    checkReservedTypeSystemName(index, inputValue.name);
  }
}

function checkReservedTypeSystemName(
  index: TypeSystemValidationIndex,
  nameNode: NameNode,
): void {
  if (nameNode.value.startsWith('__')) {
    index.reportError(
      reservedTypeSystemNameErrorMessage(nameNode.value),
      nameNode,
    );
  }
}

function reservedTypeSystemNameErrorMessage(name: string): string {
  return `Name "${name}" must not begin with "__", which is reserved by GraphQL introspection.`;
}
