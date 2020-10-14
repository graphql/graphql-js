import arrayFrom from '../polyfills/arrayFrom';
import { SYMBOL_ASYNC_ITERATOR } from '../polyfills/symbols';

import type { Path } from '../jsutils/Path';
import type { ObjMap } from '../jsutils/ObjMap';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import inspect from '../jsutils/inspect';
import memoize3 from '../jsutils/memoize3';
import invariant from '../jsutils/invariant';
import devAssert from '../jsutils/devAssert';
import isPromise from '../jsutils/isPromise';
import isAsyncIterable from '../jsutils/isAsyncIterable';
import isObjectLike from '../jsutils/isObjectLike';
import isCollection from '../jsutils/isCollection';
import promiseReduce from '../jsutils/promiseReduce';
import promiseForObject from '../jsutils/promiseForObject';
import { addPath, pathToArray } from '../jsutils/Path';

import type { GraphQLFormattedError } from '../error/formatError';
import { GraphQLError } from '../error/GraphQLError';
import { locatedError } from '../error/locatedError';

import type {
  DocumentNode,
  OperationDefinitionNode,
  SelectionSetNode,
  FieldNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
} from '../language/ast';
import { Kind } from '../language/kinds';

import type { GraphQLSchema } from '../type/schema';
import type {
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLLeafType,
  GraphQLAbstractType,
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
  GraphQLList,
} from '../type/definition';
import { assertValidSchema } from '../type/validate';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from '../type/introspection';
import {
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../type/directives';
import {
  isNamedType,
  isObjectType,
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
} from '../type/definition';

import { typeFromAST } from '../utilities/typeFromAST';
import { getOperationRootType } from '../utilities/getOperationRootType';

import {
  getVariableValues,
  getArgumentValues,
  getDirectiveValues,
} from './values';

/**
 * Terminology
 *
 * "Definitions" are the generic name for top-level statements in the document.
 * Examples of this include:
 * 1) Operations (such as a query)
 * 2) Fragments
 *
 * "Operations" are a generic name for requests in the document.
 * Examples of this include:
 * 1) query,
 * 2) mutation
 *
 * "Selections" are the definitions that can appear legally and at
 * single level of the query. These include:
 * 1) field references e.g "a"
 * 2) fragment "spreads" e.g. "...c"
 * 3) inline fragment "spreads" e.g. "...on Type { a }"
 */

/**
 * Data that must be available at all points during query execution.
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
 */
export type ExecutionContext = {|
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  rootValue: mixed,
  contextValue: mixed,
  operation: OperationDefinitionNode,
  variableValues: { [variable: string]: mixed, ... },
  fieldResolver: GraphQLFieldResolver<any, any>,
  typeResolver: GraphQLTypeResolver<any, any>,
  errors: Array<GraphQLError>,
  dispatcher: Dispatcher,
|};

/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 *   - `hasNext` is true if a future payload is expected.
 *   - `extensions` is reserved for adding non-standard properties.
 */
export type ExecutionResult = {|
  errors?: $ReadOnlyArray<GraphQLError>,
  data?: ObjMap<mixed> | null,
  hasNext?: boolean,
  extensions?: ObjMap<mixed>,
|};

export type FormattedExecutionResult = {|
  errors?: $ReadOnlyArray<GraphQLFormattedError>,
  data?: ObjMap<mixed> | null,
  hasNext?: boolean,
  extensions?: ObjMap<mixed>,
|};

/**
 * The result of an asynchronous GraphQL patch.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of the additional asynchronous data.
 *   - `path` is the location of data.
 *   - `label` is the label provided to @defer or @stream.
 *   - `hasNext` is true if a future payload is expected.
 *   - `extensions` is reserved for adding non-standard properties.
 */
export type ExecutionPatchResult = {|
  errors?: $ReadOnlyArray<GraphQLError>,
  data?: ObjMap<mixed> | mixed | null,
  path?: $ReadOnlyArray<string | number>,
  label?: string,
  hasNext: boolean,
  extensions?: ObjMap<mixed>,
|};

export type FormattedExecutionPatchResult = {|
  errors?: $ReadOnlyArray<GraphQLFormattedError>,
  data?: ObjMap<mixed> | mixed | null,
  path?: $ReadOnlyArray<string | number>,
  label?: string,
  hasNext: boolean,
  extensions?: ObjMap<mixed>,
|};

export type AsyncExecutionResult = ExecutionResult | ExecutionPatchResult;

export type ExecutionArgs = {|
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{ +[variable: string]: mixed, ... },
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>,
  typeResolver?: ?GraphQLTypeResolver<any, any>,
|};

export type FieldsAndPatches = {
  fields: ObjMap<Array<FieldNode>>,
  patches: Array<{| label?: string, fields: ObjMap<Array<FieldNode>> |}>,
  ...
};

/**
 * Implements the "Evaluating requests" section of the GraphQL specification.
 *
 * Returns either a synchronous ExecutionResult (if all encountered resolvers
 * are synchronous), or a Promise of an ExecutionResult that will eventually be
 * resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 *
 * Accepts either an object with named arguments, or individual arguments.
 */
declare function execute(
  ExecutionArgs,
  ..._: []
): PromiseOrValue<ExecutionResult>;
/* eslint-disable no-redeclare */
declare function execute(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{ +[variable: string]: mixed, ... },
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>,
  typeResolver?: ?GraphQLTypeResolver<any, any>,
): PromiseOrValue<ExecutionResult>;
export function execute(
  argsOrSchema,
  document,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  typeResolver,
) {
  /* eslint-enable no-redeclare */
  // Extract arguments from object args if provided.
  return arguments.length === 1
    ? executeImpl(argsOrSchema)
    : executeImpl({
        schema: argsOrSchema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        typeResolver,
      });
}

/**
 * Also implements the "Evaluating requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
export function executeSync(args: ExecutionArgs): ExecutionResult {
  const result = executeImpl(args);

  // Assert that the execution was synchronous.
  if (isPromise(result) || isAsyncIterable(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  // Note: Flow can't refine isAsyncIterable, so explicit casts are used.
  return ((result: any): ExecutionResult);
}

function executeImpl(
  args: ExecutionArgs,
): PromiseOrValue<ExecutionResult | AsyncIterable<AsyncExecutionResult>> {
  const {
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  } = args;

  // If arguments are missing or incorrect, throw an error.
  assertValidExecutionArguments(schema, document, variableValues);

  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  );

  // Return early errors if execution context failed.
  if (Array.isArray(exeContext)) {
    return { errors: exeContext };
  }

  // Return a Promise that will eventually resolve to the data described by
  // The "Response" section of the GraphQL specification.
  //
  // If errors are encountered while executing a GraphQL field, only that
  // field and its descendants will be omitted, and sibling fields will still
  // be executed. An execution which encounters errors will still result in a
  // resolved Promise.
  const data = executeOperation(exeContext, exeContext.operation, rootValue);
  return buildResponse(exeContext, data);
}

/**
 * Given a completed execution context and data, build the { errors, data }
 * response defined by the "Response" section of the GraphQL specification.
 */
function buildResponse(
  exeContext: ExecutionContext,
  data: PromiseOrValue<ObjMap<mixed> | null>,
): PromiseOrValue<ExecutionResult | AsyncIterable<AsyncExecutionResult>> {
  if (isPromise(data)) {
    return data.then((resolved) => buildResponse(exeContext, resolved));
  }

  const initialResult =
    exeContext.errors.length === 0
      ? { data }
      : { errors: exeContext.errors, data };

  if (exeContext.dispatcher.hasSubsequentPayloads()) {
    return exeContext.dispatcher.get(initialResult);
  }

  return initialResult;
}

/**
 * Essential assertions before executing to provide developer feedback for
 * improper use of the GraphQL library.
 *
 * @internal
 */
export function assertValidExecutionArguments(
  schema: GraphQLSchema,
  document: DocumentNode,
  rawVariableValues: ?{ +[variable: string]: mixed, ... },
): void {
  devAssert(document, 'Must provide document.');

  // If the schema used for execution is invalid, throw an error.
  assertValidSchema(schema);

  // Variables, if provided, must be an object.
  devAssert(
    rawVariableValues == null || isObjectLike(rawVariableValues),
    'Variables must be provided as an Object where each property is a variable value. Perhaps look to see if an unparsed JSON string was provided.',
  );
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 *
 * @internal
 */
export function buildExecutionContext(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue: mixed,
  contextValue: mixed,
  rawVariableValues: ?{ +[variable: string]: mixed, ... },
  operationName: ?string,
  fieldResolver: ?GraphQLFieldResolver<mixed, mixed>,
  typeResolver?: ?GraphQLTypeResolver<mixed, mixed>,
): $ReadOnlyArray<GraphQLError> | ExecutionContext {
  let operation: OperationDefinitionNode | void;
  const fragments: ObjMap<FragmentDefinitionNode> = Object.create(null);
  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (operationName == null) {
          if (operation !== undefined) {
            return [
              new GraphQLError(
                'Must provide operation name if query contains multiple operations.',
              ),
            ];
          }
          operation = definition;
        } else if (definition.name?.value === operationName) {
          operation = definition;
        }
        break;
      case Kind.FRAGMENT_DEFINITION:
        fragments[definition.name.value] = definition;
        break;
    }
  }

  if (!operation) {
    if (operationName != null) {
      return [new GraphQLError(`Unknown operation named "${operationName}".`)];
    }
    return [new GraphQLError('Must provide an operation.')];
  }

  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  const variableDefinitions = operation.variableDefinitions ?? [];

  const coercedVariableValues = getVariableValues(
    schema,
    variableDefinitions,
    rawVariableValues ?? {},
    { maxErrors: 50 },
  );

  if (coercedVariableValues.errors) {
    return coercedVariableValues.errors;
  }

  return {
    schema,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues: coercedVariableValues.coerced,
    fieldResolver: fieldResolver ?? defaultFieldResolver,
    typeResolver: typeResolver ?? defaultTypeResolver,
    dispatcher: new Dispatcher(),
    errors: [],
  };
}

