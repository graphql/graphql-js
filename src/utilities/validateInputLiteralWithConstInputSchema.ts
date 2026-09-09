/** @category Values */

import { didYouMean } from '../jsutils/didYouMean.ts';
import { isObjectLike } from '../jsutils/isObjectLike.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { Path } from '../jsutils/Path.ts';
import { addPath, pathToArray } from '../jsutils/Path.ts';
import { printPathArray } from '../jsutils/printPathArray.ts';
import { suggestionList } from '../jsutils/suggestionList.ts';

import { ensureGraphQLError } from '../error/ensureGraphQLError.ts';
import { GraphQLError } from '../error/GraphQLError.ts';

import type {
  ASTNode,
  ObjectFieldNode,
  ValueNode,
  VariableNode,
} from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import { print } from '../language/printer.ts';

import type { FragmentVariableValues } from '../execution/collectFields.ts';
import type { VariableValues } from '../execution/values.ts';

/** @internal */
export interface ConstInputSchema<
  TInputType,
  TInputField,
  TNonNullInputType extends TInputType = TInputType,
  TListInputType extends TInputType = TInputType,
  TInputObjectType extends TInputType = TInputType,
  TLeafInputType extends TInputType = TInputType,
> {
  getType: (
    type: TInputType,
  ) => InputTypeRecord<
    TInputType,
    TInputField,
    TNonNullInputType,
    TListInputType,
    TInputObjectType,
    TLeafInputType
  >;
  getField: (field: TInputField) => InputFieldRecord<TInputType>;
  coerceLeafLiteral: (
    type: TInputType,
    valueNode: ValueNode,
    variables: Maybe<VariableValues>,
    fragmentVariableValues: Maybe<FragmentVariableValues>,
    hideSuggestions: Maybe<boolean>,
  ) => unknown;
}

/** @internal */
export type InputTypeRecord<
  TInputType,
  TInputField,
  TNonNullInputType extends TInputType = TInputType,
  TListInputType extends TInputType = TInputType,
  TInputObjectType extends TInputType = TInputType,
  TLeafInputType extends TInputType = TInputType,
> =
  | InputNonNullTypeRecord<TInputType, TNonNullInputType>
  | InputListTypeRecord<TInputType, TListInputType>
  | InputObjectTypeRecord<TInputObjectType, TInputField>
  | InputLeafTypeRecord<TLeafInputType>;

/** @internal */
export interface InputNonNullTypeRecord<TInputType, TNonNullInputType> {
  readonly kind: 'nonNull';
  readonly type: TNonNullInputType;
  readonly typeStr: string;
  readonly nullableType: TInputType;
}

/** @internal */
export interface InputListTypeRecord<TInputType, TListInputType> {
  readonly kind: 'list';
  readonly type: TListInputType;
  readonly typeStr: string;
  readonly itemType: TInputType;
}

/** @internal */
export interface InputObjectTypeRecord<TInputObjectType, TInputField> {
  readonly kind: 'inputObject';
  readonly type: TInputObjectType;
  readonly typeStr: string;
  readonly fields?: ReadonlyArray<TInputField> | undefined;
  readonly isOneOf: boolean;
}

/** @internal */
export interface InputLeafTypeRecord<TLeafInputType> {
  readonly kind: 'leaf';
  readonly type: TLeafInputType;
  readonly typeStr: string;
}

/** @internal */
export interface InputFieldRecord<TInputType> {
  readonly name: string;
  readonly type: TInputType;
  readonly isRequired: boolean;
}

/** @internal */
export function invalidDefaultValueMessage(
  inputValueStr: string,
  path: ReadonlyArray<string | number>,
  errorMessage: string,
): string {
  return `${inputValueStr} has invalid default value${printPathArray(
    path,
  )}: ${errorMessage}`;
}

