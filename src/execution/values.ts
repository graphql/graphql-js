/** @category Values */

import { invariant } from '../jsutils/invariant.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap, ReadOnlyObjMap } from '../jsutils/ObjMap.ts';
import { printPathArray } from '../jsutils/printPathArray.ts';

import { ensureGraphQLError } from '../error/ensureGraphQLError.ts';
import { GraphQLError } from '../error/GraphQLError.ts';

import type {
  ArgumentNode,
  DirectiveNode,
  FieldNode,
  FragmentArgumentNode,
  FragmentSpreadNode,
  VariableDefinitionNode,
} from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';

import type { GraphQLArgument, GraphQLField } from '../type/definition.ts';
import {
  isArgument,
  isNonNullType,
  isRequiredArgument,
} from '../type/definition.ts';
import type { GraphQLDirective } from '../type/directives.ts';
import type { GraphQLSchema } from '../type/schema.ts';
import { validateDefaultInput } from '../type/validate.ts';

import {
  coerceDefaultValue,
  coerceInputLiteral,
  coerceInputValue,
} from '../utilities/coerceInputValue.ts';
import {
  validateInputLiteral,
  validateInputValue,
} from '../utilities/validateInputValue.ts';

import type {
  FragmentVariableValues,
  FragmentVariableValueSource,
} from './collectFields.ts';
import type { GraphQLVariableSignature } from './getVariableSignature.ts';
import { getVariableSignature } from './getVariableSignature.ts';

/**
 * Coerced variable values prepared for execution.
 *
 * The `coerced` map contains runtime values keyed by variable name. The
 * `sources` map records whether each value came from request input, an operation
 * default, or a fragment-variable default so utilities can preserve defaults
 * when replacing variables in literals.
 */
export interface VariableValues {
  /** Source metadata for each variable value keyed by variable name. */
  readonly sources: ReadOnlyObjMap<VariableValueSource>;
  /** Coerced runtime variable values keyed by variable name. */
  readonly coerced: ReadOnlyObjMap<unknown>;
}

interface VariableValueSource {
  readonly signature: GraphQLVariableSignature;
  readonly value?: unknown;
}

type VariableValuesOrErrors =
  | { variableValues: VariableValues; errors?: never }
  | { errors: ReadonlyArray<GraphQLError>; variableValues?: never };

/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, GraphQLError values are returned.
 *
 * Note: Returned maps use null prototypes to avoid collisions with
 * Object prototype properties.
 * @param schema - GraphQL schema to use.
 * @param varDefNodes - The variable definition AST nodes to coerce.
 * @param inputs - The runtime variable values keyed by variable name.
 * @param options - Optional configuration for this operation.
 * @param [options.maxErrors] - Maximum number of coercion errors to report.
 * @param [options.hideSuggestions] - Whether suggestion text should be omitted
 * from errors.
 * @returns Coerced variable values with source metadata, or request errors.
 * @example
 * ```ts
 * // Coerce provided variables and apply operation defaults.
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { getVariableValues } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     reviews(stars: Int!, limit: Int = 10): [String]
 *   }
 * `);
 * const document = parse(`
 *   query ($stars: Int!, $limit: Int = 10) {
 *     reviews(stars: $stars, limit: $limit)
 *   }
 * `);
 * const operation = document.definitions[0];
 *
 * const result = getVariableValues(schema, operation.variableDefinitions, {
 *   stars: '5',
 * });
 *
 * assert('variableValues' in result);
 *
 * result.variableValues.coerced; // => { stars: 5, limit: 10 }
 * ```
 * @example
 * ```ts
 * // This variant uses maxErrors to cap reported coercion errors.
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { getVariableValues } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   type Query {
 *     review(input: ReviewInput!): String
 *   }
 * `);
 * const document = parse(`
 *   query ($first: ReviewInput!, $second: ReviewInput!) {
 *     first: review(input: $first)
 *     second: review(input: $second)
 *   }
 * `);
 * const operation = document.definitions[0];
 *
 * const result = getVariableValues(
 *   schema,
 *   operation.variableDefinitions,
 *   { first: { stars: 'bad' }, second: { stars: 'also bad' } },
 *   { maxErrors: 1 },
 * );
 *
 * assert('errors' in result);
 *
 * result.errors.length; // => 2
 * result.errors[1].message; // matches /error limit reached/
 * ```
 */