/**
 * Implements the "Evaluating operations" section of the spec.
 */
export function executeOperation(
  exeContext: ExecutionContext,
  operation: OperationDefinitionNode,
  rootValue: mixed,
): PromiseOrValue<ObjMap<mixed> | null> {
  const type = getOperationRootType(exeContext.schema, operation);
  const { fields, patches } = collectFields(
    exeContext,
    type,
    operation.selectionSet,
    Object.create(null),
    [],
    Object.create(null),
  );

  const path = undefined;

  // Errors from sub-fields of a NonNull type may propagate to the top level,
  // at which point we still log the error and null the parent field, which
  // in this case is the entire response.
  try {
    let result;

    if (operation.operation === 'mutation') {
      result = executeFieldsSerially(exeContext, type, rootValue, path, fields);
    } else {
      result = executeFields(
        exeContext,
        type,
        rootValue,
        path,
        fields,
        exeContext.errors,
      );
    }

    for (const patch of patches) {
      const { label, fields: patchFields } = patch;
      const errors = [];

      exeContext.dispatcher.addFields(
        label,
        path,
        executeFields(exeContext, type, rootValue, path, patchFields, errors),
        errors,
      );
    }

    if (isPromise(result)) {
      return result.then(undefined, (error) => {
        exeContext.errors.push(error);
        return Promise.resolve(null);
      });
    }
    return result;
  } catch (error) {
    exeContext.errors.push(error);
    return null;
  }
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "write" mode.
 */
function executeFieldsSerially(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  path: Path | void,
  fields: ObjMap<Array<FieldNode>>,
): PromiseOrValue<ObjMap<mixed>> {
  return promiseReduce(
    Object.keys(fields),
    (results, responseName) => {
      const fieldNodes = fields[responseName];
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = resolveField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath,
        exeContext.errors,
      );
      if (result === undefined) {
        return results;
      }
      if (isPromise(result)) {
        return result.then((resolvedResult) => {
          results[responseName] = resolvedResult;
          return results;
        });
      }
      results[responseName] = result;
      return results;
    },
    Object.create(null),
  );
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "read" mode.
 */
function executeFields(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  path: Path | void,
  fields: ObjMap<Array<FieldNode>>,
  errors: Array<GraphQLError>,
): PromiseOrValue<ObjMap<mixed>> {
  const results = Object.create(null);
  let containsPromise = false;

  for (const responseName of Object.keys(fields)) {
    const fieldNodes = fields[responseName];
    const fieldPath = addPath(path, responseName, parentType.name);
    const result = resolveField(
      exeContext,
      parentType,
      sourceValue,
      fieldNodes,
      fieldPath,
      errors,
    );

    if (result !== undefined) {
      results[responseName] = result;
      if (isPromise(result)) {
        containsPromise = true;
      }
    }
  }

  // If there are no promises, we can just return the object
  if (!containsPromise) {
    return results;
  }

  // Otherwise, results is a map from field name to the result of resolving that
  // field, which is possibly a promise. Return a promise that will return this
  // same map, but with any promises replaced with the values they resolved to.
  return promiseForObject(results);
}

/**
 * Given a selectionSet, adds all of the fields in that selection to
 * the passed in map of fields, and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns an Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 *
 * @internal
 */
export function collectFields(
  exeContext: ExecutionContext,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  fields: ObjMap<Array<FieldNode>>,
  patches: Array<{| label?: string, fields: ObjMap<Array<FieldNode>> |}>,
  visitedFragmentNames: ObjMap<boolean>,
): FieldsAndPatches {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(exeContext, selection)) {
          continue;
        }
        const name = getFieldEntryKey(selection);
        if (!fields[name]) {
          fields[name] = [];
        }
        fields[name].push(selection);
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(exeContext, selection) ||
          !doesFragmentConditionMatch(exeContext, selection, runtimeType)
        ) {
          continue;
        }

        const defer = getDeferValues(exeContext, selection);

        if (defer) {
          const { fields: patchFields } = collectFields(
            exeContext,
            runtimeType,
            selection.selectionSet,
            Object.create(null),
            patches,
            visitedFragmentNames,
          );
          patches.push({
            label: defer.label,
            fields: patchFields,
          });
        } else {
          collectFields(
            exeContext,
            runtimeType,
            selection.selectionSet,
            fields,
            patches,
            visitedFragmentNames,
          );
        }
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        if (!shouldIncludeNode(exeContext, selection)) {
          continue;
        }

        const defer = getDeferValues(exeContext, selection);

        if (
          visitedFragmentNames[fragName] &&
          // Cannot continue in this case because fields must be recollected for patch
          !defer
        ) {
          continue;
        }
        visitedFragmentNames[fragName] = true;
        const fragment = exeContext.fragments[fragName];
        if (
          !fragment ||
          !doesFragmentConditionMatch(exeContext, fragment, runtimeType)
        ) {
          continue;
        }

        if (defer) {
          const { fields: patchFields } = collectFields(
            exeContext,
            runtimeType,
            fragment.selectionSet,
            Object.create(null),
            patches,
            visitedFragmentNames,
          );
          patches.push({
            label: defer.label,
            fields: patchFields,
          });
        } else {
          collectFields(
            exeContext,
            runtimeType,
            fragment.selectionSet,
            fields,
            patches,
            visitedFragmentNames,
          );
        }

        break;
      }
    }
  }
  return { fields, patches };
}

