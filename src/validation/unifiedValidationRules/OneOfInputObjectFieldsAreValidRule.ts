/** @category Validation Rules */

import type {
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import { isNonNullType } from '../../type/definition.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * OneOf input object fields must be nullable and must not define defaults.
 *
 * See https://spec.graphql.org/draft/#sec-OneOf-Input-Objects
 * @category Validation Rules
 
 * @internal
 */
export const OneOfInputObjectFieldsAreValidTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      for (const {
        type: inputObj,
        fields,
      } of index.getSchemaValidationElements().inputObjectTypes) {
        if (!inputObj.isOneOf) {
          continue;
        }

        for (const field of fields) {
          if (isNonNullType(field.type)) {
            index.reportError(
              oneOfInputFieldNullableMessage(`${inputObj}.${field.name}`),
              field.astNode?.type,
            );
          }

          if (field.default !== undefined) {
            index.reportError(
              oneOfInputFieldDefaultValueMessage(`${inputObj}.${field.name}`),
              field.astNode,
            );
          }
        }
      }
    }

    for (const definition of index.document.definitions) {
      if (
        definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
        definition.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION
      ) {
        validateTypeSystemOneOfInputFields(index, definition);
      }
    }
  };

function validateTypeSystemOneOfInputFields(
  index: TypeSystemValidationIndex,
  node: InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode,
): void {
  const typeName = node.name.value;
  if (!index.isOneOfInputObjectTypeName(typeName)) {
    return;
  }

  const fields = node.fields;
  if (fields == null) {
    return;
  }
  for (const inputField of fields) {
    validateTypeSystemOneOfInputField(index, typeName, inputField);
  }
}

function validateTypeSystemOneOfInputField(
  index: TypeSystemValidationIndex,
  inputObjectTypeName: string,
  inputValue: InputValueDefinitionNode,
): void {
  const inputFieldName = inputValue.name.value;
  const inputFieldStr = `${inputObjectTypeName}.${inputFieldName}`;

  if (inputValue.type.kind === Kind.NON_NULL_TYPE) {
    index.reportError(
      oneOfInputFieldNullableMessage(inputFieldStr),
      inputValue.type,
    );
  }

  if (inputValue.defaultValue != null) {
    index.reportError(
      oneOfInputFieldDefaultValueMessage(inputFieldStr),
      inputValue.defaultValue,
    );
  }
}

function oneOfInputFieldNullableMessage(inputFieldStr: string): string {
  return `OneOf input field ${inputFieldStr} must be nullable.`;
}

function oneOfInputFieldDefaultValueMessage(inputFieldStr: string): string {
  return `OneOf input field ${inputFieldStr} cannot have a default value.`;
}
