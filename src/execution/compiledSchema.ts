import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';
import { isAsyncIterable } from '../jsutils/isAsyncIterable';
import { isIterableObject } from '../jsutils/isIterableObject';
import { isPromise } from '../jsutils/isPromise';
import { memoize3 } from '../jsutils/memoize3';
import type { ObjMap } from '../jsutils/ObjMap';
import type { Path } from '../jsutils/Path';
import { addPath, pathToArray } from '../jsutils/Path';
import { promiseForObject } from '../jsutils/promiseForObject';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { promiseReduce } from '../jsutils/promiseReduce';

import { GraphQLError } from '../error/GraphQLError';
import { locatedError } from '../error/locatedError';

import type { FieldNode } from '../language/ast';
import { OperationTypeNode } from '../language/ast';

import type {
  GraphQLAbstractType,
  GraphQLField,
  GraphQLLeafType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
} from '../type/definition';
import {
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../type/definition';

import {
  collectFields,
  collectSubfields as _collectSubfields,
} from './collectFields';
import type { ExecutionContext } from './compiledDocument';
import { buildPerEventExecutionContext } from './compiledDocument';
import type { ExecutionResult } from './execute';
import { mapAsyncIterator } from './mapAsyncIterator';
import { getArgumentValues } from './values';

/* eslint-disable max-params */
// This file contains a lot of such errors but we plan to refactor it anyway
// so just disable it for entire file.

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

type FieldsExecutor = (
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  fields: Map<string, ReadonlyArray<FieldNode>>,
) => PromiseOrValue<ObjMap<unknown>>;

/**
 * @internal
 */
export class GraphQLCompiledSchema {
  get [Symbol.toStringTag]() {
    return 'GraphQLCompiledSchema';
  }

  /**
   * Implements the "Executing operations" section of the spec.
   */
  public static executeOperation(
    compiledSchema: GraphQLCompiledSchema,
    exeContext: ExecutionContext,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<ExecutionResult, void, void>
  > {
    const operationType = exeContext.operation.operation;

    if (operationType === OperationTypeNode.QUERY) {
      return compiledSchema.executeQuery(exeContext);
    }

    if (operationType === OperationTypeNode.MUTATION) {
      return compiledSchema.executeMutation(exeContext);
    }

    return compiledSchema.executeSubscription(exeContext);
  }

  public static createSourceEventStream(
    compiledSchema: GraphQLCompiledSchema,
    exeContext: ExecutionContext,
  ): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
    return compiledSchema.createSourceEventStreamImpl(exeContext);
  }

  public static executeSubscriptionEvent(
    compiledSchema: GraphQLCompiledSchema,
    exeContext: ExecutionContext,
  ): PromiseOrValue<ExecutionResult> {
    return compiledSchema.executeQuery(exeContext);
  }

  executeQuery(exeContext: ExecutionContext): PromiseOrValue<ExecutionResult> {
    return this.executeQueryOrMutation(
      exeContext,
      this.executeFields.bind(this),
    );
  }

  executeMutation(
    exeContext: ExecutionContext,
  ): PromiseOrValue<ExecutionResult> {
    return this.executeQueryOrMutation(
      exeContext,
      this.executeFieldsSerially.bind(this),
    );
  }

  executeQueryOrMutation(
    exeContext: ExecutionContext,
    fieldsExecutor: FieldsExecutor,
  ): PromiseOrValue<ExecutionResult> {
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
      const result = this.executeQueryOrMutationRootFields(
        exeContext,
        fieldsExecutor,
      );
      if (isPromise(result)) {
        return result.then(
          (data) => this.buildResponse(data, exeContext.errors),
          (error) => {
            exeContext.errors.push(error);
            return this.buildResponse(null, exeContext.errors);
          },
        );
      }
      return this.buildResponse(result, exeContext.errors);
    } catch (error) {
      exeContext.errors.push(error);
      return this.buildResponse(null, exeContext.errors);
    }
  }

  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   */
  buildResponse(
    data: ObjMap<unknown> | null,
    errors: ReadonlyArray<GraphQLError>,
  ): ExecutionResult {
    return errors.length === 0 ? { data } : { errors, data };
  }

  executeQueryOrMutationRootFields(
    exeContext: ExecutionContext,
    fieldsExecutor: FieldsExecutor,
  ): PromiseOrValue<ObjMap<unknown>> {
    const { operation, schema, fragments, variableValues, rootValue } =
      exeContext;
    const rootType = schema.getRootType(operation.operation);
    if (rootType == null) {
      throw new GraphQLError(
        `Schema is not configured to execute ${operation.operation} operation.`,
        { nodes: operation },
      );
    }

    const rootFields = collectFields(
      schema,
      fragments,
      variableValues,
      rootType,
      operation.selectionSet,
    );
    const path = undefined;

    return fieldsExecutor(exeContext, rootType, rootValue, path, rootFields);
  }

  /**
   * Implements the "Executing selection sets" section of the spec
   * for fields that must be executed serially.
   */
  executeFieldsSerially(
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
        const result = this.executeField(
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
  executeFields(
    exeContext: ExecutionContext,
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    fields: Map<string, ReadonlyArray<FieldNode>>,
  ): PromiseOrValue<ObjMap<unknown>> {
    const results = Object.create(null);
    let containsPromise = false;

    for (const [responseName, fieldNodes] of fields.entries()) {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = this.executeField(
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
   * In particular, this figures out the value that the field returns by
   * calling its resolve function, then calls completeValue to complete promises,
   * serialize scalars, or execute the sub-selection-set for objects.
   */
  executeField(
    exeContext: ExecutionContext,
    parentType: GraphQLObjectType,
    source: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
    path: Path,
  ): PromiseOrValue<unknown> {
    const fieldName = fieldNodes[0].name.value;
    const fieldDef = exeContext.schema.getField(parentType, fieldName);
    if (!fieldDef) {
      return;
    }

    const returnType = fieldDef.type;
    const resolveFn = fieldDef.resolve ?? exeContext.fieldResolver;

    const info = this.buildResolveInfo(
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
      // is provided to every resolve within an execution. It is commonly
      // used to represent an authenticated user, or request-specific caches.
      const contextValue = exeContext.contextValue;

      const result = resolveFn(source, args, contextValue, info);

      let completed;
      if (isPromise(result)) {
        completed = result.then((resolved) =>
          this.completeValue(
            exeContext,
            returnType,
            fieldNodes,
            info,
            path,
            resolved,
          ),
        );
      } else {
        completed = this.completeValue(
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
          return this.handleFieldError(error, returnType, exeContext);
        });
      }
      return completed;
    } catch (rawError) {
      const error = locatedError(rawError, fieldNodes, pathToArray(path));
      return this.handleFieldError(error, returnType, exeContext);
    }
  }

  buildResolveInfo(
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
    };
  }

  handleFieldError(
    error: GraphQLError,
    returnType: GraphQLOutputType,
    exeContext: ExecutionContext,
  ): null {
    // If the field type is non-nullable, then it is resolved without any
    // protection from errors, however it still properly locates the error.
    if (isNonNullType(returnType)) {
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
  completeValue(
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

    // If field type is NonNull, complete for inner type, and throw field error
    // if result is null.
    if (isNonNullType(returnType)) {
      const completed = this.completeValue(
        exeContext,
        returnType.ofType,
        fieldNodes,
        info,
        path,
        result,
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
      return this.completeListValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
      );
    }

    // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
    // returning null if serialization is not possible.
    if (isLeafType(returnType)) {
      return this.completeLeafValue(returnType, result);
    }

    // If field type is an abstract type, Interface or Union, determine the
    // runtime Object type and complete for that type.
    if (isAbstractType(returnType)) {
      return this.completeAbstractValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
      );
    }

    // If field type is Object, execute and complete all sub-selections.
    if (isObjectType(returnType)) {
      return this.completeObjectValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
      );
    }
    /* c8 ignore next 6 */
    // Not reachable, all possible output types have been considered.
    invariant(
      false,
      'Cannot complete value of unexpected output type: ' + inspect(returnType),
    );
  }

  /**
   * Complete a async iterator value by completing the result and calling
   * recursively until all the results are completed.
   */
  async completeAsyncIteratorValue(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    iterator: AsyncIterator<unknown>,
  ): Promise<ReadonlyArray<unknown>> {
    let containsPromise = false;
    const completedResults = [];
    let index = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const fieldPath = addPath(path, index, undefined);
      try {
        // eslint-disable-next-line no-await-in-loop
        const { value, done } = await iterator.next();
        if (done) {
          break;
        }

        try {
          // TODO can the error checking logic be consolidated with completeListValue?
          const completedItem = this.completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            fieldPath,
            value,
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
          this.handleFieldError(error, itemType, exeContext);
        }
      } catch (rawError) {
        completedResults.push(null);
        const error = locatedError(
          rawError,
          fieldNodes,
          pathToArray(fieldPath),
        );
        this.handleFieldError(error, itemType, exeContext);
        break;
      }
      index += 1;
    }
    return containsPromise ? Promise.all(completedResults) : completedResults;
  }

  /**
   * Complete a list value by completing each item in the list with the
   * inner type
   */
  completeListValue(
    exeContext: ExecutionContext,
    returnType: GraphQLList<GraphQLOutputType>,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
  ): PromiseOrValue<ReadonlyArray<unknown>> {
    const itemType = returnType.ofType;

    if (isAsyncIterable(result)) {
      const iterator = result[Symbol.asyncIterator]();

      return this.completeAsyncIteratorValue(
        exeContext,
        itemType,
        fieldNodes,
        info,
        path,
        iterator,
      );
    }

    if (!isIterableObject(result)) {
      throw new GraphQLError(
        `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
      );
    }

    // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.
    let containsPromise = false;
    const completedResults = Array.from(result, (item, index) => {
      // No need to modify the info object containing the path,
      // since from here on it is not ever accessed by resolver functions.
      const itemPath = addPath(path, index, undefined);
      try {
        let completedItem;
        if (isPromise(item)) {
          completedItem = item.then((resolved) =>
            this.completeValue(
              exeContext,
              itemType,
              fieldNodes,
              info,
              itemPath,
              resolved,
            ),
          );
        } else {
          completedItem = this.completeValue(
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
            return this.handleFieldError(error, itemType, exeContext);
          });
        }
        return completedItem;
      } catch (rawError) {
        const error = locatedError(rawError, fieldNodes, pathToArray(itemPath));
        return this.handleFieldError(error, itemType, exeContext);
      }
    });

    return containsPromise ? Promise.all(completedResults) : completedResults;
  }

  /**
   * Complete a Scalar or Enum by serializing to a valid value, returning
   * null if serialization is not possible.
   */
  completeLeafValue(returnType: GraphQLLeafType, result: unknown): unknown {
    const serializedResult = returnType.serialize(result);
    if (serializedResult == null) {
      throw new Error(
        `Expected \`${inspect(returnType)}.serialize(${inspect(
          result,
        )})\` to ` +
          `return non-nullable value, returned: ${inspect(serializedResult)}`,
      );
    }
    return serializedResult;
  }

  /**
   * Complete a value of an abstract type by determining the runtime object type
   * of that value, then complete the value for that type.
   */
  completeAbstractValue(
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
        this.completeObjectValue(
          exeContext,
          this.ensureValidRuntimeType(
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

    return this.completeObjectValue(
      exeContext,
      this.ensureValidRuntimeType(
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

  ensureValidRuntimeType(
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
        { nodes: fieldNodes },
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
  completeObjectValue(
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
      const isTypeOf = returnType.isTypeOf(
        result,
        exeContext.contextValue,
        info,
      );

      if (isPromise(isTypeOf)) {
        return isTypeOf.then((resolvedIsTypeOf) => {
          if (!resolvedIsTypeOf) {
            throw this.invalidReturnTypeError(returnType, result, fieldNodes);
          }
          return this.executeFields(
            exeContext,
            returnType,
            result,
            path,
            subFieldNodes,
          );
        });
      }

      if (!isTypeOf) {
        throw this.invalidReturnTypeError(returnType, result, fieldNodes);
      }
    }

    return this.executeFields(
      exeContext,
      returnType,
      result,
      path,
      subFieldNodes,
    );
  }

  invalidReturnTypeError(
    returnType: GraphQLObjectType,
    result: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
  ): GraphQLError {
    return new GraphQLError(
      `Expected value of type "${returnType.name}" but got: ${inspect(
        result,
      )}.`,
      { nodes: fieldNodes },
    );
  }

  executeSubscription(
    exeContext: ExecutionContext,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<ExecutionResult, void, void>
  > {
    const resultOrStream = this.createSourceEventStreamImpl(exeContext);

    if (isPromise(resultOrStream)) {
      return resultOrStream.then((resolvedResultOrStream) =>
        this.mapSourceToResponse(exeContext, resolvedResultOrStream),
      );
    }

    return this.mapSourceToResponse(exeContext, resultOrStream);
  }

  mapSourceToResponse(
    exeContext: ExecutionContext,
    resultOrStream: ExecutionResult | AsyncIterable<unknown>,
  ): PromiseOrValue<
    AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
  > {
    if (!isAsyncIterable(resultOrStream)) {
      return resultOrStream;
    }

    // For each payload yielded from a subscription, map it over the normal
    // GraphQL `execute` function, with `payload` as the rootValue.
    // This implements the "MapSourceToResponseEvent" algorithm described in
    // the GraphQL specification. The `execute` provides the
    // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
    // "this.executeQuery" algorithm, for which `execute` is also used.
    return mapAsyncIterator(resultOrStream, (payload: unknown) =>
      this.executeQuery(buildPerEventExecutionContext(exeContext, payload)),
    );
  }

  createSourceEventStreamImpl(
    exeContext: ExecutionContext,
  ): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
    try {
      const eventStream = this.executeSubscriptionRootField(exeContext);
      if (isPromise(eventStream)) {
        return eventStream.then(undefined, (error) => ({ errors: [error] }));
      }

      return eventStream;
    } catch (error) {
      return { errors: [error] };
    }
  }

  executeSubscriptionRootField(
    exeContext: ExecutionContext,
  ): PromiseOrValue<AsyncIterable<unknown>> {
    const { schema, fragments, operation, variableValues, rootValue } =
      exeContext;

    const rootType = schema.getSubscriptionType();
    if (rootType == null) {
      throw new GraphQLError(
        'Schema is not configured to execute subscription operation.',
        { nodes: operation },
      );
    }

    const rootFields = collectFields(
      schema,
      fragments,
      variableValues,
      rootType,
      operation.selectionSet,
    );
    const [responseName, fieldNodes] = [...rootFields.entries()][0];
    const fieldName = fieldNodes[0].name.value;
    const fieldDef = schema.getField(rootType, fieldName);

    if (!fieldDef) {
      throw new GraphQLError(
        `The subscription field "${fieldName}" is not defined.`,
        { nodes: fieldNodes },
      );
    }

    const path = addPath(undefined, responseName, rootType.name);
    const info = this.buildResolveInfo(
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
      const args = getArgumentValues(fieldDef, fieldNodes[0], variableValues);

      // The resolve function's optional third argument is a context value that
      // is provided to every resolve within an execution. It is commonly
      // used to represent an authenticated user, or request-specific caches.
      const contextValue = exeContext.contextValue;

      // Call the `subscribe()` resolver or the default resolver to produce an
      // AsyncIterable yielding raw payloads.
      const resolveFn = fieldDef.subscribe ?? exeContext.subscribeFieldResolver;
      const result = resolveFn(rootValue, args, contextValue, info);

      if (isPromise(result)) {
        return result.then(this.assertEventStream).then(undefined, (error) => {
          throw locatedError(error, fieldNodes, pathToArray(path));
        });
      }

      return this.assertEventStream(result);
    } catch (error) {
      throw locatedError(error, fieldNodes, pathToArray(path));
    }
  }

  assertEventStream(result: unknown): AsyncIterable<unknown> {
    if (result instanceof Error) {
      throw result;
    }

    // Assert field returned an event stream, otherwise yield an error.
    if (!isAsyncIterable(result)) {
      throw new GraphQLError(
        'Subscription field must return Async Iterable. ' +
          `Received: ${inspect(result)}.`,
      );
    }

    return result;
  }
}
