'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.createSourceEventStream =
  exports.subscribe =
  exports.defaultFieldResolver =
  exports.defaultTypeResolver =
  exports.buildResolveInfo =
  exports.buildExecutionContext =
  exports.executeSync =
  exports.experimentalExecuteIncrementally =
  exports.execute =
    void 0;
const inspect_js_1 = require('../jsutils/inspect.js');
const invariant_js_1 = require('../jsutils/invariant.js');
const isAsyncIterable_js_1 = require('../jsutils/isAsyncIterable.js');
const isIterableObject_js_1 = require('../jsutils/isIterableObject.js');
const isObjectLike_js_1 = require('../jsutils/isObjectLike.js');
const isPromise_js_1 = require('../jsutils/isPromise.js');
const memoize3_js_1 = require('../jsutils/memoize3.js');
const Path_js_1 = require('../jsutils/Path.js');
const promiseForObject_js_1 = require('../jsutils/promiseForObject.js');
const promiseReduce_js_1 = require('../jsutils/promiseReduce.js');
const GraphQLError_js_1 = require('../error/GraphQLError.js');
const locatedError_js_1 = require('../error/locatedError.js');
const ast_js_1 = require('../language/ast.js');
const kinds_js_1 = require('../language/kinds.js');
const definition_js_1 = require('../type/definition.js');
const directives_js_1 = require('../type/directives.js');
const validate_js_1 = require('../type/validate.js');
const buildFieldPlan_js_1 = require('./buildFieldPlan.js');
const collectFields_js_1 = require('./collectFields.js');
const IncrementalPublisher_js_1 = require('./IncrementalPublisher.js');
const mapAsyncIterable_js_1 = require('./mapAsyncIterable.js');
const values_js_1 = require('./values.js');
/* eslint-disable max-params */
// This file contains a lot of such errors but we plan to refactor it anyway
// so just disable it for entire file.
/**
 * A memoized collection of relevant subfields with regard to the return
 * type. Memoizing ensures the subfields are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 */
const collectSubfields = (0, memoize3_js_1.memoize3)(
  (exeContext, returnType, fieldGroup) =>
    (0, collectFields_js_1.collectSubfields)(
      exeContext.schema,
      exeContext.fragments,
      exeContext.variableValues,
      exeContext.operation,
      returnType,
      fieldGroup,
    ),
);
const UNEXPECTED_EXPERIMENTAL_DIRECTIVES =
  'The provided schema unexpectedly contains experimental directives (@defer or @stream). These directives may only be utilized if experimental execution features are explicitly enabled.';
const UNEXPECTED_MULTIPLE_PAYLOADS =
  'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)';
/**
 * Implements the "Executing requests" section of the GraphQL specification.
 *
 * Returns either a synchronous ExecutionResult (if all encountered resolvers
 * are synchronous), or a Promise of an ExecutionResult that will eventually be
 * resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 *
 * This function does not support incremental delivery (`@defer` and `@stream`).
 * If an operation which would defer or stream data is executed with this
 * function, it will throw or return a rejected promise.
 * Use `experimentalExecuteIncrementally` if you want to support incremental
 * delivery.
 */
function execute(args) {
  if (args.schema.getDirective('defer') || args.schema.getDirective('stream')) {
    throw new Error(UNEXPECTED_EXPERIMENTAL_DIRECTIVES);
  }
  const result = experimentalExecuteIncrementally(args);
  if (!(0, isPromise_js_1.isPromise)(result)) {
    if ('initialResult' in result) {
      // This can happen if the operation contains @defer or @stream directives
      // and is not validated prior to execution
      throw new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
    }
    return result;
  }
  return result.then((incrementalResult) => {
    if ('initialResult' in incrementalResult) {
      // This can happen if the operation contains @defer or @stream directives
      // and is not validated prior to execution
      throw new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
    }
    return incrementalResult;
  });
}
exports.execute = execute;
/**
 * Implements the "Executing requests" section of the GraphQL specification,
 * including `@defer` and `@stream` as proposed in
 * https://github.com/graphql/graphql-spec/pull/742
 *
 * This function returns a Promise of an ExperimentalIncrementalExecutionResults
 * object. This object either consists of a single ExecutionResult, or an
 * object containing an `initialResult` and a stream of `subsequentResults`.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
function experimentalExecuteIncrementally(args) {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);
  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }
  return executeOperation(exeContext);
}
exports.experimentalExecuteIncrementally = experimentalExecuteIncrementally;
/**
 * Implements the "Executing operations" section of the spec.
 *
 * Returns a Promise that will eventually resolve to the data described by
 * The "Response" section of the GraphQL specification.
 *
 * If errors are encountered while executing a GraphQL field, only that
 * field and its descendants will be omitted, and sibling fields will still
 * be executed. An execution which encounters errors will still result in a
 * resolved Promise.
 *
 * Errors from sub-fields of a NonNull type may propagate to the top level,
 * at which point we still log the error and null the parent field, which
 * in this case is the entire response.
 */
