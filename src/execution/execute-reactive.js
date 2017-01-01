import { isCollection } from 'iterall';

import { getArgumentValues } from './values';
import find from '../jsutils/find';
import { GraphQLError, locatedError } from '../error';
import * as Kind from '../language/kinds';
import { typeFromAST } from '../utilities/typeFromAST';
import isNullish from '../jsutils/isNullish';
import {
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
} from '../type/directives';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from '../type/introspection';
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInterfaceType,
  GraphQLUnionType,
  isAbstractType
} from '../type/definition';

// -----------------------------------------------------------------------------
// New code (We will inject this section back into execute.js for replacement)
// -----------------------------------------------------------------------------
import { Observable } from 'rxjs/Rx';

type ExecutionDescriptor = {
  exeContext: ExecutionContext,
  fieldNodes: Array<FieldNode>,
  info: GraphQLResolveInfo,
};

// !!!: CompleteType could be more clear types.
type CompleteType = mixed;

type ProcessField = (rxjs$Observable<rxjs$Observable<CompleteType>>) =>
  rxjs$Observable<Array<CompleteType>>;


/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "write" mode.
 */
export function executeFieldsSerially(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  path: ResponsePath,
  fields: {[key: string]: Array<FieldNode>}
): rxjs$Observable<CompleteType> {
  return eachResolvedFields$$(exeContext, parentType, sourceValue, path, fields,
    // We only allow each mutation field to execute only once (`take(1)`) and
    // serially (`concatAll()`). Convert the sequential results into an array.
    eachResolvedFields => eachResolvedFields
      .map(x => x.take(1))
      .concatAll()
      .toArray()
  );
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "read" mode.
 */
export function executeFields(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  path: ResponsePath,
  fields: {[key: string]: Array<FieldNode>}
): rxjs$Observable<CompleteType> {
  return eachResolvedFields$$(exeContext, parentType, sourceValue, path, fields,
    // We combine all higher-order observables of resolved fields into an array.
    // When any elements (observable) sends a new value, pop a new array for the
    // total results.
    eachResolvedFields => eachResolvedFields.combineAll()
  );
}

/**
 * Return a Observable which execute fields properly. You will use processFields
 * to decide how to manipulate each higher-order observable of fields and
 * how to assemble the each field result into a total result.
 */
function eachResolvedFields$$(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  path: ResponsePath,
  fields: {[key: string]: Array<FieldNode>},
  processFields: ProcessField
): rxjs$Observable<CompleteType> {
  // The whole process from input to return (a reactive observable for results):
  // `Object{ [fieldName]: fieldNodes }` -> `$( $( {[fieldName]: result} ) )`
  const eachResolvedFields =
  // `Object{ [fieldName]: fieldNodes }` -> `$( [fieldName, fieldNodes] )`
  Observable.pairs(fields)
    // `$( [fieldName, fieldNodes] )` -> `$( [fieldName, $(fieldResult)] )`
    .map(([ fieldName, fieldNodes ]) => {
      const fieldPath = addPath(path, fieldName);
      const fieldResult$ = resolveField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath
      );
      return [ fieldName, fieldResult$ ];
    })
    // The fieldResult$ might be null due to the field definition is not found
    // without throwing any error. We filter those illegal fieldResult$ to avoid
    // generate any result.
    .filter(([ /* fieldName */, fieldResult$ ]) => Boolean(fieldResult$))
    // `$( [fieldName, $(result)] )` -> `$( $( {[fieldName]: result} ) )`
    .map(([ fieldName, fieldResult$ ]) =>
      fieldResult$.map(result => ({[fieldName]: result}))
    );

  // Let `processFields` callback decides how to execute and assemble the
  // results of Observables.
  // `$( $( {[fieldName]: result} ) )` -> `$(Array< {[fieldName]: result} >)`
  const assembledResult = processFields(eachResolvedFields);

  // `$(Array< {[fieldName]: result} >)` -> `$(Object{ [fieldName]: result })`
  const resolvedResults = assembledResult
    // Convert the field results (array) to a total result (object) by `reduce`.
    .map(fieldResults =>
      fieldResults.reduce((results, fieldResult) => {
        return Object.assign(results, fieldResult);
      }, {})
    )
    // !!!: we haven't tested when the fields is an empty object.
    // We try to give the finalResults a default value if it completes without
    // emitting any next value. The final results will always be an object for
    // the query field. The default result is an empty object.
    .defaultIfEmpty({});

  return resolvedResults;
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
  fieldNodes: Array<FieldNode>,
  path: ResponsePath
): ?rxjs$Observable<CompleteType> {
  const fieldNode = fieldNodes[0];
  const fieldName = fieldNode.name.value;

  const fieldDef = getFieldDef(exeContext.schema, parentType, fieldName);
  if (!fieldDef) {
    // Return null to skip resolve this field.
    return null;
  }

  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve || defaultFieldResolver;

  // The resolve function's optional third argument is a context value that
  // is provided to every resolve function within an execution. It is commonly
  // used to represent an authenticated user, or request-specific caches.
  const context = exeContext.contextValue;

  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  const info: GraphQLResolveInfo = {
    fieldName,
    fieldNodes,
    returnType,
    parentType,
    path,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
  };

  const descriptor: ExecutionDescriptor = {
    exeContext,
    fieldNodes,
    info,
  };

  // Defer the resolveFn part. It will only be triggered when the Observable is
  // subscribed.
  return Observable.defer(() => {
    // Get the resolve function, regardless of if its result is normal
    // or abrupt (error).
    const result = resolveOrError(
      exeContext,
      fieldDef,
      fieldNode,
      resolveFn,
      source,
      context,
      info
    );

    return completeResolvedValue(
      descriptor,
      path,
      returnType,
      result
    );
  });
}

