var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import { forEach, isCollection } from 'iterall';
import { GraphQLError, locatedError } from '../error';
import invariant from '../jsutils/invariant';
import isInvalid from '../jsutils/isInvalid';
import isNullish from '../jsutils/isNullish';


import { typeFromAST } from '../utilities/typeFromAST';
import * as Kind from '../language/kinds';
import { getVariableValues, getArgumentValues, getDirectiveValues } from './values';
import { isObjectType, isAbstractType, isLeafType, isListType, isNonNullType } from '../type/definition';

import { GraphQLSchema } from '../type/schema';
import { SchemaMetaFieldDef, TypeMetaFieldDef, TypeNameMetaFieldDef } from '../type/introspection';
import { GraphQLIncludeDirective, GraphQLSkipDirective } from '../type/directives';
import { assertValidSchema } from '../type/validate';

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


/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 */


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

/* eslint-disable no-redeclare */

export function execute(argsOrSchema, document, rootValue, contextValue, variableValues, operationName, fieldResolver) {
  /* eslint-enable no-redeclare */
  // Extract arguments from object args if provided.
  return arguments.length === 1 ? executeImpl(argsOrSchema.schema, argsOrSchema.document, argsOrSchema.rootValue, argsOrSchema.contextValue, argsOrSchema.variableValues, argsOrSchema.operationName, argsOrSchema.fieldResolver) : executeImpl(argsOrSchema, document, rootValue, contextValue, variableValues, operationName, fieldResolver);
}

function executeImpl(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver) {
  // If arguments are missing or incorrect, throw an error.
  assertValidExecutionArguments(schema, document, variableValues);

  // If a valid context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  var context = buildExecutionContext(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver);

  // Return early errors if execution context failed.
  if (Array.isArray(context)) {
    return { errors: context };
  }

  // Return a Promise that will eventually resolve to the data described by
  // The "Response" section of the GraphQL specification.
  //
  // If errors are encountered while executing a GraphQL field, only that
  // field and its descendants will be omitted, and sibling fields will still
  // be executed. An execution which encounters errors will still result in a
  // resolved Promise.
  var data = executeOperation(context, context.operation, rootValue);
  return buildResponse(context, data);
}

/**
 * Given a completed execution context and data, build the { errors, data }
 * response defined by the "Response" section of the GraphQL specification.
 */
function buildResponse(context, data) {
  var promise = getPromise(data);
  if (promise) {
    return promise.then(function (resolved) {
      return buildResponse(context, resolved);
    });
  }
  return context.errors.length === 0 ? { data: data } : { errors: context.errors, data: data };
}

/**
 * Given a ResponsePath (found in the `path` entry in the information provided
 * as the last argument to a field resolver), return an Array of the path keys.
 */
export function responsePathAsArray(path) {
  var flattened = [];
  var curr = path;
  while (curr) {
    flattened.push(curr.key);
    curr = curr.prev;
  }
  return flattened.reverse();
}

/**
 * Given a ResponsePath and a key, return a new ResponsePath containing the
 * new key.
 */
export function addPath(prev, key) {
  return { prev: prev, key: key };
}

/**
 * Essential assertions before executing to provide developer feedback for
 * improper use of the GraphQL library.
 */