/**
 * Determines if a field should be included based on the @include and @skip
 * directives, where @skip has higher precedence than @include.
 */
function shouldIncludeNode(
  exeContext: ExecutionContext,
  node: FragmentSpreadNode | FieldNode | InlineFragmentNode,
): boolean {
  const skip = getDirectiveValues(
    GraphQLSkipDirective,
    node,
    exeContext.variableValues,
  );
  if (skip?.if === true) {
    return false;
  }

  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    exeContext.variableValues,
  );
  if (include?.if === false) {
    return false;
  }
  return true;
}

/**
 * Returns an object containing the @defer arguments if a field should be
 * deferred based on the experimental flag, defer directive present and
 * not disabled by the "if" argument.
 */
function getDeferValues(
  exeContext: ExecutionContext,
  node: FragmentSpreadNode | InlineFragmentNode,
): void | {| label?: string |} {
  const defer = getDirectiveValues(
    GraphQLDeferDirective,
    node,
    exeContext.variableValues,
  );

  if (!defer) {
    return;
  }

  if (defer.if === false) {
    return;
  }

  return {
    label: typeof defer.label === 'string' ? defer.label : undefined,
  };
}

/**
 * Returns an object containing the @stream arguments if a field should be
 * streamed based on the experimental flag, stream directive present and
 * not disabled by the "if" argument.
 */