function executeOperation(exeContext) {
  try {
    const { operation, schema, fragments, variableValues, rootValue } =
      exeContext;
    const rootType = schema.getRootType(operation.operation);
    if (rootType == null) {
      throw new GraphQLError_js_1.GraphQLError(
        `Schema is not configured to execute ${operation.operation} operation.`,
        { nodes: operation },
      );
    }
    const collectedFields = (0, collectFields_js_1.collectFields)(
      schema,
      fragments,
      variableValues,
      rootType,
      operation,
    );
    let groupedFieldSet = collectedFields.groupedFieldSet;
    const newDeferUsages = collectedFields.newDeferUsages;
    let graphqlWrappedResult;
    if (newDeferUsages.length === 0) {
      graphqlWrappedResult = executeRootGroupedFieldSet(
        exeContext,
        operation.operation,
        rootType,
        rootValue,
        groupedFieldSet,
        undefined,
      );
    } else {
      const fieldPLan = (0, buildFieldPlan_js_1.buildFieldPlan)(
        groupedFieldSet,
      );
      groupedFieldSet = fieldPLan.groupedFieldSet;
      const newGroupedFieldSets = fieldPLan.newGroupedFieldSets;
      const newDeferMap = addNewDeferredFragments(newDeferUsages, new Map());
      graphqlWrappedResult = executeRootGroupedFieldSet(
        exeContext,
        operation.operation,
        rootType,
        rootValue,
        groupedFieldSet,
        newDeferMap,
      );
      if (newGroupedFieldSets.size > 0) {
        const newDeferredGroupedFieldSetRecords =
          executeDeferredGroupedFieldSets(
            exeContext,
            rootType,
            rootValue,
            undefined,
            undefined,
            newGroupedFieldSets,
            newDeferMap,
          );
        graphqlWrappedResult = withNewDeferredGroupedFieldSets(
          graphqlWrappedResult,
          newDeferredGroupedFieldSetRecords,
        );
      }
    }
    if ((0, isPromise_js_1.isPromise)(graphqlWrappedResult)) {
      return graphqlWrappedResult.then(
        (resolved) => buildDataResponse(exeContext, resolved[0], resolved[1]),
        (error) => ({
          data: null,
          errors: withError(exeContext.errors, error),
        }),
      );
    }
    return buildDataResponse(
      exeContext,
      graphqlWrappedResult[0],
      graphqlWrappedResult[1],
    );
  } catch (error) {
    return { data: null, errors: withError(exeContext.errors, error) };
  }
}
function withNewDeferredGroupedFieldSets(
  result,
  newDeferredGroupedFieldSetRecords,
) {
  if ((0, isPromise_js_1.isPromise)(result)) {
    return result.then((resolved) => {
      addIncrementalDataRecords(resolved, newDeferredGroupedFieldSetRecords);
      return resolved;
    });
  }
  addIncrementalDataRecords(result, newDeferredGroupedFieldSetRecords);
  return result;
}
function addIncrementalDataRecords(
  graphqlWrappedResult,
  incrementalDataRecords,
) {
  if (incrementalDataRecords === undefined) {
    return;
  }
  if (graphqlWrappedResult[1] === undefined) {
    graphqlWrappedResult[1] = [...incrementalDataRecords];
  } else {
    graphqlWrappedResult[1].push(...incrementalDataRecords);
  }
}
function withError(errors, error) {
  return errors === undefined ? [error] : [...errors, error];
}
function buildDataResponse(exeContext, data, incrementalDataRecords) {
  const errors = exeContext.errors;
  if (incrementalDataRecords === undefined) {
    return errors !== undefined ? { errors, data } : { data };
  }
  return (0, IncrementalPublisher_js_1.buildIncrementalResponse)(
    exeContext,
    data,
    errors,
    incrementalDataRecords,
  );
}
/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
function executeSync(args) {
  const result = experimentalExecuteIncrementally(args);
  // Assert that the execution was synchronous.
  if ((0, isPromise_js_1.isPromise)(result) || 'initialResult' in result) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }
  return result;
}
exports.executeSync = executeSync;
/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 *
 * TODO: consider no longer exporting this function
 * @internal
 */
function buildExecutionContext(args) {
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
  } = args;
  // If the schema used for execution is invalid, throw an error.
  (0, validate_js_1.assertValidSchema)(schema);
  let operation;
  const fragments = Object.create(null);
  for (const definition of document.definitions) {
    switch (definition.kind) {
      case kinds_js_1.Kind.OPERATION_DEFINITION:
        if (operationName == null) {
          if (operation !== undefined) {
            return [
              new GraphQLError_js_1.GraphQLError(
                'Must provide operation name if query contains multiple operations.',
              ),
            ];
          }
          operation = definition;
        } else if (definition.name?.value === operationName) {
          operation = definition;
        }
        break;
      case kinds_js_1.Kind.FRAGMENT_DEFINITION:
        fragments[definition.name.value] = definition;
        break;
      default:
      // ignore non-executable definitions
    }
  }
  if (!operation) {
    if (operationName != null) {
      return [
        new GraphQLError_js_1.GraphQLError(
          `Unknown operation named "${operationName}".`,
        ),
      ];
    }
    return [new GraphQLError_js_1.GraphQLError('Must provide an operation.')];
  }
  // FIXME: https://github.com/graphql/graphql-js/issues/2203
  /* c8 ignore next */
  const variableDefinitions = operation.variableDefinitions ?? [];
  const coercedVariableValues = (0, values_js_1.getVariableValues)(
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
    fieldResolver: fieldResolver ?? exports.defaultFieldResolver,
    typeResolver: typeResolver ?? exports.defaultTypeResolver,
    subscribeFieldResolver:
      subscribeFieldResolver ?? exports.defaultFieldResolver,
    errors: undefined,
    cancellableStreams: undefined,
  };
}
exports.buildExecutionContext = buildExecutionContext;
function buildPerEventExecutionContext(exeContext, payload) {
  return {
    ...exeContext,
    rootValue: payload,
    errors: undefined,
  };
}
function executeRootGroupedFieldSet(
  exeContext,
  operation,
  rootType,
  rootValue,
  groupedFieldSet,
  deferMap,
) {
  switch (operation) {
    case ast_js_1.OperationTypeNode.QUERY:
      return executeFields(
        exeContext,
        rootType,
        rootValue,
        undefined,
        groupedFieldSet,
        undefined,
        deferMap,
      );
    case ast_js_1.OperationTypeNode.MUTATION:
      return executeFieldsSerially(
        exeContext,
        rootType,
        rootValue,
        undefined,
        groupedFieldSet,
        undefined,
        deferMap,
      );
    case ast_js_1.OperationTypeNode.SUBSCRIPTION:
      // TODO: deprecate `subscribe` and move all logic here
      // Temporary solution until we finish merging execute and subscribe together
      return executeFields(
        exeContext,
        rootType,
        rootValue,
        undefined,
        groupedFieldSet,
        undefined,
        deferMap,
      );
  }
}
/**
 * Implements the "Executing selection sets" section of the spec
 * for fields that must be executed serially.
 */
function executeFieldsSerially(
  exeContext,
  parentType,
  sourceValue,
  path,
  groupedFieldSet,
  incrementalContext,
  deferMap,
) {
  return (0, promiseReduce_js_1.promiseReduce)(
    groupedFieldSet,
    (graphqlWrappedResult, [responseName, fieldGroup]) => {
      const fieldPath = (0, Path_js_1.addPath)(
        path,
        responseName,
        parentType.name,
      );
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldGroup,
        fieldPath,
        incrementalContext,
        deferMap,
      );
      if (result === undefined) {
        return graphqlWrappedResult;
      }
      if ((0, isPromise_js_1.isPromise)(result)) {
        return result.then((resolved) => {
          graphqlWrappedResult[0][responseName] = resolved[0];
          addIncrementalDataRecords(graphqlWrappedResult, resolved[1]);
          return graphqlWrappedResult;
        });
      }
      graphqlWrappedResult[0][responseName] = result[0];
      addIncrementalDataRecords(graphqlWrappedResult, result[1]);
      return graphqlWrappedResult;
    },
    [Object.create(null), undefined],
  );
}
/**
 * Implements the "Executing selection sets" section of the spec
 * for fields that may be executed in parallel.
 */