export function getVariableValues(
  schema: GraphQLSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { readonly [variable: string]: unknown },
  options?: { maxErrors?: number; hideSuggestions?: boolean },
): VariableValuesOrErrors {
  const errors: Array<GraphQLError> = [];
  const maxErrors = options?.maxErrors;
  try {
    const variableValues = coerceVariableValues(
      schema,
      varDefNodes,
      inputs,
      (error) => {
        if (maxErrors != null && errors.length >= maxErrors) {
          throw new GraphQLError(
            'Too many errors processing variables, error limit reached. Execution aborted.',
          );
        }
        errors.push(error);
      },
      options?.hideSuggestions,
    );

    if (errors.length === 0) {
      return { variableValues };
    }
  } catch (error) {
    errors.push(ensureGraphQLError(error));
  }

  return { errors };
}

function coerceVariableValues(
  schema: GraphQLSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { readonly [variable: string]: unknown },
  onError: (error: GraphQLError) => void,
  hideSuggestions?: Maybe<boolean>,
): VariableValues {
  const sources: ObjMap<VariableValueSource> = Object.create(null);
  const coerced: ObjMap<unknown> = Object.create(null);
  for (const varDefNode of varDefNodes) {
    const varSignature = getVariableSignature(schema, varDefNode);

    if (varSignature instanceof GraphQLError) {
      onError(varSignature);
      continue;
    }

    const { name: varName, type: varType } = varSignature;
    const value = Object.hasOwn(inputs, varName) ? inputs[varName] : undefined;
    if (value === undefined) {
      sources[varName] = { signature: varSignature };
      if (varDefNode.defaultValue) {
        maybeUseDefaultValue(
          coerced,
          varName,
          varSignature,
          (error, path) => {
            onError(
              new GraphQLError(
                `Variable "$${varName}" has invalid default value${printPathArray(path)}: ${error.message}`,
                { nodes: varDefNode },
              ),
            );
          },
          hideSuggestions,
        );
        continue;
      } else if (!isNonNullType(varType)) {
        // Non-provided values for nullable variables are omitted.
        continue;
      }
    } else {
      sources[varName] = { signature: varSignature, value };
    }

    const coercedValue = coerceInputValue(value, varType);
    if (coercedValue !== undefined) {
      coerced[varName] = coercedValue;
    } else {
      validateInputValue(
        value,
        varType,
        (error, path) => {
          onError(
            new GraphQLError(
              `Variable "$${varName}" has invalid value${printPathArray(path)}: ${
                error.message
              }`,
              { nodes: varDefNode, originalError: error },
            ),
          );
        },
        hideSuggestions,
      );
    }
  }

  return { sources, coerced };
}

function maybeUseDefaultValue(
  coercedValues: ObjMap<unknown>,
  name: string,
  inputValue: GraphQLArgument | GraphQLVariableSignature,
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  hideSuggestions?: Maybe<boolean>,
): void {
  try {
    // coerceDefaultValue assumes validation has already rejected invalid
    // defaults. If validation was skipped, invalid defaults or nested input
    // field defaults can throw here; recover with validation-style errors below.
    const coercedDefaultValue = coerceDefaultValue(inputValue);
    if (coercedDefaultValue !== undefined) {
      coercedValues[name] = coercedDefaultValue;
    }
  } catch (error) {
    const defaultInput = inputValue.default;
    // Defensive: coerceDefaultValue should only throw while coercing a default.
    /* node:coverage ignore next 3 */
    if (defaultInput === undefined) {
      throw error;
    }

    // Prefer validation's user-facing errors for invalid defaults.
    let reportedValidationError = false;
    validateDefaultInput(
      defaultInput,
      inputValue.type,
      (defaultError, path) => {
        reportedValidationError = true;
        onError(defaultError, path);
      },
      hideSuggestions,
    );

    if (!reportedValidationError) {
      // The default itself validated, so coercion failed while applying a nested
      // input field default. Surface the original coercion error.
      onError(ensureGraphQLError(error), []);
    }
  }
}

/** @internal */
export function getFragmentVariableValues(
  fragmentSpreadNode: FragmentSpreadNode,
  fragmentSignatures: ReadOnlyObjMap<GraphQLVariableSignature>,
  variableValues: VariableValues,
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
  hideSuggestions?: Maybe<boolean>,
): FragmentVariableValues {
  const argumentNodes = fragmentSpreadNode.arguments ?? [];
  const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));
  const sources: ObjMap<FragmentVariableValueSource> = Object.create(null);
  const coerced: ObjMap<unknown> = Object.create(null);
  for (const [varName, varSignature] of Object.entries(fragmentSignatures)) {
    const argumentNode = argNodeMap.get(varName);
    if (argumentNode !== undefined) {
      sources[varName] =
        fragmentVariableValues == null
          ? { signature: varSignature, value: argumentNode.value }
          : {
              signature: varSignature,
              value: argumentNode.value,
              fragmentVariableValues,
            };
    } else {
      sources[varName] = {
        signature: varSignature,
      };
    }

    coerceArgument(
      coerced,
      fragmentSpreadNode,
      varName,
      varSignature,
      argumentNode,
      variableValues,
      fragmentVariableValues,
      hideSuggestions,
    );
  }

  return { sources, coerced };
}