function getStreamValues(
  exeContext: ExecutionContext,
  fieldNodes: $ReadOnlyArray<FieldNode>,
): void | {|
  initialCount?: number,
  label?: string,
|} {
  // validation only allows equivalent streams on multiple fields, so it is
  // safe to only check the first fieldNode for the stream directive
  const stream = getDirectiveValues(
    GraphQLStreamDirective,
    fieldNodes[0],
    exeContext.variableValues,
  );

  if (!stream) {
    return;
  }

  if (stream.if === false) {
    return;
  }

  return {
    initialCount:
      // istanbul ignore next (initialCount is required number argument)
      typeof stream.initialCount === 'number' ? stream.initialCount : undefined,
    label: typeof stream.label === 'string' ? stream.label : undefined,
  };
}

/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(
  exeContext: ExecutionContext,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  type: GraphQLObjectType,
): boolean {
  const typeConditionNode = fragment.typeCondition;
  if (!typeConditionNode) {
    return true;
  }
  const conditionalType = typeFromAST(exeContext.schema, typeConditionNode);
  if (conditionalType === type) {
    return true;
  }
  if (isAbstractType(conditionalType)) {
    return exeContext.schema.isSubType(conditionalType, type);
  }
  return false;
}

/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node: FieldNode): string {
  return node.alias ? node.alias.value : node.name.value;
}

/**
 * Resolves the field on the given source object. In particular, this
 * figures out the value that the field returns by calling its resolve function,
 * then calls completeValue to complete promises, serialize scalars, or execute
 * the sub-selection-set for objects.
 */
function resolveField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: mixed,
  fieldNodes: $ReadOnlyArray<FieldNode>,
  path: Path,
  errors: Array<GraphQLError>,
): PromiseOrValue<mixed> {
  const fieldNode = fieldNodes[0];
  const fieldName = fieldNode.name.value;

  const fieldDef = getFieldDef(exeContext.schema, parentType, fieldName);
  if (!fieldDef) {
    return;
  }

  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve ?? exeContext.fieldResolver;

  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldNodes,
    parentType,
    path,
  );

  // Get the resolve function, regardless of if its result is normal or abrupt (error).
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = getArgumentValues(
      fieldDef,
      fieldNodes[0],
      exeContext.variableValues,
    );

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;

    const result = resolveFn(source, args, contextValue, info);

    let completed;
    if (isPromise(result)) {
      completed = result.then((resolved) =>
        completeValue(
          exeContext,
          returnType,
          fieldNodes,
          info,
          path,
          resolved,
          errors,
        ),
      );
    } else {
      completed = completeValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
        errors,
      );
    }

    if (isPromise(completed)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(undefined, (rawError) => {
        const error = locatedError(rawError, fieldNodes, pathToArray(path));
        return handleFieldError(error, returnType, errors);
      });
    }
    return completed;
  } catch (rawError) {
    const error = locatedError(rawError, fieldNodes, pathToArray(path));
    return handleFieldError(error, returnType, errors);
  }
}

/**
 * @internal
 */
export function buildResolveInfo(
  exeContext: ExecutionContext,
  fieldDef: GraphQLField<mixed, mixed>,
  fieldNodes: $ReadOnlyArray<FieldNode>,
  parentType: GraphQLObjectType,
  path: Path,
): GraphQLResolveInfo {
  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  return {
    fieldName: fieldDef.name,
    fieldNodes,
    returnType: fieldDef.type,
    parentType,
    path,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
  };
}