export function assertValidExecutionArguments(schema, document, rawVariableValues) {
  !document ? invariant(0, 'Must provide document') : void 0;

  // If the schema used for execution is invalid, throw an error.
  assertValidSchema(schema);

  // Variables, if provided, must be an object.
  !(!rawVariableValues || (typeof rawVariableValues === 'undefined' ? 'undefined' : _typeof(rawVariableValues)) === 'object') ? invariant(0, 'Variables must be provided as an Object where each property is a ' + 'variable value. Perhaps look to see if an unparsed JSON string ' + 'was provided.') : void 0;
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 */
export function buildExecutionContext(schema, document, rootValue, contextValue, rawVariableValues, operationName, fieldResolver) {
  var errors = [];
  var operation = void 0;
  var hasMultipleAssumedOperations = false;
  var fragments = Object.create(null);
  for (var i = 0; i < document.definitions.length; i++) {
    var definition = document.definitions[i];
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (!operationName && operation) {
          hasMultipleAssumedOperations = true;
        } else if (!operationName || definition.name && definition.name.value === operationName) {
          operation = definition;
        }
        break;
      case Kind.FRAGMENT_DEFINITION:
        fragments[definition.name.value] = definition;
        break;
    }
  }

  if (!operation) {
    if (operationName) {
      errors.push(new GraphQLError('Unknown operation named "' + operationName + '".'));
    } else {
      errors.push(new GraphQLError('Must provide an operation.'));
    }
  } else if (hasMultipleAssumedOperations) {
    errors.push(new GraphQLError('Must provide operation name if query contains ' + 'multiple operations.'));
  }

  var variableValues = void 0;
  if (operation) {
    var coercedVariableValues = getVariableValues(schema, operation.variableDefinitions || [], rawVariableValues || {});

    if (coercedVariableValues.errors) {
      errors.push.apply(errors, coercedVariableValues.errors);
    } else {
      variableValues = coercedVariableValues.coerced;
    }
  }

  if (errors.length !== 0) {
    return errors;
  }

  !operation ? invariant(0, 'Has operation if no errors.') : void 0;
  !variableValues ? invariant(0, 'Has variables if no errors.') : void 0;

  return {
    schema: schema,
    fragments: fragments,
    rootValue: rootValue,
    contextValue: contextValue,
    operation: operation,
    variableValues: variableValues,
    fieldResolver: fieldResolver || defaultFieldResolver,
    errors: errors
  };
}

/**
 * Implements the "Evaluating operations" section of the spec.
 */