/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: Returned value uses a null prototype to avoid collisions with
 * JavaScript's own property names.
 * @param def - Field or directive definition that declares the arguments.
 * @param node - Field or directive AST node supplying argument literals.
 * @param variableValues - Operation variable values returned by getVariableValues.
 * @param fragmentVariableValues - Fragment variable values for the current fragment scope.
 * @param hideSuggestions - Whether suggestion text should be omitted from errors.
 * @returns A map of coerced argument values.
 * @example
 * ```ts
 * // Read literal argument values and defaults.
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { getArgumentValues } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     reviews(stars: Int!, limit: Int = 10): [String]
 *   }
 * `);
 * const fieldDef = schema.getQueryType().getFields().reviews;
 * const document = parse('{ reviews(stars: 5) }');
 * const fieldNode = document.definitions[0].selectionSet.selections[0];
 *
 * getArgumentValues(fieldDef, fieldNode); // => { stars: 5, limit: 10 }
 * ```
 * @example
 * ```ts
 * // This variant resolves argument values from operation variables.
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { getArgumentValues, getVariableValues } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     reviews(stars: Int!): [String]
 *   }
 * `);
 * const fieldDef = schema.getQueryType().getFields().reviews;
 * const document = parse('query ($stars: Int!) { reviews(stars: $stars) }');
 * const operation = document.definitions[0];
 * const fieldNode = document.definitions[0].selectionSet.selections[0];
 * const variables = getVariableValues(schema, operation.variableDefinitions, {
 *   stars: '5',
 * });
 *
 * assert('variableValues' in variables);
 *
 * getArgumentValues(fieldDef, fieldNode, variables.variableValues); // => { stars: 5 }
 * getArgumentValues(fieldDef, fieldNode); // throws an error
 * ```
 */
export function getArgumentValues(
  def: GraphQLField<unknown, unknown> | GraphQLDirective,
  node: FieldNode | DirectiveNode,
  variableValues?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
  hideSuggestions?: Maybe<boolean>,
): ObjMap<unknown> {
  const coercedValues: ObjMap<unknown> = Object.create(null);

  const argumentNodes = node.arguments ?? [];
  const argNodeMap = new Map(argumentNodes.map((arg) => [arg.name.value, arg]));

  for (const argDef of def.args) {
    const name = argDef.name;
    coerceArgument(
      coercedValues,
      node,
      name,
      argDef,
      argNodeMap.get(argDef.name),
      variableValues,
      fragmentVariableValues,
      hideSuggestions,
    );
  }
  return coercedValues;
}

/** @internal */
// eslint-disable-next-line max-params
function coerceArgument(
  coercedValues: ObjMap<unknown>,
  node: FieldNode | DirectiveNode | FragmentSpreadNode,
  argName: string,
  argDef: GraphQLArgument | GraphQLVariableSignature,
  argumentNode: ArgumentNode | FragmentArgumentNode | undefined,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
  hideSuggestions?: Maybe<boolean>,
): void {
  const argType = argDef.type;
  const onArgDefaultValueError = (
    error: GraphQLError,
    path: ReadonlyArray<string | number>,
  ): never => {
    throw new GraphQLError(
      `${printArgumentOrFragmentVariable(argDef, node)} has invalid default value${printPathArray(path)}: ${error.message}`,
      { nodes: node },
    );
  };

  if (!argumentNode) {
    if (isRequiredArgument(argDef)) {
      // Note: ProvidedRequiredArgumentsRule validation should catch this before
      // execution. This is a runtime check to ensure execution does not
      // continue with an invalid argument value.
      throw new GraphQLError(
        // TODO: clean up the naming of isRequiredArgument(), isArgument(), and argDef if/when experimental fragment variables are merged
        `${printArgumentOrFragmentVariable(argDef, node)} of required type "${argType}" was not provided.`,
        { nodes: node },
      );
    }
    maybeUseDefaultValue(
      coercedValues,
      argName,
      argDef,
      onArgDefaultValueError,
      hideSuggestions,
    );
    return;
  }

  const valueNode = argumentNode.value;

  // Variables without a value are treated as if no argument was provided if
  // the argument is not required.
  if (valueNode.kind === Kind.VARIABLE) {
    const variableName = valueNode.name.value;
    const scopedVariableValues = fragmentVariableValues?.sources[variableName]
      ? fragmentVariableValues
      : variableValues;
    if (
      (scopedVariableValues == null ||
        !Object.hasOwn(scopedVariableValues.coerced, variableName)) &&
      !isRequiredArgument(argDef)
    ) {
      maybeUseDefaultValue(
        coercedValues,
        argName,
        argDef,
        onArgDefaultValueError,
        hideSuggestions,
      );
      return;
    }
  }
  const coercedValue = coerceInputLiteral(
    valueNode,
    argType,
    variableValues,
    fragmentVariableValues,
  );
  if (coercedValue === undefined) {
    // Note: ValuesOfCorrectTypeRule validation should catch this before
    // execution. This is a runtime check to ensure execution does not
    // continue with an invalid argument value.
    validateInputLiteral(
      valueNode,
      argType,
      (error, path) => {
        // TODO: clean up the naming of isRequiredArgument(), isArgument(), and argDef if/when experimental fragment variables are merged
        error.message = `${printArgumentOrFragmentVariable(argDef, node)} has invalid value${printPathArray(
          path,
        )}: ${error.message}`;
        throw error;
      },
      variableValues,
      fragmentVariableValues,
      hideSuggestions,
    );
    /* node:coverage ignore next */
    invariant(false, 'Invalid argument');
  }
  coercedValues[argName] = coercedValue;
}

