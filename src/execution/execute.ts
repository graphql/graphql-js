import { devAssert } from '../jsutils/devAssert';
import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';
import { isIterableObject } from '../jsutils/isIterableObject';
import { isObjectLike } from '../jsutils/isObjectLike';
import { isPromise } from '../jsutils/isPromise';
import type { Maybe } from '../jsutils/Maybe';
import { memoize3 } from '../jsutils/memoize3';
import type { ObjMap } from '../jsutils/ObjMap';
import type { Path } from '../jsutils/Path';
import { addPath, pathToArray } from '../jsutils/Path';
import { promiseForObject } from '../jsutils/promiseForObject';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { promiseReduce } from '../jsutils/promiseReduce';

import type { GraphQLFormattedError } from '../error/GraphQLError';
import { GraphQLError } from '../error/GraphQLError';
import { locatedError } from '../error/locatedError';

import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast';
import { OperationTypeNode } from '../language/ast';
import { Kind } from '../language/kinds';

import type {
  GraphQLAbstractType,
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLLeafType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
} from '../type/definition';
import {
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
  isSemanticNullableType,
} from '../type/definition';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from '../type/introspection';
import type { GraphQLSchema } from '../type/schema';
import { assertValidSchema } from '../type/validate';

import {
  collectFields,
  collectSubfields as _collectSubfields,
} from './collectFields';
import { getArgumentValues, getVariableValues } from './values';

/**
 * A memoized collection of relevant subfields with regard to the return
 * type. Memoizing ensures the subfields are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 */
const collectSubfields = memoize3(
  (
    exeContext: ExecutionContext,
    returnType: GraphQLObjectType,
    fieldNodes: ReadonlyArray<FieldNode>,
  ) =>
    _collectSubfields(
      exeContext.schema,
      exeContext.fragments,
      exeContext.variableValues,
      returnType,
      fieldNodes,
    ),
);

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
 * 1) field references e.g `a`
 * 2) fragment "spreads" e.g. `...c`
 * 3) inline fragment "spreads" e.g. `...on Type { a }`
 */

/**
 * Data that must be available at all points during query execution.
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
 */
export interface ExecutionContext {
  schema: GraphQLSchema;
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  contextValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: { [variable: string]: unknown };
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;
  errors: Array<GraphQLError>;
  errorPropagation: boolean;
}

/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 *   - `extensions` is reserved for adding non-standard properties.
 */
export interface ExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export interface FormattedExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export interface ExecutionArgs {
  schema: GraphQLSchema;
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  /**
   * Set to `false` to disable error propagation. Experimental.
   *
   * @experimental
   */
  errorPropagation?: boolean;
}

/**
 * Implements the "Executing requests" section of the GraphQL specification.
 *
 * Returns either a synchronous ExecutionResult (if all encountered resolvers
 * are synchronous), or a Promise of an ExecutionResult that will eventually be
 * resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export function execute(args: ExecutionArgs): PromiseOrValue<ExecutionResult> {
  // Temporary for v15 to v16 migration. Remove in v17
  devAssert(
    arguments.length < 2,
    'graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead.',
  );

  const { schema, document, variableValues, rootValue } = args;

  // If arguments are missing or incorrect, throw an error.
  assertValidExecutionArguments(schema, document, variableValues);

  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);

  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }

  // Return a Promise that will eventually resolve to the data described by
  // The "Response" section of the GraphQL specification.
  //
  // If errors are encountered while executing a GraphQL field, only that
  // field and its descendants will be omitted, and sibling fields will still
  // be executed. An execution which encounters errors will still result in a
  // resolved Promise.
  //
  // Errors from sub-fields of a NonNull type may propagate to the top level,
  // at which point we still log the error and null the parent field, which
  // in this case is the entire response.
  try {
    const { operation } = exeContext;
    const result = executeOperation(exeContext, operation, rootValue);
    if (isPromise(result)) {
      return result.then(
        (data) => buildResponse(data, exeContext.errors),
        (error) => {
          exeContext.errors.push(error);
          return buildResponse(null, exeContext.errors);
        },
      );
    }
    return buildResponse(result, exeContext.errors);
  } catch (error) {
    exeContext.errors.push(error);
    return buildResponse(null, exeContext.errors);
  }
}

/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
export function executeSync(args: ExecutionArgs): ExecutionResult {
  const result = execute(args);

  // Assert that the execution was synchronous.
  if (isPromise(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}

/**
 * Given a completed execution context and data, build the `{ errors, data }`
 * response defined by the "Response" section of the GraphQL specification.
 */
