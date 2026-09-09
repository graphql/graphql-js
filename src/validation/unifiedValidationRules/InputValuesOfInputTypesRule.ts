/** @category Validation Rules */

import { inspect } from '../../jsutils/inspect.ts';

import type {
  DefinitionNode,
  InputValueDefinitionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { print } from '../../language/printer.ts';

import { isInputType } from '../../type/definition.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Field arguments, directive arguments, and input object fields must be input
 * types.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Values
 * See https://spec.graphql.org/draft/#sec-Directives
 * See https://spec.graphql.org/draft/#sec-Input-Objects
 * @category Validation Rules
 
 * @internal
 */
export const InputValuesOfInputTypesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      for (const {
        inputType,
        inputValue,
      } of index.getSchemaValidationElements().inputValues) {
        if (!isInputType(inputType)) {
          index.reportError(
            inputTypeExpectedMessage(String(inputValue), inspect(inputType)),
            inputValue.astNode?.type,
          );
        }
      }
    }

    for (const definition of index.document.definitions) {
      validateDefinition(index, definition);
    }
  };

function validateDefinition(
  index: TypeSystemValidationIndex,
  definition: DefinitionNode,
): void {
  switch (definition.kind) {
    case Kind.DIRECTIVE_DEFINITION:
      validateInputValues(
        index,
        `@${definition.name.value}`,
        definition.arguments,
      );
      break;
    case Kind.OBJECT_TYPE_DEFINITION:
    case Kind.OBJECT_TYPE_EXTENSION:
    case Kind.INTERFACE_TYPE_DEFINITION:
    case Kind.INTERFACE_TYPE_EXTENSION: {
      const fields = definition.fields;
      if (fields == null) {
        break;
      }
      for (const field of fields) {
        validateInputValues(
          index,
          `${definition.name.value}.${field.name.value}`,
          field.arguments,
        );
      }
      break;
    }
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
    case Kind.INPUT_OBJECT_TYPE_EXTENSION: {
      const fields = definition.fields;
      if (fields == null) {
        break;
      }
      for (const field of fields) {
        validateInputValue(
          index,
          `${definition.name.value}.${field.name.value}`,
          field,
        );
      }
      break;
    }
    default:
      break;
  }
}

function validateInputValues(
  index: TypeSystemValidationIndex,
  parentName: string,
  inputValues: ReadonlyArray<InputValueDefinitionNode> | undefined,
): void {
  if (inputValues == null) {
    return;
  }
  for (const inputValue of inputValues) {
    validateInputValue(
      index,
      `${parentName}(${inputValue.name.value}:)`,
      inputValue,
    );
  }
}

function validateInputValue(
  index: TypeSystemValidationIndex,
  inputValueStr: string,
  inputValue: InputValueDefinitionNode,
): void {
  if (!index.hasNonInputType(inputValue.type)) {
    return;
  }

  index.reportError(
    inputTypeExpectedMessage(inputValueStr, print(inputValue.type)),
    inputValue.type,
  );
}

function inputTypeExpectedMessage(
  inputValueStr: string,
  inputTypeStr: string,
): string {
  return `The type of ${inputValueStr} must be Input Type but got: ${inputTypeStr}.`;
}
