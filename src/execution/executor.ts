import type { Path } from '../jsutils/Path';
import type { ObjMap } from '../jsutils/ObjMap';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import type { Maybe } from '../jsutils/Maybe';
import { inspect } from '../jsutils/inspect';
import { memoize2 } from '../jsutils/memoize2';
import { invariant } from '../jsutils/invariant';
import { isPromise } from '../jsutils/isPromise';
import { promiseReduce } from '../jsutils/promiseReduce';
import { promiseForObject } from '../jsutils/promiseForObject';
import { addPath, pathToArray } from '../jsutils/Path';
import { isIterableObject } from '../jsutils/isIterableObject';

import { GraphQLError } from '../error/GraphQLError';
import { locatedError } from '../error/locatedError';

import type {
  OperationDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
} from '../language/ast';

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
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from '../type/introspection';
import {
  isObjectType,
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
} from '../type/definition';

import { getOperationRootType } from '../utilities/getOperationRootType';

import type { ExecutionContext, ExecutionResult } from './execute';
import { getArgumentValues } from './values';
import { collectFields } from './collectFields';

/**
 * This class is exported only to assist people in implementing their own executors
 * without duplicating too much code and should be used only as last resort for cases
 * requiring custom execution or if certain features could not be contributed upstream.
 *
 * It is still part of the internal API and is versioned, so any changes to it are never
 * considered breaking changes. If you still need to support multiple versions of the
 * library, please use the `versionInfo` variable for version detection.
 *
 * @internal
 */
export class Executor {
  /**
   * A memoized collection of relevant subfields with regard to the return
   * type. Memoizing ensures the subfields are not repeatedly calculated, which
   * saves overhead when resolving lists of values.
   */
  collectSubfields = memoize2(
    (returnType: GraphQLObjectType, fieldNodes: ReadonlyArray<FieldNode>) =>
      this._collectSubfields(returnType, fieldNodes),
  );

  protected _schema: GraphQLSchema;
  protected _fragments: ObjMap<FragmentDefinitionNode>;
  protected _rootValue: unknown;
  protected _contextValue: unknown;
  protected _operation: OperationDefinitionNode;
  protected _variableValues: { [variable: string]: unknown };
  protected _fieldResolver: GraphQLFieldResolver<any, any>;
  protected _typeResolver: GraphQLTypeResolver<any, any>;
  protected _errors: Array<GraphQLError>;

  constructor({
    schema,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues,
    fieldResolver,
    typeResolver,
    errors,
  }: ExecutionContext) {
    this._schema = schema;
    this._fragments = fragments;
    this._rootValue = rootValue;
    this._contextValue = contextValue;
    this._operation = operation;
    this._variableValues = variableValues;
    this._fieldResolver = fieldResolver;
    this._typeResolver = typeResolver;
    this._errors = errors;
  }

  execute(): PromiseOrValue<ExecutionResult> {
    const data = this.executeOperation();
    return this.buildResponse(data);
  }

  /**
   * Implements the "Executing operations" section of the spec.
   */
  executeOperation(): PromiseOrValue<ObjMap<unknown> | null> {
    const { _schema, _fragments, _rootValue, _operation, _variableValues } =
      this;
    const type = getOperationRootType(_schema, _operation);
    const fields = collectFields(
      _schema,
      _fragments,
      _variableValues,
      type,
      _operation.selectionSet,
      new Map(),
      new Set(),
    );

    const path = undefined;

    // Errors from sub-fields of a NonNull type may propagate to the top level,
    // at which point we still log the error and null the parent field, which
    // in this case is the entire response.
    try {
      const result =
        _operation.operation === 'mutation'
          ? this.executeFieldsSerially(type, _rootValue, path, fields)
          : this.executeFields(type, _rootValue, path, fields);
      if (isPromise(result)) {
        return result.then(undefined, (error) => {
          this._errors.push(error);
          return Promise.resolve(null);
        });
      }
      return result;
    } catch (error) {
      this._errors.push(error);
      return null;
    }
  }