/** @internal */
// eslint-disable-next-line max-params
export function validateInputLiteralWithConstInputSchema<
  TInputType,
  TInputField,
  TNonNullInputType extends TInputType = TInputType,
  TListInputType extends TInputType = TInputType,
  TInputObjectType extends TInputType = TInputType,
  TLeafInputType extends TInputType = TInputType,
>(
  valueNode: ValueNode,
  type: TInputType,
  constInputSchema: ConstInputSchema<
    TInputType,
    TInputField,
    TNonNullInputType,
    TListInputType,
    TInputObjectType,
    TLeafInputType
  >,
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  variables?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
  hideSuggestions?: Maybe<boolean>,
): void {
  const context: InputLiteralValidationContext<
    TInputType,
    TInputField,
    TNonNullInputType,
    TListInputType,
    TInputObjectType,
    TLeafInputType
  > = {
    static: !variables && !fragmentVariableValues,
    onError,
    variables,
    fragmentVariableValues,
    constInputSchema,
  };
  return validateInputLiteralImpl(
    context,
    valueNode,
    type,
    hideSuggestions,
    undefined,
  );
}

interface InputLiteralValidationContext<
  TInputType,
  TInputField,
  TNonNullInputType extends TInputType = TInputType,
  TListInputType extends TInputType = TInputType,
  TInputObjectType extends TInputType = TInputType,
  TLeafInputType extends TInputType = TInputType,
> {
  static: boolean;
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void;
  variables?: Maybe<VariableValues>;
  fragmentVariableValues?: Maybe<FragmentVariableValues>;
  constInputSchema: ConstInputSchema<
    TInputType,
    TInputField,
    TNonNullInputType,
    TListInputType,
    TInputObjectType,
    TLeafInputType
  >;
}

function validateInputLiteralImpl<
  TInputType,
  TInputField,
  TNonNullInputType extends TInputType,
  TListInputType extends TInputType,
  TInputObjectType extends TInputType,
  TLeafInputType extends TInputType,