// This is a small wrapper around completeValue which catch and annotate errors.
// If the field type is nullable, we resolve a null value for this field and .
// log it in the execution context.
function completeResolvedValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLType,
  result: mixed
): rxjs$Observable<CompleteType> {
  return completeValue(descriptor, path, returnType, result)
    .catch(error => {
      // Annotates errors with location information.
      const pathKeys = responsePathAsArray(path);
      const annotated = locatedError(error, descriptor.fieldNodes, pathKeys);

      if (returnType instanceof GraphQLNonNull) {
        // If the field type is non-nullable, then it is resolved without any
        // protection from errors, however it still properly locates the error.
        return Observable.throw(annotated);
      }

      // Otherwise, error protection is applied, logging the error and
      // resolving a null value for this field if one is encountered.
      descriptor.exeContext.errors.push(annotated);
      return Observable.of(null);
    });
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
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLType,
  result: mixed
): rxjs$Observable<CompleteType> {
  // If result is a Promise, apply-lift over completeValue.
  if (isThenable(result)) {
    return completePromiseValue(descriptor, path, returnType, result);
  }

  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    return Observable.throw(result);
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (returnType instanceof GraphQLNonNull) {
    return completeNonNullValue(descriptor, path, returnType, result);
  }

  // If result value is null-ish (null, undefined, or NaN) then return null.
  if (isNullish(result)) {
    return Observable.of(null);
  }

  // If field type is List, complete each item in the list with the inner type
  if (returnType instanceof GraphQLList) {
    return completeListValue(descriptor, path, returnType, result);
  }

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if (returnType instanceof GraphQLScalarType ||
      returnType instanceof GraphQLEnumType) {
    return completeLeafValue(returnType, result);
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (returnType instanceof GraphQLInterfaceType ||
      returnType instanceof GraphQLUnionType) {
    return completeAbstractValue(descriptor, path, returnType, result);
  }

  // If field type is Object, execute and complete all sub-selections.
  if (returnType instanceof GraphQLObjectType) {
    return completeObjectValue(descriptor, path, returnType, result);
  }

  // Not reachable. All possible output types have been considered.
  return Observable.throw(new Error(
    `Cannot complete value of unexpected type "${String(returnType)}".`
  ));
}

function completePromiseValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLType,
  result: mixed
): rxjs$Observable<CompleteType> {
  return Observable.fromPromise(result).flatMap(
    resolved => completeValue(descriptor, path, returnType, resolved)
  );
}

function completeNonNullValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLNonNull,
  result: mixed
): rxjs$Observable<CompleteType> {
  return completeValue(descriptor, path, returnType.ofType, result)
    .switchMap(value => {
      if (value === null) {
        return Observable.throw(new Error(
          `Cannot return null for non-nullable field ${
            descriptor.info.parentType.name}.${descriptor.info.fieldName}.`
        ));
      }
      return Observable.of(value);
    });
}


/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLList<*>,
  result: mixed
): rxjs$Observable<CompleteType> {
  // !!!: We are using `Rx.Observable.of()` for the result.
  // `Rx.Observable.of()` might not support other collection types which
  // the library 'iterall' supports.
  // This conditional test might not be useful.
  if (!isCollection(result)) {
    return Observable.throw(new Error(
      `Expected Iterable, but did not find one for field ${
        descriptor.info.parentType.name}.${descriptor.info.fieldName}.`
    ));
  }

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  const itemType = returnType.ofType;

  // Every element inside the result list might be a reactive data source. We
  // resolve each of them and combine them all into an array.
  // The combined Observable will send the first result only when all elements
  // are resolved at least once, and then the combined Observable will start
  // to send all results when any element send a new value.
  const list$ = Observable.from(result)
    .map((item, index) => {
      // No need to modify the info object containing the path,
      // since from here on it is not ever accessed by resolver functions.
      const fieldPath = addPath(path, index);
      return completeResolvedValue(descriptor, fieldPath, itemType, item);
    })
    .combineAll();

  // If there is no element in the result, we send an empty array as the default
  // value to complete the value. Do not send the result itself, because the
  // result may not be an array type which can't be resolved correctly when
  // testing.
  return list$.defaultIfEmpty([]);
}

/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(
  returnType: GraphQLLeafType,
  result: mixed
): rxjs$Observable<CompleteType> {
  if (!returnType.serialize) {
    return Observable.throw(new Error(
      `Missing serialize method on type "${String(returnType)}"`
    ));
  }

  const serializedResult = returnType.serialize(result);

  if (isNullish(serializedResult)) {
    return Observable.throw(new Error(
      `Expected a value of type "${String(returnType)}" but received: ${
        String(result)}`
    ));
  }
  return Observable.of(serializedResult);
}

/**
 * Complete a value of an abstract type by determining the runtime object type
 * of that value, then complete the value for that type.
 */
function completeAbstractValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLAbstractType,
  result: mixed
): rxjs$Observable<CompleteType> {
  const { exeContext, fieldNodes, info } = descriptor;
  let runtimeType = returnType.resolveType ?
    returnType.resolveType(result, exeContext.contextValue, info) :
    defaultResolveTypeFn(result, exeContext.contextValue, info, returnType);

  // If resolveType returns a string, we assume it's a GraphQLObjectType name.
  if (typeof runtimeType === 'string') {
    runtimeType = exeContext.schema.getType(runtimeType);
  }

  if (!(runtimeType instanceof GraphQLObjectType)) {
    return Observable.throw(new GraphQLError(
      `Abstract type ${returnType.name} must resolve to an Object type at ` +
      `runtime for field ${info.parentType.name}.${info.fieldName} with ` +
      `value "${String(result)}", received "${String(runtimeType)}".`,
      fieldNodes
    ));
  }

  if (!exeContext.schema.isPossibleType(returnType, runtimeType)) {
    return Observable.throw(new GraphQLError(
      `Runtime Object type "${runtimeType.name}" is not a possible type ` +
      `for "${returnType.name}".`,
      fieldNodes
    ));
  }

  return completeObjectValue(descriptor, path, runtimeType, result);
}