function buildResponse(
  data: ObjMap<unknown> | null,
  errors: ReadonlyArray<GraphQLError>,
): ExecutionResult {
  return errors.length === 0 ? { data } : { errors, data };
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
  rawVariableValues: Maybe<{ readonly [variable: string]: unknown }>,
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
  args: ExecutionArgs,
): ReadonlyArray<GraphQLError> | ExecutionContext {
  const {
    schema,
    document,
    rootValue,
    contextValue,
    variableValues: rawVariableValues,
    operationName,
    fieldResolver,
    typeResolver,
    subscribeFieldResolver,
    errorPropagation,
  } = args;

  let operation: OperationDefinitionNode | undefined;
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
      default:
      // ignore non-executable definitions
    }
  }

  if (!operation) {
    if (operationName != null) {
      return [new GraphQLError(`Unknown operation named "${operationName}".`)];
    }
    return [new GraphQLError('Must provide an operation.')];
  }

  // FIXME: https://github.com/graphql/graphql-js/issues/2203
  /* c8 ignore next */
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
    subscribeFieldResolver: subscribeFieldResolver ?? defaultFieldResolver,
    errors: [],
    errorPropagation: errorPropagation ?? true,
  };
}

/**
 * Implements the "Executing operations" section of the spec.
 */
function executeOperation(
  exeContext: ExecutionContext,
  operation: OperationDefinitionNode,
  rootValue: unknown,
): PromiseOrValue<ObjMap<unknown> | null> {
  const rootType = exeContext.schema.getRootType(operation.operation);
  if (rootType == null) {
    throw new GraphQLError(
      `Schema is not configured to execute ${operation.operation} operation.`,
      { nodes: operation },
    );
  }

  const rootFields = collectFields(
    exeContext.schema,
    exeContext.fragments,
    exeContext.variableValues,
    rootType,
    operation.selectionSet,
  );
  const path = undefined;

  switch (operation.operation) {
    case OperationTypeNode.QUERY:
      return executeFields(exeContext, rootType, rootValue, path, rootFields);
    case OperationTypeNode.MUTATION:
      return executeFieldsSerially(
        exeContext,
        rootType,
        rootValue,
        path,
        rootFields,
      );
    case OperationTypeNode.SUBSCRIPTION:
      // TODO: deprecate `subscribe` and move all logic here
      // Temporary solution until we finish merging execute and subscribe together
      return executeFields(exeContext, rootType, rootValue, path, rootFields);
  }
}

/**
 * Implements the "Executing selection sets" section of the spec
 * for fields that must be executed serially.
 */