function handleFieldError(
  error: GraphQLError,
  returnType: GraphQLOutputType,
  errors: Array<GraphQLError>,
) {
  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (isNonNullType(returnType)) {
    throw error;
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  errors.push(error);
  return null;
}

/**
 * Implements the instructions for completeValue as defined in the
 * "Field entries" section of the spec.
 *
 * If the field type is Non-Null, then this recursively completes the value
 * for the inner type. It throws a field error if that completion returns null,
 * as per the "Nullability" section of the spec.
 *
 * If the field type is a List, then this recursively completes the value
 * for the inner type on each item in the list.
 *
 * If the field type is a Scalar or Enum, ensures the completed value is a legal
 * value of the type by calling the `serialize` method of GraphQL type
 * definition.
 *
 * If the field is an abstract type, determine the runtime type of the value
 * and then complete based on that type
 *
 * Otherwise, the field type expects a sub-selection set, and will complete the
 * value by evaluating all sub-selections.
 */
function completeValue(
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldNodes: $ReadOnlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: mixed,
  errors: Array<GraphQLError>,
): PromiseOrValue<mixed> {
  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw result;
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (isNonNullType(returnType)) {
    const completed = completeValue(
      exeContext,
      returnType.ofType,
      fieldNodes,
      info,
      path,
      result,
      errors,
    );
    if (completed === null) {
      throw new Error(
        `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`,
      );
    }
    return completed;
  }

  // If result value is null or undefined then return null.
  if (result == null) {
    return null;
  }

  // If field type is List, complete each item in the list with the inner type
  if (isListType(returnType)) {
    return completeListValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
      errors,
    );
  }

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if (isLeafType(returnType)) {
    return completeLeafValue(returnType, result);
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (isAbstractType(returnType)) {
    return completeAbstractValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
      errors,
    );
  }

  // If field type is Object, execute and complete all sub-selections.
  // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
  if (isObjectType(returnType)) {
    return completeObjectValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result,
      errors,
    );
  }

  // istanbul ignore next (Not reachable. All possible output types have been considered)
  invariant(
    false,
    'Cannot complete value of unexpected output type: ' +
      inspect((returnType: empty)),
  );
}

/**
 * Complete a async iterator value by completing the result and calling
 * recursively until all the results are completed.
 */
function completeAsyncIteratorValue(
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldNodes: $ReadOnlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  iterator: AsyncIterator<mixed>,
  errors: Array<GraphQLError>,
): Promise<$ReadOnlyArray<mixed>> {
  let containsPromise = false;
  const stream = getStreamValues(exeContext, fieldNodes);
  return new Promise((resolve) => {
    function next(index, completedResults) {
      const fieldPath = addPath(path, index, undefined);
      iterator.next().then(
        ({ value, done }) => {
          if (done) {
            resolve(completedResults);
            return;
          }
          // TODO can the error checking logic be consolidated with completeListValue?
          try {
            const completedItem = completeValue(
              exeContext,
              itemType,
              fieldNodes,
              info,
              fieldPath,
              value,
              errors,
            );
            if (isPromise(completedItem)) {
              containsPromise = true;
            }
            completedResults.push(completedItem);
          } catch (rawError) {
            completedResults.push(null);
            const error = locatedError(
              rawError,
              fieldNodes,
              pathToArray(fieldPath),
            );
            handleFieldError(error, itemType, errors);
            resolve(completedResults);
            return;
          }

          const newIndex = index + 1;
          if (
            stream &&
            typeof stream.initialCount === 'number' &&
            newIndex >= stream.initialCount
          ) {
            exeContext.dispatcher.addAsyncIteratorValue(
              stream.label,
              newIndex,
              path,
              iterator,
              exeContext,
              fieldNodes,
              info,
              itemType,
            );
            resolve(completedResults);
            return;
          }
          next(newIndex, completedResults);
        },
        (rawError) => {
          completedResults.push(null);
          const error = locatedError(
            rawError,
            fieldNodes,
            pathToArray(fieldPath),
          );
          handleFieldError(error, itemType, errors);
          resolve(completedResults);
        },
      );
    }
    next(0, []);
  }).then((completedResults) =>
    containsPromise ? Promise.all(completedResults) : completedResults,
  );
}

