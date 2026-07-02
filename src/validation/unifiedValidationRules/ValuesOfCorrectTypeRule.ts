/** @category Validation Rules */

import { inspect } from '../../jsutils/inspect.ts';
import { invariant } from '../../jsutils/invariant.ts';
import { isIterableObject } from '../../jsutils/isIterableObject.ts';
import { isObjectLike } from '../../jsutils/isObjectLike.ts';
import { mapValue } from '../../jsutils/mapValue.ts';
import type { Maybe } from '../../jsutils/Maybe.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  ArgumentNode,
  DirectiveNode,
  InputValueDefinitionNode,
  ValueNode,
} from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type {
  GraphQLArgument,
  GraphQLDefaultInput,
  GraphQLInputField,
  GraphQLInputType,
} from '../../type/definition.ts';
import {
  assertLeafType,
  isInputObjectType,
  isInputType,
  isListType,
  isNonNullType,
} from '../../type/definition.ts';

import { invalidDefaultValueMessage } from '../../utilities/validateInputLiteralWithConstInputSchema.ts';
import {
  validateInputLiteral,
  validateInputValue,
} from '../../utilities/validateInputValue.ts';

import type {
  InputTypeReference,
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

import type {
  ASTValidationContext,
  ASTVisitorFn,
} from './ASTValidationContext.ts';

/**
 * Input values must be valid for their expected input type.
 *
 * See https://spec.graphql.org/draft/#sec-Values-of-Correct-Type
 * @category Validation Rules
 * @internal
 */
export const ValuesOfCorrectTypeASTVisitor: ASTVisitorFn = (context) => {
  const indexCursor = context.indexCursor;

  let executableDefinitionDepth = 0;
  let directiveDepth = 0;

  const visitor: ASTVisitor = {
    Directive: {
      enter(directiveNode) {
        directiveDepth += 1;
        validateDirective(directiveNode);
      },
      leave() {
        directiveDepth -= 1;
      },
    },
    InputValueDefinition(inputValueDefinition) {
      const record = indexCursor.getCurrentInputValueDefinitionRecord();
      if (record == null) {
        return;
      }

      validateDefaultValueNode(
        context,
        record.inputValueStr,
        inputValueDefinition,
      );
    },
  };

  Object.assign(visitor, {
    OperationDefinition: {
      enter() {
        executableDefinitionDepth += 1;
      },
      leave() {
        executableDefinitionDepth -= 1;
      },
    },
    FragmentDefinition: {
      enter() {
        executableDefinitionDepth += 1;
      },
      leave() {
        executableDefinitionDepth -= 1;
      },
    },
    NullValue: (node: ValueNode) =>
      isValidExecutableValueNode(node, indexCursor.getCurrentInputType()),
    ListValue: (node: ValueNode) =>
      isValidExecutableValueNode(node, indexCursor.getCurrentParentInputType()),
    ObjectValue: (node: ValueNode) =>
      isValidExecutableValueNode(node, indexCursor.getCurrentInputType()),
    EnumValue: (node: ValueNode) =>
      isValidExecutableValueNode(node, indexCursor.getCurrentInputType()),
    IntValue: (node: ValueNode) =>
      isValidExecutableValueNode(node, indexCursor.getCurrentInputType()),
    FloatValue: (node: ValueNode) =>
      isValidExecutableValueNode(node, indexCursor.getCurrentInputType()),
    StringValue: (node: ValueNode) =>
      isValidExecutableValueNode(node, indexCursor.getCurrentInputType()),
    BooleanValue: (node: ValueNode) =>
      isValidExecutableValueNode(node, indexCursor.getCurrentInputType()),
  } satisfies ASTVisitor);

  return visitor;

  function isValidExecutableValueNode(
    node: ValueNode,
    inputType: Maybe<InputTypeReference>,
  ): false {
    if (executableDefinitionDepth !== 0 && directiveDepth === 0) {
      validateValueNode(context, node, inputType);
    }
    return false;
  }

  function validateDirective(directiveNode: DirectiveNode): void {
    const args = directiveNode.arguments;
    if (args == null) {
      return;
    }

    for (const argNode of args) {
      validateDirectiveArgumentNode(context, directiveNode.name.value, argNode);
    }
  }
};

/** Direct validation variant of {@link ValuesOfCorrectTypeASTVisitor}.
 * @internal
 */
export const ValuesOfCorrectTypeTypeSystemValidation: TypeSystemValidationFn = (
  index: TypeSystemValidationIndex,
): void => {
  if (!index.shouldValidateSchemaOnlyElements()) {
    return;
  }

  for (const { defaultInput, inputValue } of index.getSchemaValidationElements()
    .defaultValues) {
    validateDefaultValue(index, defaultInput, inputValue);
  }
};

function validateValueNode(
  context: ASTValidationContext,
  node: ValueNode,
  inputType: Maybe<InputTypeReference>,
): void {
  if (inputType != null) {
    context.index.validateInputLiteral(
      node,
      inputType,
      (error) => {
        context.reportError(error);
      },
      undefined,
      undefined,
      context.hideSuggestions,
    );
  }
}

function validateDefaultValueNode(
  context: ASTValidationContext,
  inputValueStr: string,
  inputValueNode: InputValueDefinitionNode,
): void {
  const defaultValue = inputValueNode.defaultValue;
  if (defaultValue == null) {
    return;
  }

  const inputType = context.index.getInputTypeReference(inputValueNode.type);
  if (inputType == null) {
    return;
  }

  context.index.validateInputLiteral(
    defaultValue,
    inputType,
    (error, path) => {
      context.reportError(
        new GraphQLError(
          invalidDefaultValueMessage(inputValueStr, path, error.message),
          { nodes: error.nodes ?? defaultValue },
        ),
      );
    },
    undefined,
    undefined,
    context.hideSuggestions,
  );
}

function validateDirectiveArgumentNode(
  context: ASTValidationContext,
  directiveName: string,
  argNode: ArgumentNode,
): void {
  const argDef = context.index
    .getDirectiveArgumentMap(directiveName)
    ?.get(argNode.name.value);
  if (argDef == null) {
    return;
  }

  const inputType =
    'kind' in argDef
      ? context.index.getInputTypeReference(argDef.type)
      : argDef.type;
  if (inputType == null) {
    return;
  }

  context.index.validateInputLiteral(
    argNode.value,
    inputType,
    (error) => {
      context.reportError(
        error.nodes == null
          ? new GraphQLError(error.message, {
              nodes: argNode.value,
              originalError: error.originalError,
              extensions: error.extensions,
            })
          : error,
      );
    },
    undefined,
    undefined,
    context.hideSuggestions,
  );
}

function validateDefaultValue(
  index: TypeSystemValidationIndex,
  defaultInput: GraphQLDefaultInput,
  inputValue: GraphQLArgument | GraphQLInputField,
): void {
  if (!isInputType(inputValue.type)) {
    return;
  }

  const errors: Array<[GraphQLError, ReadonlyArray<string | number>]> = [];
  validateDefaultInput(defaultInput, inputValue.type, (error, path) => {
    errors.push([error, path]);
  });

  if (errors.length === 0) {
    return;
  }

  if (!defaultInput.literal) {
    // If there were validation errors, check to see if it can be "uncoerced"
    // and then correctly validated. If so, report a clear error with a path
    // to resolution.
    try {
      const uncoercedValue = uncoerceDefaultValue(
        defaultInput.value,
        inputValue.type,
      );

      const uncoercedErrors = [];
      validateInputValue(uncoercedValue, inputValue.type, (error, path) => {
        uncoercedErrors.push([error, path]);
      });

      if (uncoercedErrors.length === 0) {
        index.reportError(
          `${inputValue} has invalid default value: ${inspect(
            defaultInput.value,
          )}. Did you mean: ${inspect(uncoercedValue)}?`,
          inputValue.astNode?.defaultValue,
        );
        return;
      }
    } catch (_error) {
      // ignore
    }
  }

  // Otherwise report the original set of errors.
  for (const [error, path] of errors) {
    index.reportError(
      invalidDefaultValueMessage(String(inputValue), path, error.message),
      error.nodes ?? inputValue.astNode?.defaultValue,
    );
  }
}

/** @internal */
export function validateDefaultInput(
  defaultInput: GraphQLDefaultInput,
  inputType: GraphQLInputType,
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  hideSuggestions?: Maybe<boolean>,
): void {
  if (defaultInput.literal) {
    validateInputLiteral(
      defaultInput.literal,
      inputType,
      onError,
      undefined,
      undefined,
      hideSuggestions,
    );
    return;
  }
  validateInputValue(defaultInput.value, inputType, onError, hideSuggestions);
}

/**
 * Historically GraphQL.js allowed default values to be provided as
 * assumed-coerced "internal" values, however default values should be provided
 * as "external" pre-coerced values. `uncoerceDefaultValue()` will convert such
 * "internal" values to "external" values to display as part of validation.
 *
 * This performs the "opposite" of `coerceInputValue()`. Given an "internal"
 * coerced value, reverse the process to provide an "external" uncoerced value.
 *
 * @internal
 */
function uncoerceDefaultValue(value: unknown, type: GraphQLInputType): unknown {
  if (isNonNullType(type)) {
    return uncoerceDefaultValue(value, type.ofType);
  }

  if (value === null) {
    return null;
  }

  if (isListType(type)) {
    if (isIterableObject(value)) {
      return Array.from(value, (itemValue) =>
        uncoerceDefaultValue(itemValue, type.ofType),
      );
    }
    return [uncoerceDefaultValue(value, type.ofType)];
  }

  if (isInputObjectType(type)) {
    invariant(isObjectLike(value));
    const fieldDefs = type.getFields();
    return mapValue(value, (fieldValue, fieldName) => {
      invariant(fieldName in fieldDefs);
      return uncoerceDefaultValue(fieldValue, fieldDefs[fieldName].type);
    });
  }

  assertLeafType(type);

  // For most leaf types (Scalars, Enums), output value coercion ("serialize") is
  // the inverse of input coercion ("parseValue") and will produce an
  // "external" value. Historically, this method was also used as part of the
  // now-deprecated "astFromValue" to perform the same behavior.
  return type.coerceOutputValue(value);
}