function executeFields(
  exeContext,
  parentType,
  sourceValue,
  path,
  groupedFieldSet,
  incrementalContext,
  deferMap,
) {
  const results = Object.create(null);
  const graphqlWrappedResult = [results, undefined];
  let containsPromise = false;
  try {
    for (const [responseName, fieldGroup] of groupedFieldSet) {
      const fieldPath = (0, Path_js_1.addPath)(
        path,
        responseName,
        parentType.name,
      );
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldGroup,
        fieldPath,
        incrementalContext,
        deferMap,
      );
      if (result !== undefined) {
        if ((0, isPromise_js_1.isPromise)(result)) {
          results[responseName] = result.then((resolved) => {
            addIncrementalDataRecords(graphqlWrappedResult, resolved[1]);
            return resolved[0];
          });
          containsPromise = true;
        } else {
          results[responseName] = result[0];
          addIncrementalDataRecords(graphqlWrappedResult, result[1]);
        }
      }
    }
  } catch (error) {
    if (containsPromise) {
      // Ensure that any promises returned by other fields are handled, as they may also reject.
      return (0, promiseForObject_js_1.promiseForObject)(results, () => {
        /* noop */
      }).finally(() => {
        throw error;
      });
    }
    throw error;
  }
  // If there are no promises, we can just return the object and any incrementalDataRecords
  if (!containsPromise) {
    return graphqlWrappedResult;
  }
  // Otherwise, results is a map from field name to the result of resolving that
  // field, which is possibly a promise. Return a promise that will return this
  // same map, but with any promises replaced with the values they resolved to.
  return (0, promiseForObject_js_1.promiseForObject)(results, (resolved) => [
    resolved,
    graphqlWrappedResult[1],
  ]);
}
function toNodes(fieldGroup) {
  return fieldGroup.map((fieldDetails) => fieldDetails.node);
}
/**
 * Implements the "Executing fields" section of the spec
 * In particular, this function figures out the value that the field returns by
 * calling its resolve function, then calls completeValue to complete promises,
 * serialize scalars, or execute the sub-selection-set for objects.
 */
function executeField(
  exeContext,
  parentType,
  source,
  fieldGroup,
  path,
  incrementalContext,
  deferMap,
) {
  const fieldName = fieldGroup[0].node.name.value;
  const fieldDef = exeContext.schema.getField(parentType, fieldName);
  if (!fieldDef) {
    return;
  }
  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve ?? exeContext.fieldResolver;
  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    toNodes(fieldGroup),
    parentType,
    path,
  );
  // Get the resolve function, regardless of if its result is normal or abrupt (error).
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = (0, values_js_1.getArgumentValues)(
      fieldDef,
      fieldGroup[0].node,
      exeContext.variableValues,
    );
    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;
    const result = resolveFn(source, args, contextValue, info);
    if ((0, isPromise_js_1.isPromise)(result)) {
      return completePromisedValue(
        exeContext,
        returnType,
        fieldGroup,
        info,
        path,
        result,
        incrementalContext,
        deferMap,
      );
    }
    const completed = completeValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      incrementalContext,
      deferMap,
    );
    if ((0, isPromise_js_1.isPromise)(completed)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(undefined, (rawError) => {
        handleFieldError(
          rawError,
          exeContext,
          returnType,
          fieldGroup,
          path,
          incrementalContext,
        );
        return [null, undefined];
      });
    }
    return completed;
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      returnType,
      fieldGroup,
      path,
      incrementalContext,
    );
    return [null, undefined];
  }
}
/**
 * TODO: consider no longer exporting this function
 * @internal
 */
function buildResolveInfo(exeContext, fieldDef, fieldNodes, parentType, path) {
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
exports.buildResolveInfo = buildResolveInfo;
function handleFieldError(
  rawError,
  exeContext,
  returnType,
  fieldGroup,
  path,
  incrementalContext,
) {
  const error = (0, locatedError_js_1.locatedError)(
    rawError,
    toNodes(fieldGroup),
    (0, Path_js_1.pathToArray)(path),
  );
  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if ((0, definition_js_1.isNonNullType)(returnType)) {
    throw error;
  }
  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  const context = incrementalContext ?? exeContext;
  let errors = context.errors;
  if (errors === undefined) {
    errors = [];
    context.errors = errors;
  }
  errors.push(error);
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
  exeContext,
  returnType,
  fieldGroup,
  info,
  path,
  result,
  incrementalContext,
  deferMap,
) {
  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw result;
  }
  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if ((0, definition_js_1.isNonNullType)(returnType)) {
    const completed = completeValue(
      exeContext,
      returnType.ofType,
      fieldGroup,
      info,
      path,
      result,
      incrementalContext,
      deferMap,
    );
    if (completed[0] === null) {
      throw new Error(
        `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`,
      );
    }
    return completed;
  }
  // If result value is null or undefined then return null.
  if (result == null) {
    return [null, undefined];
  }
  // If field type is List, complete each item in the list with the inner type
  if ((0, definition_js_1.isListType)(returnType)) {
    return completeListValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      incrementalContext,
      deferMap,
    );
  }
  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if ((0, definition_js_1.isLeafType)(returnType)) {
    return [completeLeafValue(returnType, result), undefined];
  }
  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if ((0, definition_js_1.isAbstractType)(returnType)) {
    return completeAbstractValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      incrementalContext,
      deferMap,
    );
  }
  // If field type is Object, execute and complete all sub-selections.
  if ((0, definition_js_1.isObjectType)(returnType)) {
    return completeObjectValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      incrementalContext,
      deferMap,
    );
  }
  /* c8 ignore next 6 */
  // Not reachable, all possible output types have been considered.
  false ||
    (0, invariant_js_1.invariant)(
      false,
      'Cannot complete value of unexpected output type: ' +
        (0, inspect_js_1.inspect)(returnType),
    );
}
async function completePromisedValue(
  exeContext,
  returnType,
  fieldGroup,
  info,
  path,
  result,
  incrementalContext,
  deferMap,
) {
  try {
    const resolved = await result;
    let completed = completeValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      resolved,
      incrementalContext,
      deferMap,
    );
    if ((0, isPromise_js_1.isPromise)(completed)) {
      completed = await completed;
    }
    return completed;
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      returnType,
      fieldGroup,
      path,
      incrementalContext,
    );
    return [null, undefined];
  }
}
/**
 * Returns an object containing info for streaming if a field should be
 * streamed based on the experimental flag, stream directive present and
 * not disabled by the "if" argument.
 */