  /**
   * Given a completed execution context and data, build the { errors, data }
   * response defined by the "Response" section of the GraphQL specification.
   */
  buildResponse(
    data: PromiseOrValue<ObjMap<unknown> | null>,
  ): PromiseOrValue<ExecutionResult> {
    if (isPromise(data)) {
      return data.then((resolved) => this.buildResponse(resolved));
    }
    return this._errors.length === 0
      ? { data }
      : { errors: this._errors, data };
  }

  /**
   * Implements the "Executing selection sets" section of the spec
   * for fields that must be executed serially.
   */
  executeFieldsSerially(
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
   * Implements the "Executing field" section of the spec
   * In particular, this function figures out the value that the field returns by
   * calling its resolve function, then calls completeValue to complete promises,
   * serialize scalars, or execute the sub-selection-set for objects.
   */
  executeField(
    parentType: GraphQLObjectType,
    source: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
    path: Path,
  ): PromiseOrValue<unknown> {
    const { _schema, _contextValue, _variableValues, _fieldResolver } = this;

    const fieldDef = getFieldDef(_schema, parentType, fieldNodes[0]);
    if (!fieldDef) {
      return;
    }

    const returnType = fieldDef.type;
    const resolveFn = fieldDef.resolve ?? _fieldResolver;

    const info = this.buildResolveInfo(fieldDef, fieldNodes, parentType, path);

    // Get the resolve function, regardless of if its result is normal or abrupt (error).
    try {
      // Build a JS object of arguments from the field.arguments AST, using the
      // variables scope to fulfill any variable references.
      // TODO: find a way to memoize, in case this field is within a List type.
      const args = getArgumentValues(fieldDef, fieldNodes[0], _variableValues);

      // The resolve function's optional third argument is a context value that
      // is provided to every resolve function within an execution. It is commonly
      // used to represent an authenticated user, or request-specific caches.
      const result = resolveFn(source, args, _contextValue, info);

      let completed;
      if (isPromise(result)) {
        completed = result.then((resolved) =>
          this.completeValue(returnType, fieldNodes, info, path, resolved),
        );
      } else {
        completed = this.completeValue(
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
          return this.handleFieldError(error, returnType);
        });
      }
      return completed;
    } catch (rawError) {
      const error = locatedError(rawError, fieldNodes, pathToArray(path));
      return this.handleFieldError(error, returnType);
    }
  }

  /**
   * @internal
   */
  buildResolveInfo(
    fieldDef: GraphQLField<unknown, unknown>,
    fieldNodes: ReadonlyArray<FieldNode>,
    parentType: GraphQLObjectType,
    path: Path,
  ): GraphQLResolveInfo {
    const { _schema, _fragments, _rootValue, _operation, _variableValues } =
      this;

    // The resolve function's optional fourth argument is a collection of
    // information about the current execution state.
    return {
      fieldName: fieldDef.name,
      fieldNodes,
      returnType: fieldDef.type,
      parentType,
      path,
      schema: _schema,
      fragments: _fragments,
      rootValue: _rootValue,
      operation: _operation,
      variableValues: _variableValues,
    };
  }

  handleFieldError(error: GraphQLError, returnType: GraphQLOutputType): null {
    // If the field type is non-nullable, then it is resolved without any
    // protection from errors, however it still properly locates the error.
    if (isNonNullType(returnType)) {
      throw error;
    }

    // Otherwise, error protection is applied, logging the error and resolving
    // a null value for this field if one is encountered.
    this._errors.push(error);
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
   * value by executing all sub-selections.
   */
  completeValue(
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
      return this.completeListValue(returnType, fieldNodes, info, path, result);
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
        returnType,
        fieldNodes,
        info,
        path,
        result,
      );
    }

