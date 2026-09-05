/** @category Validation Rules */

import type { Maybe } from '../../jsutils/Maybe.ts';

import type {
  DefinitionNode,
  DirectiveNode,
  InputValueDefinitionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import {
  isArgument,
  isField,
  isInputField,
  isInputType,
  isRequiredArgument,
  isRequiredInputField,
} from '../../type/definition.ts';
import {
  GraphQLDeprecatedDirective,
  isDirective,
} from '../../type/directives.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Required input values cannot be deprecated.
 *
 * See https://spec.graphql.org/draft/#sec-Deprecation
 * @category Validation Rules
 
 * @internal
 */
export const RequiredInputValuesCannotBeDeprecatedTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      for (const {
        element,
        parentElement,
      } of index.getSchemaValidationElements().deprecations) {
        if (
          isArgument(element) &&
          (isField(parentElement) || isDirective(parentElement)) &&
          isInputType(element.type) &&
          isRequiredArgument(element)
        ) {
          index.reportError(
            requiredArgumentDeprecationMessage(String(element)),
            [
              getDeprecatedDirectiveNode(element.astNode),
              element.astNode?.type,
            ],
          );
        }

        if (
          isInputField(element) &&
          isInputType(element.type) &&
          isRequiredInputField(element)
        ) {
          index.reportError(
            requiredInputFieldDeprecationMessage(String(element)),
            [
              getDeprecatedDirectiveNode(element.astNode),
              element.astNode?.type,
            ],
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
      validateArgumentDefinitions(
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
        validateArgumentDefinitions(
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
        validateInputFieldDefinition(
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

function validateArgumentDefinitions(
  index: TypeSystemValidationIndex,
  parentName: string,
  inputValues: ReadonlyArray<InputValueDefinitionNode> | undefined,
): void {
  if (inputValues == null) {
    return;
  }
  for (const inputValue of inputValues) {
    validateArgumentDefinition(
      index,
      `${parentName}(${inputValue.name.value}:)`,
      inputValue,
    );
  }
}

function validateArgumentDefinition(
  index: TypeSystemValidationIndex,
  inputValueStr: string,
  inputValue: InputValueDefinitionNode,
): void {
  if (
    !isRequiredInputValueDefinition(inputValue) ||
    !index.isInputType(inputValue.type)
  ) {
    return;
  }

  const deprecatedDirectiveNode = getDeprecatedDirectiveNode(inputValue);
  if (deprecatedDirectiveNode != null) {
    index.reportError(requiredArgumentDeprecationMessage(inputValueStr), [
      deprecatedDirectiveNode,
      inputValue.type,
    ]);
  }
}

function validateInputFieldDefinition(
  index: TypeSystemValidationIndex,
  inputFieldStr: string,
  inputValue: InputValueDefinitionNode,
): void {
  if (
    !isRequiredInputValueDefinition(inputValue) ||
    !index.isInputType(inputValue.type)
  ) {
    return;
  }

  const deprecatedDirectiveNode = getDeprecatedDirectiveNode(inputValue);
  if (deprecatedDirectiveNode != null) {
    index.reportError(requiredInputFieldDeprecationMessage(inputFieldStr), [
      deprecatedDirectiveNode,
      inputValue.type,
    ]);
  }
}

function requiredArgumentDeprecationMessage(argumentStr: string): string {
  return `Required argument ${argumentStr} cannot be deprecated.`;
}

function requiredInputFieldDeprecationMessage(inputFieldStr: string): string {
  return `Required input field ${inputFieldStr} cannot be deprecated.`;
}

function isRequiredInputValueDefinition(definitionNode: {
  readonly type: { readonly kind: string };
  readonly defaultValue?: unknown;
}): boolean {
  return (
    definitionNode.type.kind === Kind.NON_NULL_TYPE &&
    definitionNode.defaultValue == null
  );
}

function getDeprecatedDirectiveNode(
  definitionNode: Maybe<{
    readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
  }>,
): Maybe<DirectiveNode> {
  return definitionNode?.directives?.find(
    (node) => node.name.value === GraphQLDeprecatedDirective.name,
  );
}