/**
 * Complete an Object value by executing all sub-selections.
 */
function completeObjectValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLObjectType,
  result: mixed
): rxjs$Observable<CompleteType> {
  const { exeContext, fieldNodes, info } = descriptor;
  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf &&
      !returnType.isTypeOf(result, exeContext.contextValue, info)) {
    return Observable.throw(new GraphQLError(
      `Expected value of type "${returnType.name}" but got: ${String(result)}.`,
      fieldNodes
    ));
  }

  // Collect sub-fields to execute to complete this value.
  let subFieldNodes = Object.create(null);
  const visitedFragmentNames = Object.create(null);
  for (let i = 0; i < fieldNodes.length; i++) {
    const selectionSet = fieldNodes[i].selectionSet;
    if (selectionSet) {
      subFieldNodes = collectFields(
        exeContext,
        returnType,
        selectionSet,
        subFieldNodes,
        visitedFragmentNames
      );
    }
  }

  return executeFields(exeContext, returnType, result, path, subFieldNodes);
}




// -----------------------------------------------------------------------------
// unmodified helper functions (in execute.js)
// -----------------------------------------------------------------------------

/**
 * Given a ResponsePath (found in the `path` entry in the information provided
 * as the last argument to a field resolver), return an Array of the path keys.
 */
export function responsePathAsArray(
  path: ResponsePath
): Array<string | number> {
  const flattened = [];
  let curr = path;
  while (curr) {
    flattened.push(curr.key);
    curr = curr.prev;
  }
  return flattened.reverse();
}


function addPath(prev: ResponsePath, key: string | number) {
  return { prev, key };
}

/**
 * Checks to see if this object acts like a Promise, i.e. has a "then"
 * function.
 */
function isThenable(value: mixed): boolean {
  return typeof value === 'object' &&
    value !== null &&
    typeof value.then === 'function';
}

/**
 * This method looks up the field on the given type defintion.
 * It has special casing for the two introspection fields, __schema
 * and __typename. __typename is special because it can always be
 * queried as a field, even in situations where no other fields
 * are allowed, like on a Union. __schema could get automatically
 * added to the query type, but that would require mutating type
 * definitions, which would cause issues.
 */
function getFieldDef(
  schema: GraphQLSchema,
  parentType: GraphQLObjectType,
  fieldName: string
): ?GraphQLField<*, *> {
  if (fieldName === SchemaMetaFieldDef.name &&
      schema.getQueryType() === parentType) {
    return SchemaMetaFieldDef;
  } else if (fieldName === TypeMetaFieldDef.name &&
             schema.getQueryType() === parentType) {
    return TypeMetaFieldDef;
  } else if (fieldName === TypeNameMetaFieldDef.name) {
    return TypeNameMetaFieldDef;
  }
  return parentType.getFields()[fieldName];
}

// Isolates the "ReturnOrAbrupt" behavior to not de-opt the `resolveField`
// function. Returns the result of resolveFn or the abrupt-return Error object.
function resolveOrError<TSource, TContext>(
  exeContext: ExecutionContext,
  fieldDef: GraphQLField<TSource, TContext>,
  fieldNode: FieldNode,
  resolveFn: GraphQLFieldResolver<TSource, TContext>,
  source: TSource,
  context: TContext,
  info: GraphQLResolveInfo
): Error | mixed {
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = getArgumentValues(
      fieldDef,
      fieldNode,
      exeContext.variableValues
    );

    return resolveFn(source, args, context, info);
  } catch (error) {
    // Sometimes a non-error is thrown, wrap it as an Error for a
    // consistent interface.
    return error instanceof Error ? error : new Error(error);
  }
}

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context.
 */