    // If field type is Object, execute and complete all sub-selections.
    // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
    if (isObjectType(returnType)) {
      return this.completeObjectValue(
        returnType,
        fieldNodes,
        info,
        path,
        result,
      );
    }

    // istanbul ignore next (Not reachable. All possible output types have been considered)
    invariant(
      false,
      'Cannot complete value of unexpected output type: ' + inspect(returnType),
    );
  }

  /**
   * Complete a list value by completing each item in the list with the
   * inner type
   */
  completeListValue(
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
            this.completeValue(itemType, fieldNodes, info, itemPath, resolved),
          );
        } else {
          completedItem = this.completeValue(
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
            return this.handleFieldError(error, itemType);
          });
        }
        return completedItem;
      } catch (rawError) {
        const error = locatedError(rawError, fieldNodes, pathToArray(itemPath));
        return this.handleFieldError(error, itemType);
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
  completeAbstractValue(
    returnType: GraphQLAbstractType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
  ): PromiseOrValue<ObjMap<unknown>> {
    const { _contextValue, _typeResolver } = this;

    const resolveTypeFn = returnType.resolveType ?? _typeResolver;
    const runtimeType = resolveTypeFn(result, _contextValue, info, returnType);

    if (isPromise(runtimeType)) {
      return runtimeType.then((resolvedRuntimeType) =>
        this.completeObjectValue(
          this.ensureValidRuntimeType(
            resolvedRuntimeType,
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
      this.ensureValidRuntimeType(
        runtimeType,
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

    const runtimeType = this._schema.getType(runtimeTypeName);
    if (runtimeType == null) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
        fieldNodes,
      );
    }

    if (!isObjectType(runtimeType)) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
        fieldNodes,
      );
    }

    if (!this._schema.isSubType(returnType, runtimeType)) {
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
  completeObjectValue(
    returnType: GraphQLObjectType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
  ): PromiseOrValue<ObjMap<unknown>> {
    // Collect sub-fields to execute to complete this value.
    const subFieldNodes = this.collectSubfields(returnType, fieldNodes);

    // If there is an isTypeOf predicate function, call it with the
    // current result. If isTypeOf returns false, then raise an error rather
    // than continuing execution.
    if (returnType.isTypeOf) {
      const isTypeOf = returnType.isTypeOf(result, this._contextValue, info);

      if (isPromise(isTypeOf)) {
        return isTypeOf.then((resolvedIsTypeOf) => {
          if (!resolvedIsTypeOf) {
            throw invalidReturnTypeError(returnType, result, fieldNodes);
          }
          return this.executeFields(returnType, result, path, subFieldNodes);
        });
      }

      if (!isTypeOf) {
        throw invalidReturnTypeError(returnType, result, fieldNodes);
      }
    }

    return this.executeFields(returnType, result, path, subFieldNodes);
  }

  /**
   * A collection of relevant subfields with regard to the return type.
   * See 'collectSubfields' above for the memoized version.
   */
  protected _collectSubfields(
    returnType: GraphQLObjectType,
    fieldNodes: ReadonlyArray<FieldNode>,
  ): Map<string, ReadonlyArray<FieldNode>> {
    const { _schema, _fragments, _variableValues } = this;

    let subFieldNodes = new Map();
    const visitedFragmentNames = new Set<string>();
    for (const node of fieldNodes) {
      if (node.selectionSet) {
        subFieldNodes = collectFields(
          _schema,
          _fragments,
          _variableValues,
          returnType,
          node.selectionSet,
          subFieldNodes,
          visitedFragmentNames,
        );
      }
    }
    return subFieldNodes;
  }
}

function invalidReturnTypeError(
  returnType: GraphQLObjectType,
  result: unknown,
  fieldNodes: ReadonlyArray<FieldNode>,
): GraphQLError {
  return new GraphQLError(
    `Expected value of type "${returnType.name}" but got: ${inspect(result)}.`,
    fieldNodes,
  );
}

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