// TODO: clean up the naming of isRequiredArgument(), isArgument(), and argDef if/when experimental fragment variables are merged
function printArgumentOrFragmentVariable(
  argDef: GraphQLArgument | GraphQLVariableSignature,
  node: FieldNode | DirectiveNode | FragmentSpreadNode,
): string {
  return isArgument(argDef)
    ? `Argument "${argDef}"`
    : `Variable "$${argDef.name}" defined by fragment "${node.name.value}"`;
}

/**
 * Prepares an object map of argument values given a directive definition
 * and a AST node which may contain directives. Optionally also accepts a map
 * of variable values.
 *
 * If the directive does not exist on the node, returns undefined.
 *
 * Note: Returned value uses a null prototype to avoid collisions with
 * JavaScript's own property names.
 * @param directiveDef - Directive definition to read argument definitions from.
 * @param node - AST node that may contain directives.
 * @param node.directives - The directives on the AST node.
 * @param variableValues - Operation variable values returned by getVariableValues.
 * @param fragmentVariableValues - Fragment variable values for the current fragment scope.
 * @param hideSuggestions - Whether suggestion text should be omitted from errors.
 * @returns A map of coerced directive argument values, or undefined when absent.
 * @example
 * ```ts
 * // Read literal directive arguments from a node.
 * import { parse } from 'graphql/language';
 * import { GraphQLSkipDirective } from 'graphql/type';
 * import { getDirectiveValues } from 'graphql/execution';
 *
 * const document = parse('{ name @skip(if: true) }');
 * const fieldNode = document.definitions[0].selectionSet.selections[0];
 *
 * getDirectiveValues(GraphQLSkipDirective, fieldNode); // => { if: true }
 * ```
 * @example
 * ```ts
 * // This variant resolves directive arguments from variables and handles absent directives.
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { GraphQLIncludeDirective } from 'graphql/type';
 * import { buildSchema } from 'graphql/utilities';
 * import { getDirectiveValues, getVariableValues } from 'graphql/execution';
 *
 * const schema = buildSchema('type Query { name: String }');
 * const document = parse(
 *   'query ($includeName: Boolean!) { name @include(if: $includeName) }',
 * );
 * const operation = document.definitions[0];
 * const fieldNode = document.definitions[0].selectionSet.selections[0];
 * const variables = getVariableValues(schema, operation.variableDefinitions, {
 *   includeName: false,
 * });
 *
 * assert('variableValues' in variables);
 *
 * getDirectiveValues(
 *   GraphQLIncludeDirective,
 *   fieldNode,
 *   variables.variableValues,
 * ); // => { if: false }
 * getDirectiveValues(GraphQLIncludeDirective, { directives: [] }); // => undefined
 * ```
 */
export function getDirectiveValues(
  directiveDef: GraphQLDirective,
  node: { readonly directives?: ReadonlyArray<DirectiveNode> | undefined },
  variableValues?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
  hideSuggestions?: Maybe<boolean>,
): undefined | ObjMap<unknown> {
  const directiveNode = node.directives?.find(
    (directive) => directive.name.value === directiveDef.name,
  );

  if (directiveNode) {
    return getArgumentValues(
      directiveDef,
      directiveNode,
      variableValues,
      fragmentVariableValues,
      hideSuggestions,
    );
  }
}