>(
  context: InputLiteralValidationContext<
    TInputType,
    TInputField,
    TNonNullInputType,
    TListInputType,
    TInputObjectType,
    TLeafInputType
  >,
  valueNode: ValueNode,
  type: TInputType,
  hideSuggestions: Maybe<boolean>,
  path: Path | undefined,
): void {
  const constInputSchema = context.constInputSchema;
  const inputType = constInputSchema.getType(type);

  if (valueNode.kind === Kind.VARIABLE) {
    if (context.static) {
      // If no variable values are provided, this is being validated statically,
      // and cannot yet produce any validation errors for variables.
      return;
    }
    const scopedVariableValues = getScopedVariableValues(context, valueNode);
    const value = scopedVariableValues?.coerced[valueNode.name.value];
    if (inputType.kind === 'nonNull') {
      if (value === undefined) {
        reportInvalidLiteral(
          context.onError,
          `Expected variable "$${
            valueNode.name.value
          }" provided to type "${inputType.typeStr}" to provide a runtime value.`,
          valueNode,
          path,
        );
      } else if (value === null) {
        reportInvalidLiteral(
          context.onError,
          `Expected variable "$${
            valueNode.name.value
          }" provided to non-null type "${inputType.typeStr}" not to be null.`,
          valueNode,
          path,
        );
      }
    }
    // Note: This does no further checking that this variable is correct.
    // This assumes this variable usage has already been validated.
    return;
  }

  if (inputType.kind === 'nonNull') {
    if (valueNode.kind === Kind.NULL) {
      reportInvalidLiteral(
        context.onError,
        `Expected value of non-null type "${inputType.typeStr}" not to be null.`,
        valueNode,
        path,
      );
      return;
    }
    return validateInputLiteralImpl(
      context,
      valueNode,
      inputType.nullableType,
      hideSuggestions,
      path,
    );
  }

  if (valueNode.kind === Kind.NULL) {
    return;
  }

  if (inputType.kind === 'list') {
    const itemType = inputType.itemType;
    if (valueNode.kind !== Kind.LIST) {
      // Lists accept a non-list value as a list of one.
      validateInputLiteralImpl(
        context,
        valueNode,
        itemType,
        hideSuggestions,
        path,
      );
    } else {
      let index = 0;
      for (const itemNode of valueNode.values) {
        validateInputLiteralImpl(
          context,
          itemNode,
          itemType,
          hideSuggestions,
          addPath(path, index++, undefined),
        );
      }
    }
  } else if (inputType.kind === 'inputObject') {
    if (valueNode.kind !== Kind.OBJECT) {
      reportInvalidLiteral(
        context.onError,
        `Expected value of type "${inputType.typeStr}" to be an object, found: ${print(
          valueNode,
        )}.`,
        valueNode,
        path,
      );
      return;
    }

    const inputFields = inputType.fields;
    const typeStr = inputType.typeStr;
    if (inputFields == null || inputFields.length === 0) {
      for (const fieldNode of valueNode.fields) {
        const fieldName = fieldNode.name.value;
        reportInvalidLiteral(
          context.onError,
          `Expected value of type "${typeStr}" not to include unknown field "${fieldName}", found: ${print(
            valueNode,
          )}.`,
          fieldNode,
          path,
        );
      }

      if (inputType.isOneOf) {
        reportInvalidLiteral(
          context.onError,
          getOneOfInputObjectErrorMessage(typeStr),
          valueNode,
          path,
        );
      }
      return;
    }

    const fields = [];
    const fieldDefGroups = new Map<
      string,
      Array<InputFieldRecord<TInputType>>
    >();
    const fieldNames = [];
    for (const inputField of inputFields) {
      const field = constInputSchema.getField(inputField);
      fields.push(field);

      const fieldGroup = fieldDefGroups.get(field.name);
      if (fieldGroup == null) {
        fieldDefGroups.set(field.name, [field]);
        fieldNames.push(field.name);
      } else {
        fieldGroup.push(field);
      }
    }
    const fieldNodeGroups = groupByName(
      valueNode.fields,
      (field) => field.name.value,
    );

    for (const field of fields) {
      const fieldName = field.name;
      const isRequiredField = field.isRequired;
      const fieldType = field.type;
      const fieldNodes = fieldNodeGroups.get(fieldName);
      if (fieldNodes == null) {
        if (isRequiredField) {
          reportInvalidLiteral(
            context.onError,
            `Expected value of type "${typeStr}" to include required field "${fieldName}", found: ${print(
              valueNode,
            )}.`,
            valueNode,
            path,
          );
        }
        continue;
      }

      const fieldNode = fieldNodes[fieldNodes.length - 1];
      const fieldValueNode = fieldNode.value;
      if (fieldValueNode.kind === Kind.VARIABLE && !context.static) {
        const scopedVariableValues = getScopedVariableValues(
          context,
          fieldValueNode,
        );
        const variableName = fieldValueNode.name.value;
        const value = scopedVariableValues?.coerced[variableName];
        if (inputType.isOneOf) {
          if (value === undefined) {
            reportInvalidLiteral(
              context.onError,
              `Expected variable "$${variableName}" provided to field "${fieldName}" for OneOf Input Object type "${typeStr}" to provide a runtime value.`,
              valueNode,
              path,
            );
          } else if (value === null) {
            reportInvalidLiteral(
              context.onError,
              `Expected variable "$${variableName}" provided to field "${fieldName}" for OneOf Input Object type "${typeStr}" not to be null.`,
              valueNode,
              path,
            );
          }
        } else if (value === undefined && !isRequiredField) {
          continue;
        }
      }

      validateInputLiteralImpl(
        context,
        fieldValueNode,
        fieldType,
        hideSuggestions,
        addPath(path, fieldName, typeStr),
      );
    }

    const knownFields: Array<ObjectFieldNode> = [];
    // Ensure every provided field is defined.
    for (const fieldNode of valueNode.fields) {
      const fieldName = fieldNode.name.value;
      if (!fieldDefGroups.has(fieldName)) {
        const suggestion = hideSuggestions
          ? ''
          : didYouMean(suggestionList(fieldName, fieldNames));
        reportInvalidLiteral(
          context.onError,
          `Expected value of type "${typeStr}" not to include unknown field "${fieldName}"${
            suggestion ? `.${suggestion} Found` : ', found'
          }: ${print(valueNode)}.`,
          fieldNode,
          path,
        );
      } else {
        knownFields.push(fieldNode);
      }
    }

    if (inputType.isOneOf) {
      const isNotExactlyOneField = knownFields.length !== 1;
      if (isNotExactlyOneField) {
        reportInvalidLiteral(
          context.onError,
          getOneOfInputObjectErrorMessage(typeStr),
          valueNode,
          path,
        );
        return;
      }

      const fieldValueNode = knownFields[0].value;
      if (fieldValueNode.kind === Kind.NULL) {
        const fieldName = knownFields[0].name.value;
        reportInvalidLiteral(
          context.onError,
          getOneOfInputObjectErrorMessage(typeStr),
          valueNode,
          addPath(path, fieldName, undefined),
        );
      }
    }
  } else {
    let result;
    let caughtError: unknown;
    try {
      result = constInputSchema.coerceLeafLiteral(
        type,
        valueNode,
        context.variables,
        context.fragmentVariableValues,
        hideSuggestions,
      );
    } catch (error) {
      if (error instanceof GraphQLError) {
        context.onError(error, pathToArray(path));
        return;
      }
      caughtError = error;
    }

    if (result === undefined) {
      reportInvalidLiteral(
        context.onError,
        `Expected value of type "${inputType.typeStr}"${
          caughtError != null
            ? `, but encountered error "${getCaughtErrorMessage(caughtError)}"; found`
            : ', found'
        }: ${print(valueNode)}.`,
        valueNode,
        path,
        ensureGraphQLError(caughtError),
      );
    }
  }
}