function executeOperation(exeContext, operation, rootValue) {
  var type = getOperationRootType(exeContext.schema, operation);
  var fields = collectFields(exeContext, type, operation.selectionSet, Object.create(null), Object.create(null));

  var path = undefined;

  // Errors from sub-fields of a NonNull type may propagate to the top level,
  // at which point we still log the error and null the parent field, which
  // in this case is the entire response.
  //
  // Similar to completeValueCatchingError.
  try {
    var result = operation.operation === 'mutation' ? executeFieldsSerially(exeContext, type, rootValue, path, fields) : executeFields(exeContext, type, rootValue, path, fields);
    var promise = getPromise(result);
    if (promise) {
      return promise.then(undefined, function (error) {
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
 * Extracts the root type of the operation from the schema.
 */
export function getOperationRootType(schema, operation) {
  switch (operation.operation) {
    case 'query':
      var queryType = schema.getQueryType();
      if (!queryType) {
        throw new GraphQLError('Schema does not define the required query root type.', [operation]);
      }
      return queryType;
    case 'mutation':
      var mutationType = schema.getMutationType();
      if (!mutationType) {
        throw new GraphQLError('Schema is not configured for mutations.', [operation]);
      }
      return mutationType;
    case 'subscription':
      var subscriptionType = schema.getSubscriptionType();
      if (!subscriptionType) {
        throw new GraphQLError('Schema is not configured for subscriptions.', [operation]);
      }
      return subscriptionType;
    default:
      throw new GraphQLError('Can only execute queries, mutations and subscriptions.', [operation]);
  }
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "write" mode.
 */
function executeFieldsSerially(exeContext, parentType, sourceValue, path, fields) {
  return Object.keys(fields).reduce(function (prevPromise, responseName) {
    return prevPromise.then(function (results) {
      var fieldNodes = fields[responseName];
      var fieldPath = addPath(path, responseName);
      var result = resolveField(exeContext, parentType, sourceValue, fieldNodes, fieldPath);
      if (result === undefined) {
        return results;
      }
      var promise = getPromise(result);
      if (promise) {
        return promise.then(function (resolvedResult) {
          results[responseName] = resolvedResult;
          return results;
        });
      }
      results[responseName] = result;
      return results;
    });
  }, Promise.resolve({}));
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "read" mode.
 */
function executeFields(exeContext, parentType, sourceValue, path, fields) {
  var containsPromise = false;

  var finalResults = Object.keys(fields).reduce(function (results, responseName) {
    var fieldNodes = fields[responseName];
    var fieldPath = addPath(path, responseName);
    var result = resolveField(exeContext, parentType, sourceValue, fieldNodes, fieldPath);
    if (result === undefined) {
      return results;
    }
    results[responseName] = result;
    if (getPromise(result)) {
      containsPromise = true;
    }
    return results;
  }, Object.create(null));

  // If there are no promises, we can just return the object
  if (!containsPromise) {
    return finalResults;
  }

  // Otherwise, results is a map from field name to the result
  // of resolving that field, which is possibly a promise. Return
  // a promise that will return this same map, but with any
  // promises replaced with the values they resolved to.
  return promiseForObject(finalResults);
}

/**
 * Given a selectionSet, adds all of the fields in that selection to
 * the passed in map of fields, and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns an Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 */
export function collectFields(exeContext, runtimeType, selectionSet, fields, visitedFragmentNames) {
  for (var i = 0; i < selectionSet.selections.length; i++) {
    var selection = selectionSet.selections[i];
    switch (selection.kind) {
      case Kind.FIELD:
        if (!shouldIncludeNode(exeContext, selection)) {
          continue;
        }
        var name = getFieldEntryKey(selection);
        if (!fields[name]) {
          fields[name] = [];
        }
        fields[name].push(selection);
        break;
      case Kind.INLINE_FRAGMENT:
        if (!shouldIncludeNode(exeContext, selection) || !doesFragmentConditionMatch(exeContext, selection, runtimeType)) {
          continue;
        }
        collectFields(exeContext, runtimeType, selection.selectionSet, fields, visitedFragmentNames);
        break;
      case Kind.FRAGMENT_SPREAD:
        var fragName = selection.name.value;
        if (visitedFragmentNames[fragName] || !shouldIncludeNode(exeContext, selection)) {
          continue;
        }
        visitedFragmentNames[fragName] = true;
        var fragment = exeContext.fragments[fragName];
        if (!fragment || !doesFragmentConditionMatch(exeContext, fragment, runtimeType)) {
          continue;
        }
        collectFields(exeContext, runtimeType, fragment.selectionSet, fields, visitedFragmentNames);
        break;
    }
  }
  return fields;
}

/**
 * Determines if a field should be included based on the @include and @skip
 * directives, where @skip has higher precidence than @include.
 */
function shouldIncludeNode(exeContext, node) {
  var skip = getDirectiveValues(GraphQLSkipDirective, node, exeContext.variableValues);
  if (skip && skip.if === true) {
    return false;
  }

  var include = getDirectiveValues(GraphQLIncludeDirective, node, exeContext.variableValues);
  if (include && include.if === false) {
    return false;
  }
  return true;
}

/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(exeContext, fragment, type) {
  var typeConditionNode = fragment.typeCondition;
  if (!typeConditionNode) {
    return true;
  }
  var conditionalType = typeFromAST(exeContext.schema, typeConditionNode);
  if (conditionalType === type) {
    return true;
  }
  if (isAbstractType(conditionalType)) {
    return exeContext.schema.isPossibleType(conditionalType, type);
  }
  return false;
}

/**
 * This function transforms a JS object `ObjMap<Promise<T>>` into
 * a `Promise<ObjMap<T>>`
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 */
function promiseForObject(object) {
  var keys = Object.keys(object);
  var valuesAndPromises = keys.map(function (name) {
    return object[name];
  });
  return Promise.all(valuesAndPromises).then(function (values) {
    return values.reduce(function (resolvedObject, value, i) {
      resolvedObject[keys[i]] = value;
      return resolvedObject;
    }, Object.create(null));
  });
}

/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node) {
  return node.alias ? node.alias.value : node.name.value;
}

/**
 * Resolves the field on the given source object. In particular, this
 * figures out the value that the field returns by calling its resolve function,
 * then calls completeValue to complete promises, serialize scalars, or execute
 * the sub-selection-set for objects.
 */
function resolveField(exeContext, parentType, source, fieldNodes, path) {
  var fieldNode = fieldNodes[0];
  var fieldName = fieldNode.name.value;

  var fieldDef = getFieldDef(exeContext.schema, parentType, fieldName);
  if (!fieldDef) {
    return;
  }

  var resolveFn = fieldDef.resolve || exeContext.fieldResolver;

  var info = buildResolveInfo(exeContext, fieldDef, fieldNodes, parentType, path);

  // Get the resolve function, regardless of if its result is normal
  // or abrupt (error).
  var result = resolveFieldValueOrError(exeContext, fieldDef, fieldNodes, resolveFn, source, info);

  return completeValueCatchingError(exeContext, fieldDef.type, fieldNodes, info, path, result);
}

export function buildResolveInfo(exeContext, fieldDef, fieldNodes, parentType, path) {
  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  return {
    fieldName: fieldNodes[0].name.value,
    fieldNodes: fieldNodes,
    returnType: fieldDef.type,
    parentType: parentType,
    path: path,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues
  };
}

// Isolates the "ReturnOrAbrupt" behavior to not de-opt the `resolveField`
// function. Returns the result of resolveFn or the abrupt-return Error object.
export function resolveFieldValueOrError(exeContext, fieldDef, fieldNodes, resolveFn, source, info) {
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    var args = getArgumentValues(fieldDef, fieldNodes[0], exeContext.variableValues);

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    var context = exeContext.contextValue;

    var result = resolveFn(source, args, context, info);
    var promise = getPromise(result);
    return promise ? promise.then(undefined, asErrorInstance) : result;
  } catch (error) {
    return asErrorInstance(error);
  }
}

// Sometimes a non-error is thrown, wrap it as an Error instance to ensure a
// consistent Error interface.
function asErrorInstance(error) {
  return error instanceof Error ? error : new Error(error || undefined);
}

// This is a small wrapper around completeValue which detects and logs errors
// in the execution context.
function completeValueCatchingError(exeContext, returnType, fieldNodes, info, path, result) {
  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (isNonNullType(returnType)) {
    return completeValueWithLocatedError(exeContext, returnType, fieldNodes, info, path, result);
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  try {
    var completed = completeValueWithLocatedError(exeContext, returnType, fieldNodes, info, path, result);
    var promise = getPromise(completed);
    if (promise) {
      // If `completeValueWithLocatedError` returned a rejected promise, log
      // the rejection error and resolve to null.
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return promise.then(undefined, function (error) {
        exeContext.errors.push(error);
        return Promise.resolve(null);
      });
    }
    return completed;
  } catch (error) {
    // If `completeValueWithLocatedError` returned abruptly (threw an error),
    // log the error and return null.
    exeContext.errors.push(error);
    return null;
  }
}

// This is a small wrapper around completeValue which annotates errors with
// location information.
function completeValueWithLocatedError(exeContext, returnType, fieldNodes, info, path, result) {
  try {
    var completed = completeValue(exeContext, returnType, fieldNodes, info, path, result);
    var promise = getPromise(completed);
    if (promise) {
      return promise.then(undefined, function (error) {
        return Promise.reject(locatedError(asErrorInstance(error), fieldNodes, responsePathAsArray(path)));
      });
    }
    return completed;
  } catch (error) {
    throw locatedError(asErrorInstance(error), fieldNodes, responsePathAsArray(path));
  }
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
function completeValue(exeContext, returnType, fieldNodes, info, path, result) {
  // If result is a Promise, apply-lift over completeValue.
  var promise = getPromise(result);
  if (promise) {
    return promise.then(function (resolved) {
      return completeValue(exeContext, returnType, fieldNodes, info, path, resolved);
    });
  }

  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw result;
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (isNonNullType(returnType)) {
    var completed = completeValue(exeContext, returnType.ofType, fieldNodes, info, path, result);
    if (completed === null) {
      throw new Error('Cannot return null for non-nullable field ' + info.parentType.name + '.' + info.fieldName + '.');
    }
    return completed;
  }

  // If result value is null-ish (null, undefined, or NaN) then return null.
  if (isNullish(result)) {
    return null;
  }

  // If field type is List, complete each item in the list with the inner type
  if (isListType(returnType)) {
    return completeListValue(exeContext, returnType, fieldNodes, info, path, result);
  }

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if (isLeafType(returnType)) {
    return completeLeafValue(returnType, result);
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (isAbstractType(returnType)) {
    return completeAbstractValue(exeContext, returnType, fieldNodes, info, path, result);
  }

  // If field type is Object, execute and complete all sub-selections.
  if (isObjectType(returnType)) {
    return completeObjectValue(exeContext, returnType, fieldNodes, info, path, result);
  }

  // Not reachable. All possible output types have been considered.
  /* istanbul ignore next */
  throw new Error('Cannot complete value of unexpected type "' + String(returnType) + '".');
}

/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(exeContext, returnType, fieldNodes, info, path, result) {
  !isCollection(result) ? invariant(0, 'Expected Iterable, but did not find one for field ' + info.parentType.name + '.' + info.fieldName + '.') : void 0;

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  var itemType = returnType.ofType;
  var containsPromise = false;
  var completedResults = [];
  forEach(result, function (item, index) {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    var fieldPath = addPath(path, index);
    var completedItem = completeValueCatchingError(exeContext, itemType, fieldNodes, info, fieldPath, item);

    if (!containsPromise && getPromise(completedItem)) {
      containsPromise = true;
    }
    completedResults.push(completedItem);
  });

  return containsPromise ? Promise.all(completedResults) : completedResults;
}

/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(returnType, result) {
  !returnType.serialize ? invariant(0, 'Missing serialize method on type') : void 0;
  var serializedResult = returnType.serialize(result);
  if (isInvalid(serializedResult)) {
    throw new Error('Expected a value of type "' + String(returnType) + '" but ' + ('received: ' + String(result)));
  }
  return serializedResult;
}

/**
 * Complete a value of an abstract type by determining the runtime object type
 * of that value, then complete the value for that type.
 */
function completeAbstractValue(exeContext, returnType, fieldNodes, info, path, result) {
  var runtimeType = returnType.resolveType ? returnType.resolveType(result, exeContext.contextValue, info) : defaultResolveTypeFn(result, exeContext.contextValue, info, returnType);

  var promise = getPromise(runtimeType);
  if (promise) {
    return promise.then(function (resolvedRuntimeType) {
      return completeObjectValue(exeContext, ensureValidRuntimeType(resolvedRuntimeType, exeContext, returnType, fieldNodes, info, result), fieldNodes, info, path, result);
    });
  }

  return completeObjectValue(exeContext, ensureValidRuntimeType(runtimeType, exeContext, returnType, fieldNodes, info, result), fieldNodes, info, path, result);
}

function ensureValidRuntimeType(runtimeTypeOrName, exeContext, returnType, fieldNodes, info, result) {
  var runtimeType = typeof runtimeTypeOrName === 'string' ? exeContext.schema.getType(runtimeTypeOrName) : runtimeTypeOrName;

  if (!isObjectType(runtimeType)) {
    throw new GraphQLError('Abstract type ' + returnType.name + ' must resolve to an Object type at ' + ('runtime for field ' + info.parentType.name + '.' + info.fieldName + ' with ') + ('value "' + String(result) + '", received "' + String(runtimeType) + '". ') + ('Either the ' + returnType.name + ' type should provide a "resolveType" ') + 'function or each possible types should provide an ' + '"isTypeOf" function.', fieldNodes);
  }

  if (!exeContext.schema.isPossibleType(returnType, runtimeType)) {
    throw new GraphQLError('Runtime Object type "' + runtimeType.name + '" is not a possible type ' + ('for "' + returnType.name + '".'), fieldNodes);
  }

  return runtimeType;
}

/**
 * Complete an Object value by executing all sub-selections.
 */
function completeObjectValue(exeContext, returnType, fieldNodes, info, path, result) {
  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf) {
    var isTypeOf = returnType.isTypeOf(result, exeContext.contextValue, info);

    var promise = getPromise(isTypeOf);
    if (promise) {
      return promise.then(function (isTypeOfResult) {
        if (!isTypeOfResult) {
          throw invalidReturnTypeError(returnType, result, fieldNodes);
        }
        return collectAndExecuteSubfields(exeContext, returnType, fieldNodes, info, path, result);
      });
    }

    if (!isTypeOf) {
      throw invalidReturnTypeError(returnType, result, fieldNodes);
    }
  }

  return collectAndExecuteSubfields(exeContext, returnType, fieldNodes, info, path, result);
}

function invalidReturnTypeError(returnType, result, fieldNodes) {
  return new GraphQLError('Expected value of type "' + returnType.name + '" but got: ' + String(result) + '.', fieldNodes);
}

function collectAndExecuteSubfields(exeContext, returnType, fieldNodes, info, path, result) {
  // Collect sub-fields to execute to complete this value.
  var subFieldNodes = Object.create(null);
  var visitedFragmentNames = Object.create(null);
  for (var i = 0; i < fieldNodes.length; i++) {
    var selectionSet = fieldNodes[i].selectionSet;
    if (selectionSet) {
      subFieldNodes = collectFields(exeContext, returnType, selectionSet, subFieldNodes, visitedFragmentNames);
    }
  }

  return executeFields(exeContext, returnType, result, path, subFieldNodes);
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
function defaultResolveTypeFn(value, context, info, abstractType) {
  // First, look for `__typename`.
  if (value !== null && (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object' && typeof value.__typename === 'string') {
    return value.__typename;
  }

  // Otherwise, test each possible type.
  var possibleTypes = info.schema.getPossibleTypes(abstractType);
  var promisedIsTypeOfResults = [];

  for (var i = 0; i < possibleTypes.length; i++) {
    var type = possibleTypes[i];

    if (type.isTypeOf) {
      var isTypeOfResult = type.isTypeOf(value, context, info);

      var promise = getPromise(isTypeOfResult);
      if (promise) {
        promisedIsTypeOfResults[i] = promise;
      } else if (isTypeOfResult) {
        return type;
      }
    }
  }

  if (promisedIsTypeOfResults.length) {
    return Promise.all(promisedIsTypeOfResults).then(function (isTypeOfResults) {
      for (var _i = 0; _i < isTypeOfResults.length; _i++) {
        if (isTypeOfResults[_i]) {
          return possibleTypes[_i];
        }
      }
    });
  }
}

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context.
 */
export var defaultFieldResolver = function defaultFieldResolver(source, args, context, info) {
  // ensure source is a value for which property access is acceptable.
  if ((typeof source === 'undefined' ? 'undefined' : _typeof(source)) === 'object' || typeof source === 'function') {
    var property = source[info.fieldName];
    if (typeof property === 'function') {
      return source[info.fieldName](args, context, info);
    }
    return property;
  }
};

/**
 * Only returns the value if it acts like a Promise, i.e. has a "then" function,
 * otherwise returns void.
 */
function getPromise(value) {
  if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object' && value !== null && typeof value.then === 'function') {
    return value;
  }
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
export function getFieldDef(schema, parentType, fieldName) {
  if (fieldName === SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
    return SchemaMetaFieldDef;
  } else if (fieldName === TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
    return TypeMetaFieldDef;
  } else if (fieldName === TypeNameMetaFieldDef.name) {
    return TypeNameMetaFieldDef;
  }
  return parentType.getFields()[fieldName];
}