function getStreamUsage(exeContext, fieldGroup, path) {
  // do not stream inner lists of multi-dimensional lists
  if (typeof path.key === 'number') {
    return;
  }
  // TODO: add test for this case (a streamed list nested under a list).
  /* c8 ignore next 7 */
  if (fieldGroup._streamUsage !== undefined) {
    return fieldGroup._streamUsage;
  }
  // validation only allows equivalent streams on multiple fields, so it is
  // safe to only check the first fieldNode for the stream directive
  const stream = (0, values_js_1.getDirectiveValues)(
    directives_js_1.GraphQLStreamDirective,
    fieldGroup[0].node,
    exeContext.variableValues,
  );
  if (!stream) {
    return;
  }
  if (stream.if === false) {
    return;
  }
  typeof stream.initialCount === 'number' ||
    (0, invariant_js_1.invariant)(false, 'initialCount must be a number');
  stream.initialCount >= 0 ||
    (0, invariant_js_1.invariant)(
      false,
      'initialCount must be a positive integer',
    );
  exeContext.operation.operation !== ast_js_1.OperationTypeNode.SUBSCRIPTION ||
    (0, invariant_js_1.invariant)(
      false,
      '`@stream` directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
    );
  const streamedFieldGroup = fieldGroup.map((fieldDetails) => ({
    node: fieldDetails.node,
    deferUsage: undefined,
  }));
  const streamUsage = {
    initialCount: stream.initialCount,
    label: typeof stream.label === 'string' ? stream.label : undefined,
    fieldGroup: streamedFieldGroup,
  };
  fieldGroup._streamUsage = streamUsage;
  return streamUsage;
}
/**
 * Complete a async iterator value by completing the result and calling
 * recursively until all the results are completed.
 */
async function completeAsyncIteratorValue(
  exeContext,
  itemType,
  fieldGroup,
  info,
  path,
  asyncIterator,
  incrementalContext,
  deferMap,
) {
  let containsPromise = false;
  const completedResults = [];
  const graphqlWrappedResult = [completedResults, undefined];
  let index = 0;
  const streamUsage = getStreamUsage(exeContext, fieldGroup, path);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (streamUsage && index >= streamUsage.initialCount) {
      const returnFn = asyncIterator.return;
      let streamRecord;
      if (returnFn === undefined) {
        streamRecord = {
          label: streamUsage.label,
          path,
        };
      } else {
        streamRecord = {
          label: streamUsage.label,
          path,
          earlyReturn: returnFn.bind(asyncIterator),
        };
        if (exeContext.cancellableStreams === undefined) {
          exeContext.cancellableStreams = new Set();
        }
        exeContext.cancellableStreams.add(streamRecord);
      }
      const firstStreamItems = firstAsyncStreamItems(
        streamRecord,
        path,
        index,
        asyncIterator,
        exeContext,
        streamUsage.fieldGroup,
        info,
        itemType,
      );
      addIncrementalDataRecords(graphqlWrappedResult, [firstStreamItems]);
      break;
    }
    const itemPath = (0, Path_js_1.addPath)(path, index, undefined);
    let iteration;
    try {
      // eslint-disable-next-line no-await-in-loop
      iteration = await asyncIterator.next();
    } catch (rawError) {
      throw (0, locatedError_js_1.locatedError)(
        rawError,
        toNodes(fieldGroup),
        (0, Path_js_1.pathToArray)(path),
      );
    }
    // TODO: add test case for stream returning done before initialCount
    /* c8 ignore next 3 */
    if (iteration.done) {
      break;
    }
    const item = iteration.value;
    // TODO: add tests for stream backed by asyncIterator that returns a promise
    /* c8 ignore start */
    if ((0, isPromise_js_1.isPromise)(item)) {
      completedResults.push(
        completePromisedListItemValue(
          item,
          graphqlWrappedResult,
          exeContext,
          itemType,
          fieldGroup,
          info,
          itemPath,
          incrementalContext,
          deferMap,
        ),
      );
      containsPromise = true;
    } else if (
      /* c8 ignore stop */
      completeListItemValue(
        item,
        completedResults,
        graphqlWrappedResult,
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        incrementalContext,
        deferMap,
      )
      // TODO: add tests for stream backed by asyncIterator that completes to a promise
      /* c8 ignore start */
    ) {
      containsPromise = true;
    }
    /* c8 ignore stop */
    index++;
  }
  return containsPromise
    ? /* c8 ignore start */ Promise.all(completedResults).then((resolved) => [
        resolved,
        graphqlWrappedResult[1],
      ])
    : /* c8 ignore stop */ graphqlWrappedResult;
}
/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  exeContext,
  returnType,
  fieldGroup,
  info,
  path,
  result,
  incrementalContext,
  deferMap,
) {
  const itemType = returnType.ofType;
  if ((0, isAsyncIterable_js_1.isAsyncIterable)(result)) {
    const asyncIterator = result[Symbol.asyncIterator]();
    return completeAsyncIteratorValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      path,
      asyncIterator,
      incrementalContext,
      deferMap,
    );
  }
  if (!(0, isIterableObject_js_1.isIterableObject)(result)) {
    throw new GraphQLError_js_1.GraphQLError(
      `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
    );
  }
  return completeIterableValue(
    exeContext,
    itemType,
    fieldGroup,
    info,
    path,
    result,
    incrementalContext,
    deferMap,
  );
}
function completeIterableValue(
  exeContext,
  itemType,
  fieldGroup,
  info,
  path,
  items,
  incrementalContext,
  deferMap,
) {
  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  let containsPromise = false;
  const completedResults = [];
  const graphqlWrappedResult = [completedResults, undefined];
  let index = 0;
  const streamUsage = getStreamUsage(exeContext, fieldGroup, path);
  const iterator = items[Symbol.iterator]();
  let iteration = iterator.next();
  while (!iteration.done) {
    const item = iteration.value;
    if (streamUsage && index >= streamUsage.initialCount) {
      const streamRecord = {
        label: streamUsage.label,
        path,
      };
      const firstStreamItems = firstSyncStreamItems(
        streamRecord,
        item,
        index,
        iterator,
        exeContext,
        streamUsage.fieldGroup,
        info,
        itemType,
      );
      addIncrementalDataRecords(graphqlWrappedResult, [firstStreamItems]);
      break;
    }
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = (0, Path_js_1.addPath)(path, index, undefined);
    if ((0, isPromise_js_1.isPromise)(item)) {
      completedResults.push(
        completePromisedListItemValue(
          item,
          graphqlWrappedResult,
          exeContext,
          itemType,
          fieldGroup,
          info,
          itemPath,
          incrementalContext,
          deferMap,
        ),
      );
      containsPromise = true;
    } else if (
      completeListItemValue(
        item,
        completedResults,
        graphqlWrappedResult,
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        incrementalContext,
        deferMap,
      )
    ) {
      containsPromise = true;
    }
    index++;
    iteration = iterator.next();
  }
  return containsPromise
    ? Promise.all(completedResults).then((resolved) => [
        resolved,
        graphqlWrappedResult[1],
      ])
    : graphqlWrappedResult;
}
/**
 * Complete a list item value by adding it to the completed results.
 *
 * Returns true if the value is a Promise.
 */
function completeListItemValue(
  item,
  completedResults,
  parent,
  exeContext,
  itemType,
  fieldGroup,
  info,
  itemPath,
  incrementalContext,
  deferMap,
) {
  try {
    const completedItem = completeValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      incrementalContext,
      deferMap,
    );
    if ((0, isPromise_js_1.isPromise)(completedItem)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      completedResults.push(
        completedItem.then(
          (resolved) => {
            addIncrementalDataRecords(parent, resolved[1]);
            return resolved[0];
          },
          (rawError) => {
            handleFieldError(
              rawError,
              exeContext,
              itemType,
              fieldGroup,
              itemPath,
              incrementalContext,
            );
            return null;
          },
        ),
      );
      return true;
    }
    completedResults.push(completedItem[0]);
    addIncrementalDataRecords(parent, completedItem[1]);
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      itemType,
      fieldGroup,
      itemPath,
      incrementalContext,
    );
    completedResults.push(null);
  }
  return false;
}
async function completePromisedListItemValue(
  item,
  parent,
  exeContext,
  itemType,
  fieldGroup,
  info,
  itemPath,
  incrementalContext,
  deferMap,
) {
  try {
    const resolved = await item;
    let completed = completeValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      resolved,
      incrementalContext,
      deferMap,
    );
    if ((0, isPromise_js_1.isPromise)(completed)) {
      completed = await completed;
    }
    addIncrementalDataRecords(parent, completed[1]);
    return completed[0];
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      itemType,
      fieldGroup,
      itemPath,
      incrementalContext,
    );
    return null;
  }
}
/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(returnType, result) {
  const serializedResult = returnType.serialize(result);
  if (serializedResult == null) {
    throw new Error(
      `Expected \`${(0, inspect_js_1.inspect)(returnType)}.serialize(${(0,
      inspect_js_1.inspect)(result)})\` to ` +
        `return non-nullable value, returned: ${(0, inspect_js_1.inspect)(
          serializedResult,
        )}`,
    );
  }
  return serializedResult;
}
/**
 * Complete a value of an abstract type by determining the runtime object type
 * of that value, then complete the value for that type.
 */