/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  exeContext: ExecutionContext,
  returnType: GraphQLList<GraphQLOutputType>,
  fieldNodes: $ReadOnlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: mixed,
  errors: Array<GraphQLError>,
): PromiseOrValue<$ReadOnlyArray<mixed>> {
  const itemType = returnType.ofType;

  if (isAsyncIterable(result)) {
    const iterator = result[SYMBOL_ASYNC_ITERATOR]();

    return completeAsyncIteratorValue(
      exeContext,
      itemType,
      fieldNodes,
      info,
      path,
      iterator,
      errors,
    );
  }

  if (!isCollection(result)) {
    throw new GraphQLError(
      `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
    );
  }

  const stream = getStreamValues(exeContext, fieldNodes);

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  let containsPromise = false;
  const completedResults = arrayFrom(result, (item, index) => {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = addPath(path, index, undefined);
    try {
      let completedItem;

      if (
        stream &&
        typeof stream.initialCount === 'number' &&
        index >= stream.initialCount
      ) {
        exeContext.dispatcher.addValue(
          stream.label,
          itemPath,
          item,
          exeContext,
          fieldNodes,
          info,
          itemType,
        );
        return;
      }
      if (isPromise(item)) {
        completedItem = item.then((resolved) =>
          completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            itemPath,
            resolved,
            errors,
          ),
        );
      } else {
        completedItem = completeValue(
          exeContext,
          itemType,
          fieldNodes,
          info,
          itemPath,
          item,
          errors,
        );
      }

      if (isPromise(completedItem)) {
        containsPromise = true;
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        return completedItem.then(undefined, (rawError) => {
          const error = locatedError(
            rawError,
            fieldNodes,
            pathToArray(itemPath),
          );
          return handleFieldError(error, itemType, errors);
        });
      }
      return completedItem;
    } catch (rawError) {
      const error = locatedError(rawError, fieldNodes, pathToArray(itemPath));
      return handleFieldError(error, itemType, errors);
    }
  }).filter((val) => val !== undefined);

  return containsPromise ? Promise.all(completedResults) : completedResults;
}

/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(returnType: GraphQLLeafType, result: mixed): mixed {
  const serializedResult = returnType.serialize(result);
  if (serializedResult === undefined) {
    throw new Error(
      `Expected a value of type "${inspect(returnType)}" but ` +
        `received: ${inspect(result)}`,
    );
  }
  return serializedResult;
}

/**
 * Complete a value of an abstract type by determining the runtime object type
 * of that value, then complete the value for that type.
 */
function completeAbstractValue(
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldNodes: $ReadOnlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: mixed,
  errors: Array<GraphQLError>,
): PromiseOrValue<ObjMap<mixed>> {
  const resolveTypeFn = returnType.resolveType ?? exeContext.typeResolver;
  const contextValue = exeContext.contextValue;
  const runtimeType = resolveTypeFn(result, contextValue, info, returnType);

  if (isPromise(runtimeType)) {
    return runtimeType.then((resolvedRuntimeType) =>
      completeObjectValue(
        exeContext,
        ensureValidRuntimeType(
          resolvedRuntimeType,
          exeContext,
          returnType,
          fieldNodes,
          info,
          result,
        ),
        fieldNodes,
        info,
        path,
        result,
        errors,
      ),
    );
  }

  return completeObjectValue(
    exeContext,
    ensureValidRuntimeType(
      runtimeType,
      exeContext,
      returnType,
      fieldNodes,
      info,
      result,
    ),
    fieldNodes,
    info,
    path,
    result,
    errors,
  );
}

function ensureValidRuntimeType(
  runtimeTypeOrName: mixed,
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldNodes: $ReadOnlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  result: mixed,
): GraphQLObjectType {
  if (runtimeTypeOrName == null) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
      fieldNodes,
    );
  }

  // FIXME: temporary workaround until support for passing object types would be removed in v16.0.0
  const runtimeTypeName = isNamedType(runtimeTypeOrName)
    ? runtimeTypeOrName.name
    : runtimeTypeOrName;

  if (typeof runtimeTypeName !== 'string') {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}" with ` +
        `value ${inspect(result)}, received "${inspect(runtimeTypeOrName)}".`,
    );
  }

  const runtimeType = exeContext.schema.getType(runtimeTypeName);
  if (runtimeType == null) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" was resolve to a type "${runtimeTypeName}" that does not exist inside schema.`,
      fieldNodes,
    );
  }

  if (!isObjectType(runtimeType)) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" was resolve to a non-object type "${runtimeTypeName}".`,
      fieldNodes,
    );
  }

  if (!exeContext.schema.isSubType(returnType, runtimeType)) {
    throw new GraphQLError(
      `Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`,
      fieldNodes,
    );
  }

  return runtimeType;
}

/**
 * Complete an Object value by executing all sub-selections.
 */
function completeObjectValue(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldNodes: $ReadOnlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: mixed,
  errors: Array<GraphQLError>,
): PromiseOrValue<ObjMap<mixed>> {
  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf) {
    const isTypeOf = returnType.isTypeOf(result, exeContext.contextValue, info);

    if (isPromise(isTypeOf)) {
      return isTypeOf.then((resolvedIsTypeOf) => {
        if (!resolvedIsTypeOf) {
          throw invalidReturnTypeError(returnType, result, fieldNodes);
        }
        return collectAndExecuteSubfields(
          exeContext,
          returnType,
          fieldNodes,
          path,
          result,
          errors,
        );
      });
    }

    if (!isTypeOf) {
      throw invalidReturnTypeError(returnType, result, fieldNodes);
    }
  }

  return collectAndExecuteSubfields(
    exeContext,
    returnType,
    fieldNodes,
    path,
    result,
    errors,
  );
}

function invalidReturnTypeError(
  returnType: GraphQLObjectType,
  result: mixed,
  fieldNodes: $ReadOnlyArray<FieldNode>,
): GraphQLError {
  return new GraphQLError(
    `Expected value of type "${returnType.name}" but got: ${inspect(result)}.`,
    fieldNodes,
  );
}