function executeFieldsSerially(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  fields: Map<string, ReadonlyArray<FieldNode>>,
): PromiseOrValue<ObjMap<unknown>> {
  return promiseReduce(
    fields.entries(),
    (results, [responseName, fieldNodes]) => {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath,
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
 * Implements the "Executing selection sets" section of the spec
 * for fields that may be executed in parallel.
 */
function executeFields(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  fields: Map<string, ReadonlyArray<FieldNode>>,
): PromiseOrValue<ObjMap<unknown>> {
  const results = Object.create(null);
  let containsPromise = false;

  try {
    for (const [responseName, fieldNodes] of fields.entries()) {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath,
      );

      if (result !== undefined) {
        results[responseName] = result;
        if (isPromise(result)) {
          containsPromise = true;
        }
      }
    }
  } catch (error) {
    if (containsPromise) {
      // Ensure that any promises returned by other fields are handled, as they may also reject.
      return promiseForObject(results).finally(() => {
        throw error;
      });
    }
    throw error;
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
 * Implements the "Executing fields" section of the spec
 * In particular, this function figures out the value that the field returns by
 * calling its resolve function, then calls completeValue to complete promises,
 * serialize scalars, or execute the sub-selection-set for objects.
 */
function executeField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: unknown,
  fieldNodes: ReadonlyArray<FieldNode>,
  path: Path,
): PromiseOrValue<unknown> {
  const fieldDef = getFieldDef(exeContext.schema, parentType, fieldNodes[0]);
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
        completeValue(exeContext, returnType, fieldNodes, info, path, resolved),
      );
    } else {
      completed = completeValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
      );
    }

    if (isPromise(completed)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(undefined, (rawError) => {
        const error = locatedError(rawError, fieldNodes, pathToArray(path));
        return handleFieldError(error, returnType, exeContext);
      });
    }
    return completed;
  } catch (rawError) {
    const error = locatedError(rawError, fieldNodes, pathToArray(path));
    return handleFieldError(error, returnType, exeContext);
  }
}

/**
 * @internal
 */
export function buildResolveInfo(
  exeContext: ExecutionContext,
  fieldDef: GraphQLField<unknown, unknown>,
  fieldNodes: ReadonlyArray<FieldNode>,
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
    errorPropagation: exeContext.errorPropagation,
  };
}