function groupByName<T>(
  items: ReadonlyArray<T>,
  getName: (item: T) => string,
): Map<string, Array<T>> {
  const grouped = new Map<string, Array<T>>();
  for (const item of items) {
    const name = getName(item);
    let group = grouped.get(name);
    if (group == null) {
      group = [];
      grouped.set(name, group);
    }
    group.push(item);
  }
  return grouped;
}

function getScopedVariableValues<
  TInputType,
  TInputField,
  TNonNullInputType extends TInputType,
  TListInputType extends TInputType,
  TInputObjectType extends TInputType,
  TLeafInputType extends TInputType,
>(
  context: InputLiteralValidationContext<
    TInputType,
    TInputField,
    TNonNullInputType,
    TListInputType,
    TInputObjectType,
    TLeafInputType
  >,
  valueNode: VariableNode,
): Maybe<VariableValues> {
  const variableName = valueNode.name.value;
  const { fragmentVariableValues, variables } = context;
  return fragmentVariableValues?.sources[variableName]
    ? fragmentVariableValues
    : variables;
}

function reportInvalidLiteral(
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  message: string,
  valueNode: ASTNode,
  path: Path | undefined,
  originalError?: GraphQLError,
): void {
  onError(
    new GraphQLError(message, {
      nodes: valueNode,
      originalError,
    }),
    pathToArray(path),
  );
}

function getCaughtErrorMessage(caughtError: unknown): string {
  if (isObjectLike(caughtError)) {
    const message = caughtError.message;
    if (typeof message === 'string' && message !== '') {
      return message;
    }
  }

  return String(caughtError);
}

function getOneOfInputObjectErrorMessage(typeStr: string): string {
  return `Within OneOf Input Object type "${typeStr}", exactly one field must be specified, and the value for that field must be non-null.`;
}