function collectAndExecuteSubfields(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldNodes: $ReadOnlyArray<FieldNode>,
  path: Path,
  result: mixed,
  errors: Array<GraphQLError>,
): PromiseOrValue<ObjMap<mixed>> {
  // Collect sub-fields to execute to complete this value.
  const { fields: subFieldNodes, patches: subPatches } = collectSubfields(
    exeContext,
    returnType,
    fieldNodes,
  );

  const subFields = executeFields(
    exeContext,
    returnType,
    result,
    path,
    subFieldNodes,
    errors,
  );

  for (const subPatch of subPatches) {
    const { label, fields: subPatchFieldNodes } = subPatch;
    const subPatchErrors = [];
    exeContext.dispatcher.addFields(
      label,
      path,
      executeFields(
        exeContext,
        returnType,
        result,
        path,
        subPatchFieldNodes,
        subPatchErrors,
      ),
      subPatchErrors,
    );
  }

  return subFields;
}

/**
 * A memoized collection of relevant subfields with regard to the return
 * type. Memoizing ensures the subfields are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 */
const collectSubfields = memoize3(_collectSubfields);
function _collectSubfields(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldNodes: $ReadOnlyArray<FieldNode>,
): FieldsAndPatches {
  const subFieldNodes = Object.create(null);
  const visitedFragmentNames = Object.create(null);
  const subPatches = [];
  let subFieldsAndPatches = {
    fields: subFieldNodes,
    patches: subPatches,
  };

  for (const node of fieldNodes) {
    if (node.selectionSet) {
      subFieldsAndPatches = collectFields(
        exeContext,
        returnType,
        node.selectionSet,
        subFieldNodes,
        subPatches,
        visitedFragmentNames,
      );
    }
  }
  return subFieldsAndPatches;
}

/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which attempts two strategies:
 *
 * First, See if the provided value has a `__typename` field defined, if so, use
 * that value as name of the resolved type.
 *
 * Otherwise, test each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */
export const defaultTypeResolver: GraphQLTypeResolver<mixed, mixed> = function (
  value,
  contextValue,
  info,
  abstractType,
) {
  // First, look for `__typename`.
  if (isObjectLike(value) && typeof value.__typename === 'string') {
    return value.__typename;
  }

  // Otherwise, test each possible type.
  const possibleTypes = info.schema.getPossibleTypes(abstractType);
  const promisedIsTypeOfResults = [];

  for (let i = 0; i < possibleTypes.length; i++) {
    const type = possibleTypes[i];

    if (type.isTypeOf) {
      const isTypeOfResult = type.isTypeOf(value, contextValue, info);

      if (isPromise(isTypeOfResult)) {
        promisedIsTypeOfResults[i] = isTypeOfResult;
      } else if (isTypeOfResult) {
        return type.name;
      }
    }
  }

  if (promisedIsTypeOfResults.length) {
    return Promise.all(promisedIsTypeOfResults).then((isTypeOfResults) => {
      for (let i = 0; i < isTypeOfResults.length; i++) {
        if (isTypeOfResults[i]) {
          return possibleTypes[i].name;
        }
      }
    });
  }
};

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */
export const defaultFieldResolver: GraphQLFieldResolver<
  mixed,
  mixed,
> = function (source: any, args, contextValue, info) {
  // ensure source is a value for which property access is acceptable.
  if (isObjectLike(source) || typeof source === 'function') {
    const property = source[info.fieldName];
    if (typeof property === 'function') {
      return source[info.fieldName](args, contextValue, info);
    }
    return property;
  }
};

/**
 * This method looks up the field on the given type definition.
 * It has special casing for the three introspection fields,
 * __schema, __type and __typename. __typename is special because
 * it can always be queried as a field, even in situations where no
 * other fields are allowed, like on a Union. __schema and __type
 * could get automatically added to the query type, but that would
 * require mutating type definitions, which would cause issues.
 *
 * @internal
 */
export function getFieldDef(
  schema: GraphQLSchema,
  parentType: GraphQLObjectType,
  fieldName: string,
): ?GraphQLField<mixed, mixed> {
  if (
    fieldName === SchemaMetaFieldDef.name &&
    schema.getQueryType() === parentType
  ) {
    return SchemaMetaFieldDef;
  } else if (
    fieldName === TypeMetaFieldDef.name &&
    schema.getQueryType() === parentType
  ) {
    return TypeMetaFieldDef;
  } else if (fieldName === TypeNameMetaFieldDef.name) {
    return TypeNameMetaFieldDef;
  }
  return parentType.getFields()[fieldName];
}

/**
 * Same as ExecutionPatchResult, but without hasNext
 */
type DispatcherResult = {|
  errors?: $ReadOnlyArray<GraphQLError>,
  data?: ObjMap<mixed> | mixed | null,
  path: $ReadOnlyArray<string | number>,
  label?: string,
  extensions?: ObjMap<mixed>,
|};

/**
 * Dispatcher keeps track of subsequent payloads that need to be delivered
 * to the client. After initial execution, returns an async iteratable of
 * all the AsyncExecutionResults as they are resolved.
 */
export class Dispatcher {
  _subsequentPayloads: Array<Promise<IteratorResult<DispatcherResult, void>>>;
  _initialResult: ?ExecutionResult;
  _hasReturnedInitialResult: boolean;

  constructor() {
    this._subsequentPayloads = [];
    this._hasReturnedInitialResult = false;
  }