function completeAbstractValue(
  exeContext,
  returnType,
  fieldGroup,
  info,
  path,
  result,
  incrementalContext,
  deferMap,
) {
  const resolveTypeFn = returnType.resolveType ?? exeContext.typeResolver;
  const contextValue = exeContext.contextValue;
  const runtimeType = resolveTypeFn(result, contextValue, info, returnType);
  if ((0, isPromise_js_1.isPromise)(runtimeType)) {
    return runtimeType.then((resolvedRuntimeType) =>
      completeObjectValue(
        exeContext,
        ensureValidRuntimeType(
          resolvedRuntimeType,
          exeContext,
          returnType,
          fieldGroup,
          info,
          result,
        ),
        fieldGroup,
        info,
        path,
        result,
        incrementalContext,
        deferMap,
      ),
    );
  }
  return completeObjectValue(
    exeContext,
    ensureValidRuntimeType(
      runtimeType,
      exeContext,
      returnType,
      fieldGroup,
      info,
      result,
    ),
    fieldGroup,
    info,
    path,
    result,
    incrementalContext,
    deferMap,
  );
}
function ensureValidRuntimeType(
  runtimeTypeName,
  exeContext,
  returnType,
  fieldGroup,
  info,
  result,
) {
  if (runtimeTypeName == null) {
    throw new GraphQLError_js_1.GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
      { nodes: toNodes(fieldGroup) },
    );
  }
  // releases before 16.0.0 supported returning `GraphQLObjectType` from `resolveType`
  // TODO: remove in 17.0.0 release
  if ((0, definition_js_1.isObjectType)(runtimeTypeName)) {
    throw new GraphQLError_js_1.GraphQLError(
      'Support for returning GraphQLObjectType from resolveType was removed in graphql-js@16.0.0 please return type name instead.',
    );
  }
  if (typeof runtimeTypeName !== 'string') {
    throw new GraphQLError_js_1.GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}" with ` +
        `value ${(0, inspect_js_1.inspect)(result)}, received "${(0,
        inspect_js_1.inspect)(runtimeTypeName)}".`,
    );
  }
  const runtimeType = exeContext.schema.getType(runtimeTypeName);
  if (runtimeType == null) {
    throw new GraphQLError_js_1.GraphQLError(
      `Abstract type "${returnType.name}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
      { nodes: toNodes(fieldGroup) },
    );
  }
  if (!(0, definition_js_1.isObjectType)(runtimeType)) {
    throw new GraphQLError_js_1.GraphQLError(
      `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
      { nodes: toNodes(fieldGroup) },
    );
  }
  if (!exeContext.schema.isSubType(returnType, runtimeType)) {
    throw new GraphQLError_js_1.GraphQLError(
      `Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`,
      { nodes: toNodes(fieldGroup) },
    );
  }
  return runtimeType;
}
/**
 * Complete an Object value by executing all sub-selections.
 */
function completeObjectValue(
  exeContext,
  returnType,
  fieldGroup,
  info,
  path,
  result,
  incrementalContext,
  deferMap,
) {
  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf) {
    const isTypeOf = returnType.isTypeOf(result, exeContext.contextValue, info);
    if ((0, isPromise_js_1.isPromise)(isTypeOf)) {
      return isTypeOf.then((resolvedIsTypeOf) => {
        if (!resolvedIsTypeOf) {
          throw invalidReturnTypeError(returnType, result, fieldGroup);
        }
        return collectAndExecuteSubfields(
          exeContext,
          returnType,
          fieldGroup,
          path,
          result,
          incrementalContext,
          deferMap,
        );
      });
    }
    if (!isTypeOf) {
      throw invalidReturnTypeError(returnType, result, fieldGroup);
    }
  }
  return collectAndExecuteSubfields(
    exeContext,
    returnType,
    fieldGroup,
    path,
    result,
    incrementalContext,
    deferMap,
  );
}
function invalidReturnTypeError(returnType, result, fieldGroup) {
  return new GraphQLError_js_1.GraphQLError(
    `Expected value of type "${returnType.name}" but got: ${(0,
    inspect_js_1.inspect)(result)}.`,
    { nodes: toNodes(fieldGroup) },
  );
}
/**
 * Instantiates new DeferredFragmentRecords for the given path within an
 * incremental data record, returning an updated map of DeferUsage
 * objects to DeferredFragmentRecords.
 *
 * Note: As defer directives may be used with operations returning lists,
 * a DeferUsage object may correspond to many DeferredFragmentRecords.
 *
 * DeferredFragmentRecord creation includes the following steps:
 * 1. The new DeferredFragmentRecord is instantiated at the given path.
 * 2. The parent result record is calculated from the given incremental data
 * record.
 * 3. The IncrementalPublisher is notified that a new DeferredFragmentRecord
 * with the calculated parent has been added; the record will be released only
 * after the parent has completed.
 *
 */