function handleFieldError(
  error: GraphQLError,
  returnType: GraphQLOutputType,
  exeContext: ExecutionContext,
): null {
  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (exeContext.errorPropagation && isNonNullType(returnType)) {
    throw error;
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  exeContext.errors.push(error);
  return null;
}

/**
 * Implements the instructions for completeValue as defined in the
 * "Value Completion" section of the spec.
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
 * value by executing all sub-selections.
 */
function completeValue(
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<unknown> {
  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw result;
  }

  let nonNull;
  let semanticNull;
  let nullableType;
  if (isNonNullType(returnType)) {
    nonNull = true;
    nullableType = returnType.ofType;
  } else if (isSemanticNullableType(returnType)) {
    semanticNull = true;
    nullableType = returnType.ofType;
  } else {
    nullableType = returnType;
  }

  let completed;
  if (result == null) {
    // If result value is null or undefined then return null.
    completed = null;
  } else if (isListType(nullableType)) {
    // If field type is List, complete each item in the list with the inner type
    completed = completeListValue(
      exeContext,
      nullableType,
      fieldNodes,
      info,
      path,
      result,
    );
  } else if (isLeafType(nullableType)) {
    // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
    // returning null if serialization is not possible.
    completed = completeLeafValue(nullableType, result);
  } else if (isAbstractType(nullableType)) {
    // If field type is an abstract type, Interface or Union, determine the
    // runtime Object type and complete for that type.
    completed = completeAbstractValue(
      exeContext,
      nullableType,
      fieldNodes,
      info,
      path,
      result,
    );
  } else if (isObjectType(nullableType)) {
    // If field type is Object, execute and complete all sub-selections.
    completed = completeObjectValue(
      exeContext,
      nullableType,
      fieldNodes,
      info,
      path,
      result,
    );
  } else {
    /* c8 ignore next 6 */
    // Not reachable, all possible output types have been considered.
    invariant(
      false,
      'Cannot complete value of unexpected output type: ' +
        inspect(nullableType),
    );
  }

  if (completed === null) {
    if (nonNull) {
      throw new Error(
        `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`,
      );
    }

    if (!semanticNull && exeContext.schema.usingSemanticNullability) {
      throw new Error(
        `Cannot return null for semantic-non-nullable field ${info.parentType.name}.${info.fieldName}.`,
      );
    }
  }

  return completed;
}

/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  exeContext: ExecutionContext,
  returnType: GraphQLList<GraphQLOutputType>,
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<ReadonlyArray<unknown>> {
  if (!isIterableObject(result)) {
    throw new GraphQLError(
      `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
    );
  }

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  const itemType = returnType.ofType;
  let containsPromise = false;
  const completedResults = Array.from(result, (item, index) => {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = addPath(path, index, undefined);
    try {
      let completedItem;
      if (isPromise(item)) {
        completedItem = item.then((resolved) =>
          completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            itemPath,
            resolved,
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
          return handleFieldError(error, itemType, exeContext);
        });
      }
      return completedItem;
    } catch (rawError) {
      const error = locatedError(rawError, fieldNodes, pathToArray(itemPath));
      return handleFieldError(error, itemType, exeContext);
    }
  });

  return containsPromise ? Promise.all(completedResults) : completedResults;
}

/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(
  returnType: GraphQLLeafType,
  result: unknown,
): unknown {
  const serializedResult = returnType.serialize(result);
  if (serializedResult == null) {
    throw new Error(
      `Expected \`${inspect(returnType)}.serialize(${inspect(result)})\` to ` +
        `return non-nullable value, returned: ${inspect(serializedResult)}`,
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
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<ObjMap<unknown>> {
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
  );
}

function ensureValidRuntimeType(
  runtimeTypeName: unknown,
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  result: unknown,
): GraphQLObjectType {
  if (runtimeTypeName == null) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
      fieldNodes,
    );
  }

  // releases before 16.0.0 supported returning `GraphQLObjectType` from `resolveType`
  // TODO: remove in 17.0.0 release
  if (isObjectType(runtimeTypeName)) {
    throw new GraphQLError(
      'Support for returning GraphQLObjectType from resolveType was removed in graphql-js@16.0.0 please return type name instead.',
    );
  }

  if (typeof runtimeTypeName !== 'string') {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}" with ` +
        `value ${inspect(result)}, received "${inspect(runtimeTypeName)}".`,
    );
  }

  const runtimeType = exeContext.schema.getType(runtimeTypeName);
  if (runtimeType == null) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
      { nodes: fieldNodes },
    );
  }

  if (!isObjectType(runtimeType)) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
      { nodes: fieldNodes },
    );
  }

  if (!exeContext.schema.isSubType(returnType, runtimeType)) {
    throw new GraphQLError(
      `Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`,
      { nodes: fieldNodes },
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
  fieldNodes: ReadonlyArray<FieldNode>,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
): PromiseOrValue<ObjMap<unknown>> {
  // Collect sub-fields to execute to complete this value.
  const subFieldNodes = collectSubfields(exeContext, returnType, fieldNodes);

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
        return executeFields(
          exeContext,
          returnType,
          result,
          path,
          subFieldNodes,
        );
      });
    }

    if (!isTypeOf) {
      throw invalidReturnTypeError(returnType, result, fieldNodes);
    }
  }

  return executeFields(exeContext, returnType, result, path, subFieldNodes);
}

function invalidReturnTypeError(
  returnType: GraphQLObjectType,
  result: unknown,
  fieldNodes: ReadonlyArray<FieldNode>,
): GraphQLError {
  return new GraphQLError(
    `Expected value of type "${returnType.name}" but got: ${inspect(result)}.`,
    { nodes: fieldNodes },
  );
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
export const defaultTypeResolver: GraphQLTypeResolver<unknown, unknown> =
  function (value, contextValue, info, abstractType) {
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
export const defaultFieldResolver: GraphQLFieldResolver<unknown, unknown> =
  function (source: any, args, contextValue, info) {
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
  fieldNode: FieldNode,
): Maybe<GraphQLField<unknown, unknown>> {
  const fieldName = fieldNode.name.value;

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