  hasSubsequentPayloads() {
    return this._subsequentPayloads.length !== 0;
  }

  addFields(
    label?: string,
    path?: Path,
    promiseOrData: PromiseOrValue<ObjMap<mixed> | mixed>,
    errors: Array<GraphQLError>,
  ): void {
    this._subsequentPayloads.push(
      Promise.resolve(promiseOrData).then((data) => ({
        value: createPatchResult(data, label, path, errors),
        done: false,
      })),
    );
  }

  addValue(
    label?: string,
    path: Path,
    promiseOrData: PromiseOrValue<ObjMap<mixed> | mixed>,
    exeContext: ExecutionContext,
    fieldNodes: $ReadOnlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
  ): void {
    const errors = [];
    this._subsequentPayloads.push(
      Promise.resolve(promiseOrData)
        .then((resolved) =>
          completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            path,
            resolved,
            errors,
          ),
        )
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        .then(undefined, (rawError) => {
          const error = locatedError(rawError, fieldNodes, pathToArray(path));
          return handleFieldError(error, itemType, errors);
        })
        .then((data) => ({
          value: createPatchResult(data, label, path, errors),
          done: false,
        })),
    );
  }

  addAsyncIteratorValue(
    label?: string,
    initialIndex: number,
    path?: Path,
    iterator: AsyncIterator<mixed>,
    exeContext: ExecutionContext,
    fieldNodes: $ReadOnlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
  ): void {
    const subsequentPayloads = this._subsequentPayloads;
    function next(index) {
      const fieldPath = addPath(path, index);
      const patchErrors = [];
      subsequentPayloads.push(
        iterator.next().then(
          ({ value: data, done }) => {
            if (done) {
              return { value: undefined, done: true };
            }

            // eslint-disable-next-line node/callback-return
            next(index + 1);

            try {
              const completedItem = completeValue(
                exeContext,
                itemType,
                fieldNodes,
                info,
                fieldPath,
                data,
                patchErrors,
              );

              if (isPromise(completedItem)) {
                return completedItem.then((resolveItem) => ({
                  value: createPatchResult(
                    resolveItem,
                    label,
                    fieldPath,
                    patchErrors,
                  ),
                  done: false,
                }));
              }

              return {
                value: createPatchResult(
                  completedItem,
                  label,
                  fieldPath,
                  patchErrors,
                ),
                done: false,
              };
            } catch (rawError) {
              const error = locatedError(
                rawError,
                fieldNodes,
                pathToArray(fieldPath),
              );
              handleFieldError(error, itemType, patchErrors);
              return {
                value: createPatchResult(null, label, fieldPath, patchErrors),
                done: false,
              };
            }
          },
          (rawError) => {
            const error = locatedError(
              rawError,
              fieldNodes,
              pathToArray(fieldPath),
            );
            handleFieldError(error, itemType, patchErrors);
            return {
              value: createPatchResult(null, label, fieldPath, patchErrors),
              done: false,
            };
          },
        ),
      );
    }
    next(initialIndex);
  }

  _race(): Promise<IteratorResult<ExecutionPatchResult, void>> {
    return new Promise((resolve) => {
      this._subsequentPayloads.forEach((promise) => {
        promise.then(() => {
          // resolve with actual promise, not resolved value of promise so we can remove it from this._subsequentPayloads
          resolve({ promise });
        });
      });
    })
      .then(({ promise }) => {
        this._subsequentPayloads.splice(
          this._subsequentPayloads.indexOf(promise),
          1,
        );
        return promise;
      })
      .then(({ value, done }) => {
        if (done && this._subsequentPayloads.length === 0) {
          // async iterable resolver just finished and no more pending payloads
          return {
            value: {
              hasNext: false,
            },
            done: false,
          };
        } else if (done) {
          // async iterable resolver just finished but there are pending payloads
          // return the next one
          return this._race();
        }
        const returnValue: ExecutionPatchResult = {
          ...value,
          hasNext: this._subsequentPayloads.length > 0,
        };
        return {
          value: returnValue,
          done: false,
        };
      });
  }

  _next(): Promise<IteratorResult<AsyncExecutionResult, void>> {
    if (!this._hasReturnedInitialResult) {
      this._hasReturnedInitialResult = true;
      return Promise.resolve({
        value: {
          ...this._initialResult,
          hasNext: true,
        },
        done: false,
      });
    } else if (this._subsequentPayloads.length === 0) {
      return Promise.resolve({ value: undefined, done: true });
    }
    return this._race();
  }

  get(initialResult: ExecutionResult): AsyncIterable<AsyncExecutionResult> {
    this._initialResult = initialResult;
    return ({
      [SYMBOL_ASYNC_ITERATOR]() {
        return this;
      },
      next: () => this._next(),
    }: any);
  }
}

function createPatchResult(
  data: ObjMap<mixed> | mixed | null,
  label?: string,
  path?: Path,
  errors?: $ReadOnlyArray<GraphQLError>,
): DispatcherResult {
  const value: DispatcherResult = {
    data,
    path: path ? pathToArray(path) : [],
  };

  if (label != null) {
    value.label = label;
  }

  if (errors && errors.length > 0) {
    value.errors = errors;
  }

  return value;
}