export const defaultFieldResolver: GraphQLFieldResolver<any, *> =
function (source, args, context, info) {
  // ensure source is a value for which property access is acceptable.
  if (typeof source === 'object' || typeof source === 'function') {
    const property = source[info.fieldName];
    if (typeof property === 'function') {
      return source[info.fieldName](args, context, info);
    }
    return property;
  }
};

/**
 * Given a selectionSet, adds all of the fields in that selection to
 * the passed in map of fields, and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns and Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 */
function collectFields(
  exeContext: ExecutionContext,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  fields: {[key: string]: Array<FieldNode>},
  visitedFragmentNames: {[key: string]: boolean}
): {[key: string]: Array<FieldNode>} {
  for (let i = 0; i < selectionSet.selections.length; i++) {
    const selection = selectionSet.selections[i];
    switch (selection.kind) {
      case Kind.FIELD:
        if (!shouldIncludeNode(exeContext, selection.directives)) {
          continue;
        }
        const name = getFieldEntryKey(selection);
        if (!fields[name]) {
          fields[name] = [];
        }
        fields[name].push(selection);
        break;
      case Kind.INLINE_FRAGMENT:
        if (!shouldIncludeNode(exeContext, selection.directives) ||
            !doesFragmentConditionMatch(exeContext, selection, runtimeType)) {
          continue;
        }
        collectFields(
          exeContext,
          runtimeType,
          selection.selectionSet,
          fields,
          visitedFragmentNames
        );
        break;
      case Kind.FRAGMENT_SPREAD:
        const fragName = selection.name.value;
        if (visitedFragmentNames[fragName] ||
            !shouldIncludeNode(exeContext, selection.directives)) {
          continue;
        }
        visitedFragmentNames[fragName] = true;
        const fragment = exeContext.fragments[fragName];
        if (!fragment ||
            !doesFragmentConditionMatch(exeContext, fragment, runtimeType)) {
          continue;
        }
        collectFields(
          exeContext,
          runtimeType,
          fragment.selectionSet,
          fields,
          visitedFragmentNames
        );
        break;
    }
  }
  return fields;
}

/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which tests each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */
function defaultResolveTypeFn(
  value: mixed,
  context: mixed,
  info: GraphQLResolveInfo,
  abstractType: GraphQLAbstractType
): ?GraphQLObjectType {
  const possibleTypes = info.schema.getPossibleTypes(abstractType);
  for (let i = 0; i < possibleTypes.length; i++) {
    const type = possibleTypes[i];
    if (type.isTypeOf && type.isTypeOf(value, context, info)) {
      return type;
    }
  }
}

/**
 * Determines if a field should be included based on the @include and @skip
 * directives, where @skip has higher precidence than @include.
 */
function shouldIncludeNode(
  exeContext: ExecutionContext,
  directives: ?Array<DirectiveNode>
): boolean {
  const skipNode = directives && find(
    directives,
    directive => directive.name.value === GraphQLSkipDirective.name
  );
  if (skipNode) {
    const { if: skipIf } = getArgumentValues(
      GraphQLSkipDirective,
      skipNode,
      exeContext.variableValues
    );
    if (skipIf === true) {
      return false;
    }
  }

  const includeNode = directives && find(
    directives,
    directive => directive.name.value === GraphQLIncludeDirective.name
  );
  if (includeNode) {
    const { if: includeIf } = getArgumentValues(
      GraphQLIncludeDirective,
      includeNode,
      exeContext.variableValues
    );
    if (includeIf === false) {
      return false;
    }
  }

  return true;
}

/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(
  exeContext: ExecutionContext,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  type: GraphQLObjectType
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
    const abstractType = ((conditionalType: any): GraphQLAbstractType);
    return exeContext.schema.isPossibleType(abstractType, type);
  }
  return false;
}

/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node: FieldNode): string {
  return node.alias ? node.alias.value : node.name.value;
}