function addNewDeferredFragments(newDeferUsages, newDeferMap, path) {
  // For each new deferUsage object:
  for (const newDeferUsage of newDeferUsages) {
    const parentDeferUsage = newDeferUsage.parentDeferUsage;
    const parent =
      parentDeferUsage === undefined
        ? undefined
        : deferredFragmentRecordFromDeferUsage(parentDeferUsage, newDeferMap);
    // Instantiate the new record.
    const deferredFragmentRecord =
      new IncrementalPublisher_js_1.DeferredFragmentRecord({
        path,
        label: newDeferUsage.label,
        parent,
      });
    // Update the map.
    newDeferMap.set(newDeferUsage, deferredFragmentRecord);
  }
  return newDeferMap;
}
function deferredFragmentRecordFromDeferUsage(deferUsage, deferMap) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return deferMap.get(deferUsage);
}
function collectAndExecuteSubfields(
  exeContext,
  returnType,
  fieldGroup,
  path,
  result,
  incrementalContext,
  deferMap,
) {
  // Collect sub-fields to execute to complete this value.
  const collectedSubfields = collectSubfields(
    exeContext,
    returnType,
    fieldGroup,
  );
  let groupedFieldSet = collectedSubfields.groupedFieldSet;
  const newDeferUsages = collectedSubfields.newDeferUsages;
  if (deferMap === undefined && newDeferUsages.length === 0) {
    return executeFields(
      exeContext,
      returnType,
      result,
      path,
      groupedFieldSet,
      incrementalContext,
      undefined,
    );
  }
  const subFieldPlan = buildSubFieldPlan(
    groupedFieldSet,
    incrementalContext?.deferUsageSet,
  );
  groupedFieldSet = subFieldPlan.groupedFieldSet;
  const newGroupedFieldSets = subFieldPlan.newGroupedFieldSets;
  const newDeferMap = addNewDeferredFragments(
    newDeferUsages,
    new Map(deferMap),
    path,
  );
  const subFields = executeFields(
    exeContext,
    returnType,
    result,
    path,
    groupedFieldSet,
    incrementalContext,
    newDeferMap,
  );
  if (newGroupedFieldSets.size > 0) {
    const newDeferredGroupedFieldSetRecords = executeDeferredGroupedFieldSets(
      exeContext,
      returnType,
      result,
      path,
      incrementalContext?.deferUsageSet,
      newGroupedFieldSets,
      newDeferMap,
    );
    return withNewDeferredGroupedFieldSets(
      subFields,
      newDeferredGroupedFieldSetRecords,
    );
  }
  return subFields;
}
function buildSubFieldPlan(originalGroupedFieldSet, deferUsageSet) {
  let fieldPlan = originalGroupedFieldSet._fieldPlan;
  if (fieldPlan !== undefined) {
    return fieldPlan;
  }
  fieldPlan = (0, buildFieldPlan_js_1.buildFieldPlan)(
    originalGroupedFieldSet,
    deferUsageSet,
  );
  originalGroupedFieldSet._fieldPlan = fieldPlan;
  return fieldPlan;
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
const defaultTypeResolver = function (value, contextValue, info, abstractType) {
  // First, look for `__typename`.
  if (
    (0, isObjectLike_js_1.isObjectLike)(value) &&
    typeof value.__typename === 'string'
  ) {
    return value.__typename;
  }
  // Otherwise, test each possible type.
  const possibleTypes = info.schema.getPossibleTypes(abstractType);
  const promisedIsTypeOfResults = [];
  for (let i = 0; i < possibleTypes.length; i++) {
    const type = possibleTypes[i];
    if (type.isTypeOf) {
      const isTypeOfResult = type.isTypeOf(value, contextValue, info);
      if ((0, isPromise_js_1.isPromise)(isTypeOfResult)) {
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
exports.defaultTypeResolver = defaultTypeResolver;
/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */
const defaultFieldResolver = function (source, args, contextValue, info) {
  // ensure source is a value for which property access is acceptable.
  if (
    (0, isObjectLike_js_1.isObjectLike)(source) ||
    typeof source === 'function'
  ) {
    const property = source[info.fieldName];
    if (typeof property === 'function') {
      return source[info.fieldName](args, contextValue, info);
    }
    return property;
  }
};
exports.defaultFieldResolver = defaultFieldResolver;
/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns a Promise which resolves to either an AsyncIterator (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with descriptive
 * errors and no data will be returned.
 *
 * If the source stream could not be created due to faulty subscription resolver
 * logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to an AsyncIterator, which
 * yields a stream of ExecutionResults representing the response stream.
 *
 * This function does not support incremental delivery (`@defer` and `@stream`).
 * If an operation which would defer or stream data is executed with this
 * function, a field error will be raised at the location of the `@defer` or
 * `@stream` directive.
 *
 * Accepts an object with named arguments.
 */
function subscribe(args) {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);
  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }
  const resultOrStream = createSourceEventStreamImpl(exeContext);
  if ((0, isPromise_js_1.isPromise)(resultOrStream)) {
    return resultOrStream.then((resolvedResultOrStream) =>
      mapSourceToResponse(exeContext, resolvedResultOrStream),
    );
  }
  return mapSourceToResponse(exeContext, resultOrStream);
}
exports.subscribe = subscribe;
function mapSourceToResponse(exeContext, resultOrStream) {
  if (!(0, isAsyncIterable_js_1.isAsyncIterable)(resultOrStream)) {
    return resultOrStream;
  }
  // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  // This implements the "MapSourceToResponseEvent" algorithm described in
  // the GraphQL specification. The `execute` function provides the
  // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
  // "ExecuteQuery" algorithm, for which `execute` is also used.
  return (0, mapAsyncIterable_js_1.mapAsyncIterable)(
    resultOrStream,
    (payload) =>
      executeOperation(buildPerEventExecutionContext(exeContext, payload)),
  );
}
/**
 * Implements the "CreateSourceEventStream" algorithm described in the
 * GraphQL specification, resolving the subscription source event stream.
 *
 * Returns a Promise which resolves to either an AsyncIterable (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with
 * descriptive errors and no data will be returned.
 *
 * If the the source stream could not be created due to faulty subscription
 * resolver logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to the AsyncIterable for the
 * event stream returned by the resolver.
 *
 * A Source Event Stream represents a sequence of events, each of which triggers
 * a GraphQL execution for that event.
 *
 * This may be useful when hosting the stateful subscription service in a
 * different process or machine than the stateless GraphQL execution engine,
 * or otherwise separating these two steps. For more on this, see the
 * "Supporting Subscriptions at Scale" information in the GraphQL specification.
 */
function createSourceEventStream(args) {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);
  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }
  return createSourceEventStreamImpl(exeContext);
}
exports.createSourceEventStream = createSourceEventStream;
function createSourceEventStreamImpl(exeContext) {
  try {
    const eventStream = executeSubscription(exeContext);
    if ((0, isPromise_js_1.isPromise)(eventStream)) {
      return eventStream.then(undefined, (error) => ({ errors: [error] }));
    }
    return eventStream;
  } catch (error) {
    return { errors: [error] };
  }
}
function executeSubscription(exeContext) {
  const { schema, fragments, operation, variableValues, rootValue } =
    exeContext;
  const rootType = schema.getSubscriptionType();
  if (rootType == null) {
    throw new GraphQLError_js_1.GraphQLError(
      'Schema is not configured to execute subscription operation.',
      { nodes: operation },
    );
  }
  const { groupedFieldSet } = (0, collectFields_js_1.collectFields)(
    schema,
    fragments,
    variableValues,
    rootType,
    operation,
  );
  const firstRootField = groupedFieldSet.entries().next().value;
  const [responseName, fieldGroup] = firstRootField;
  const fieldName = fieldGroup[0].node.name.value;
  const fieldDef = schema.getField(rootType, fieldName);
  const fieldNodes = fieldGroup.map((fieldDetails) => fieldDetails.node);
  if (!fieldDef) {
    throw new GraphQLError_js_1.GraphQLError(
      `The subscription field "${fieldName}" is not defined.`,
      { nodes: fieldNodes },
    );
  }
  const path = (0, Path_js_1.addPath)(undefined, responseName, rootType.name);
  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldNodes,
    rootType,
    path,
  );
  try {
    // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
    // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    const args = (0, values_js_1.getArgumentValues)(
      fieldDef,
      fieldNodes[0],
      variableValues,
    );
    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;
    // Call the `subscribe()` resolver or the default resolver to produce an
    // AsyncIterable yielding raw payloads.
    const resolveFn = fieldDef.subscribe ?? exeContext.subscribeFieldResolver;
    const result = resolveFn(rootValue, args, contextValue, info);
    if ((0, isPromise_js_1.isPromise)(result)) {
      return result.then(assertEventStream).then(undefined, (error) => {
        throw (0, locatedError_js_1.locatedError)(
          error,
          fieldNodes,
          (0, Path_js_1.pathToArray)(path),
        );
      });
    }
    return assertEventStream(result);
  } catch (error) {
    throw (0, locatedError_js_1.locatedError)(
      error,
      fieldNodes,
      (0, Path_js_1.pathToArray)(path),
    );
  }
}
function assertEventStream(result) {
  if (result instanceof Error) {
    throw result;
  }
  // Assert field returned an event stream, otherwise yield an error.
  if (!(0, isAsyncIterable_js_1.isAsyncIterable)(result)) {
    throw new GraphQLError_js_1.GraphQLError(
      'Subscription field must return Async Iterable. ' +
        `Received: ${(0, inspect_js_1.inspect)(result)}.`,
    );
  }
  return result;
}
function executeDeferredGroupedFieldSets(
  exeContext,
  parentType,
  sourceValue,
  path,
  parentDeferUsages,
  newGroupedFieldSets,
  deferMap,
) {
  const newDeferredGroupedFieldSetRecords = [];
  for (const [deferUsageSet, groupedFieldSet] of newGroupedFieldSets) {
    const deferredFragmentRecords = getDeferredFragmentRecords(
      deferUsageSet,
      deferMap,
    );
    const executor = () =>
      executeDeferredGroupedFieldSet(
        deferredFragmentRecords,
        exeContext,
        parentType,
        sourceValue,
        path,
        groupedFieldSet,
        {
          errors: undefined,
          deferUsageSet,
        },
        deferMap,
      );
    const deferredGroupedFieldSetRecord = {
      deferredFragmentRecords,
      result: shouldDefer(parentDeferUsages, deferUsageSet)
        ? Promise.resolve().then(executor)
        : executor(),
    };
    newDeferredGroupedFieldSetRecords.push(deferredGroupedFieldSetRecord);
  }
  return newDeferredGroupedFieldSetRecords;
}
function shouldDefer(parentDeferUsages, deferUsages) {
  // If we have a new child defer usage, defer.
  // Otherwise, this defer usage was already deferred when it was initially
  // encountered, and is now in the midst of executing early, so the new
  // deferred grouped fields set can be executed immediately.
  return (
    parentDeferUsages === undefined ||
    !Array.from(deferUsages).every((deferUsage) =>
      parentDeferUsages.has(deferUsage),
    )
  );
}
function executeDeferredGroupedFieldSet(
  deferredFragmentRecords,
  exeContext,
  parentType,
  sourceValue,
  path,
  groupedFieldSet,
  incrementalContext,
  deferMap,
) {
  let result;
  try {
    result = executeFields(
      exeContext,
      parentType,
      sourceValue,
      path,
      groupedFieldSet,
      incrementalContext,
      deferMap,
    );
  } catch (error) {
    return {
      deferredFragmentRecords,
      path: (0, Path_js_1.pathToArray)(path),
      errors: withError(incrementalContext.errors, error),
    };
  }
  if ((0, isPromise_js_1.isPromise)(result)) {
    return result.then(
      (resolved) =>
        buildDeferredGroupedFieldSetResult(
          incrementalContext.errors,
          deferredFragmentRecords,
          path,
          resolved,
        ),
      (error) => ({
        deferredFragmentRecords,
        path: (0, Path_js_1.pathToArray)(path),
        errors: withError(incrementalContext.errors, error),
      }),
    );
  }
  return buildDeferredGroupedFieldSetResult(
    incrementalContext.errors,
    deferredFragmentRecords,
    path,
    result,
  );
}
function buildDeferredGroupedFieldSetResult(
  errors,
  deferredFragmentRecords,
  path,
  result,
) {
  return {
    deferredFragmentRecords,
    path: (0, Path_js_1.pathToArray)(path),
    result:
      errors === undefined ? { data: result[0] } : { data: result[0], errors },
    incrementalDataRecords: result[1],
  };
}
function getDeferredFragmentRecords(deferUsages, deferMap) {
  return Array.from(deferUsages).map((deferUsage) =>
    deferredFragmentRecordFromDeferUsage(deferUsage, deferMap),
  );
}
function firstSyncStreamItems(
  streamRecord,
  initialItem,
  initialIndex,
  iterator,
  exeContext,
  fieldGroup,
  info,
  itemType,
) {
  return {
    streamRecord,
    result: Promise.resolve().then(() => {
      const path = streamRecord.path;
      const initialPath = (0, Path_js_1.addPath)(path, initialIndex, undefined);
      let result = completeStreamItems(
        streamRecord,
        initialPath,
        initialItem,
        exeContext,
        { errors: undefined },
        fieldGroup,
        info,
        itemType,
      );
      const firstStreamItems = { result };
      let currentStreamItems = firstStreamItems;
      let currentIndex = initialIndex;
      let iteration = iterator.next();
      let erroredSynchronously = false;
      while (!iteration.done) {
        if (
          !(0, isPromise_js_1.isPromise)(result) &&
          !(0, IncrementalPublisher_js_1.isReconcilableStreamItemsResult)(
            result,
          )
        ) {
          erroredSynchronously = true;
          break;
        }
        const item = iteration.value;
        currentIndex++;
        const currentPath = (0, Path_js_1.addPath)(
          path,
          currentIndex,
          undefined,
        );
        result = completeStreamItems(
          streamRecord,
          currentPath,
          item,
          exeContext,
          { errors: undefined },
          fieldGroup,
          info,
          itemType,
        );
        const nextStreamItems = { streamRecord, result };
        currentStreamItems.result = prependNextStreamItems(
          currentStreamItems.result,
          nextStreamItems,
        );
        currentStreamItems = nextStreamItems;
        iteration = iterator.next();
      }
      // If a non-reconcilable stream items result was encountered, then the stream terminates in error.
      // Otherwise, add a stream terminator.
      if (!erroredSynchronously) {
        currentStreamItems.result = prependNextStreamItems(
          currentStreamItems.result,
          { streamRecord, result: { streamRecord } },
        );
      }
      return firstStreamItems.result;
    }),
  };
}
function prependNextStreamItems(result, nextStreamItems) {
  if ((0, isPromise_js_1.isPromise)(result)) {
    return result.then((resolved) =>
      prependNextResolvedStreamItems(resolved, nextStreamItems),
    );
  }
  return prependNextResolvedStreamItems(result, nextStreamItems);
}
function prependNextResolvedStreamItems(result, nextStreamItems) {
  if (!(0, IncrementalPublisher_js_1.isReconcilableStreamItemsResult)(result)) {
    return result;
  }
  const incrementalDataRecords = result.incrementalDataRecords;
  return {
    ...result,
    incrementalDataRecords:
      incrementalDataRecords === undefined
        ? [nextStreamItems]
        : [nextStreamItems, ...incrementalDataRecords],
  };
}
function firstAsyncStreamItems(
  streamRecord,
  path,
  initialIndex,
  asyncIterator,
  exeContext,
  fieldGroup,
  info,
  itemType,
) {
  const firstStreamItems = {
    streamRecord,
    result: getNextAsyncStreamItemsResult(
      streamRecord,
      path,
      initialIndex,
      asyncIterator,
      exeContext,
      fieldGroup,
      info,
      itemType,
    ),
  };
  return firstStreamItems;
}
async function getNextAsyncStreamItemsResult(
  streamRecord,
  path,
  index,
  asyncIterator,
  exeContext,
  fieldGroup,
  info,
  itemType,
) {
  let iteration;
  try {
    iteration = await asyncIterator.next();
  } catch (error) {
    return {
      streamRecord,
      errors: [
        (0, locatedError_js_1.locatedError)(
          error,
          toNodes(fieldGroup),
          (0, Path_js_1.pathToArray)(path),
        ),
      ],
    };
  }
  if (iteration.done) {
    return { streamRecord };
  }
  const itemPath = (0, Path_js_1.addPath)(path, index, undefined);
  const result = completeStreamItems(
    streamRecord,
    itemPath,
    iteration.value,
    exeContext,
    { errors: undefined },
    fieldGroup,
    info,
    itemType,
  );
  const nextStreamItems = {
    streamRecord,
    result: getNextAsyncStreamItemsResult(
      streamRecord,
      path,
      index,
      asyncIterator,
      exeContext,
      fieldGroup,
      info,
      itemType,
    ),
  };
  return prependNextStreamItems(result, nextStreamItems);
}
function completeStreamItems(
  streamRecord,
  itemPath,
  item,
  exeContext,
  incrementalContext,
  fieldGroup,
  info,
  itemType,
) {
  if ((0, isPromise_js_1.isPromise)(item)) {
    return completePromisedValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      incrementalContext,
      new Map(),
    ).then(
      (resolvedItem) =>
        buildStreamItemsResult(
          incrementalContext.errors,
          streamRecord,
          resolvedItem,
        ),
      (error) => ({
        streamRecord,
        errors: withError(incrementalContext.errors, error),
      }),
    );
  }
  let result;
  try {
    try {
      result = completeValue(
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        item,
        incrementalContext,
        new Map(),
      );
    } catch (rawError) {
      handleFieldError(
        rawError,
        exeContext,
        itemType,
        fieldGroup,
        itemPath,
        incrementalContext,
      );
      result = [null, undefined];
    }
  } catch (error) {
    return {
      streamRecord,
      errors: withError(incrementalContext.errors, error),
    };
  }
  if ((0, isPromise_js_1.isPromise)(result)) {
    return result
      .then(undefined, (rawError) => {
        handleFieldError(
          rawError,
          exeContext,
          itemType,
          fieldGroup,
          itemPath,
          incrementalContext,
        );
        return [null, undefined];
      })
      .then(
        (resolvedItem) =>
          buildStreamItemsResult(
            incrementalContext.errors,
            streamRecord,
            resolvedItem,
          ),
        (error) => ({
          streamRecord,
          errors: withError(incrementalContext.errors, error),
        }),
      );
  }
  return buildStreamItemsResult(
    incrementalContext.errors,
    streamRecord,
    result,
  );
}
function buildStreamItemsResult(errors, streamRecord, result) {
  return {
    streamRecord,
    result:
      errors === undefined
        ? { items: [result[0]] }
        : {
            items: [result[0]],
            errors: [...errors],
          },
    incrementalDataRecords: result[1],
  };
}
