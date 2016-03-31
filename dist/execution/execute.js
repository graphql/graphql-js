'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

exports.execute = execute;

var _error = require('../error');

var _find = require('../jsutils/find');

var _find2 = _interopRequireDefault(_find);

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

var _typeFromAST = require('../utilities/typeFromAST');

var _language = require('../language');

var _values = require('./values');

var _definition = require('../type/definition');

var _schema = require('../type/schema');

var _introspection = require('../type/introspection');

var _directives = require('../type/directives');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Implements the "Evaluating requests" section of the GraphQL specification.
 *
 * Returns a Promise that will eventually be resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */


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
 * The result of execution. `data` is the result of executing the
 * query, `errors` is null if no errors occurred, and is a
 * non-empty array if an error occurred.
 */
function execute(schema, documentAST, rootValue, contextValue, variableValues, operationName) {
  (0, _invariant2.default)(schema, 'Must provide schema');
  (0, _invariant2.default)(schema instanceof _schema.GraphQLSchema, 'Schema must be an instance of GraphQLSchema. Also ensure that there are ' + 'not multiple versions of GraphQL installed in your node_modules directory.');

  // If a valid context cannot be created due to incorrect arguments,
  // this will throw an error.
  var context = buildExecutionContext(schema, documentAST, rootValue, contextValue, variableValues, operationName);

  // Return a Promise that will eventually resolve to the data described by
  // The "Response" section of the GraphQL specification.
  //
  // If errors are encountered while executing a GraphQL field, only that
  // field and its descendants will be omitted, and sibling fields will still
  // be executed. An execution which encounters errors will still result in a
  // resolved Promise.
  return new _promise2.default(function (resolve) {
    resolve(executeOperation(context, context.operation, rootValue));
  }).catch(function (error) {
    // Errors from sub-fields of a NonNull type may propagate to the top level,
    // at which point we still log the error and null the parent field, which
    // in this case is the entire response.
    context.errors.push(error);
    return null;
  }).then(function (data) {
    if (!context.errors.length) {
      return { data: data };
    }
    return { data: data, errors: context.errors };
  });
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function buildExecutionContext(schema, documentAST, rootValue, contextValue, rawVariableValues, operationName) {
  var errors = [];
  var operation = void 0;
  var fragments = (0, _create2.default)(null);
  documentAST.definitions.forEach(function (definition) {
    switch (definition.kind) {
      case _language.Kind.OPERATION_DEFINITION:
        if (!operationName && operation) {
          throw new _error.GraphQLError('Must provide operation name if query contains multiple operations.');
        }
        if (!operationName || definition.name && definition.name.value === operationName) {
          operation = definition;
        }
        break;
      case _language.Kind.FRAGMENT_DEFINITION:
        fragments[definition.name.value] = definition;
        break;
      default:
        throw new _error.GraphQLError('GraphQL cannot execute a request containing a ' + definition.kind + '.', definition);
    }
  });
  if (!operation) {
    if (operationName) {
      throw new _error.GraphQLError('Unknown operation named "' + operationName + '".');
    } else {
      throw new _error.GraphQLError('Must provide an operation.');
    }
  }
  var variableValues = (0, _values.getVariableValues)(schema, operation.variableDefinitions || [], rawVariableValues || {});

  return {
    schema: schema,
    fragments: fragments,
    rootValue: rootValue,
    contextValue: contextValue,
    operation: operation,
    variableValues: variableValues,
    errors: errors
  };
}

/**
 * Implements the "Evaluating operations" section of the spec.
 */
function executeOperation(exeContext, operation, rootValue) {
  var type = getOperationRootType(exeContext.schema, operation);
  var fields = collectFields(exeContext, type, operation.selectionSet, (0, _create2.default)(null), (0, _create2.default)(null));

  if (operation.operation === 'mutation') {
    return executeFieldsSerially(exeContext, type, rootValue, fields);
  }
  return executeFields(exeContext, type, rootValue, fields);
}

/**
 * Extracts the root type of the operation from the schema.
 */
function getOperationRootType(schema, operation) {
  switch (operation.operation) {
    case 'query':
      return schema.getQueryType();
    case 'mutation':
      var mutationType = schema.getMutationType();
      if (!mutationType) {
        throw new _error.GraphQLError('Schema is not configured for mutations', [operation]);
      }
      return mutationType;
    case 'subscription':
      var subscriptionType = schema.getSubscriptionType();
      if (!subscriptionType) {
        throw new _error.GraphQLError('Schema is not configured for subscriptions', [operation]);
      }
      return subscriptionType;
    default:
      throw new _error.GraphQLError('Can only execute queries, mutations and subscriptions', [operation]);
  }
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "write" mode.
 */
function executeFieldsSerially(exeContext, parentType, sourceValue, fields) {
  return (0, _keys2.default)(fields).reduce(function (prevPromise, responseName) {
    return prevPromise.then(function (results) {
      var fieldASTs = fields[responseName];
      var result = resolveField(exeContext, parentType, sourceValue, fieldASTs);
      if (result === undefined) {
        return results;
      }
      if (isThenable(result)) {
        return result.then(function (resolvedResult) {
          results[responseName] = resolvedResult;
          return results;
        });
      }
      results[responseName] = result;
      return results;
    });
  }, _promise2.default.resolve({}));
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "read" mode.
 */
function executeFields(exeContext, parentType, sourceValue, fields) {
  var containsPromise = false;

  var finalResults = (0, _keys2.default)(fields).reduce(function (results, responseName) {
    var fieldASTs = fields[responseName];
    var result = resolveField(exeContext, parentType, sourceValue, fieldASTs);
    if (result === undefined) {
      return results;
    }
    results[responseName] = result;
    if (isThenable(result)) {
      containsPromise = true;
    }
    return results;
  }, (0, _create2.default)(null));

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
 * returns and Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 */
function collectFields(exeContext, runtimeType, selectionSet, fields, visitedFragmentNames) {
  for (var i = 0; i < selectionSet.selections.length; i++) {
    var selection = selectionSet.selections[i];
    switch (selection.kind) {
      case _language.Kind.FIELD:
        if (!shouldIncludeNode(exeContext, selection.directives)) {
          continue;
        }
        var name = getFieldEntryKey(selection);
        if (!fields[name]) {
          fields[name] = [];
        }
        fields[name].push(selection);
        break;
      case _language.Kind.INLINE_FRAGMENT:
        if (!shouldIncludeNode(exeContext, selection.directives) || !doesFragmentConditionMatch(exeContext, selection, runtimeType)) {
          continue;
        }
        collectFields(exeContext, runtimeType, selection.selectionSet, fields, visitedFragmentNames);
        break;
      case _language.Kind.FRAGMENT_SPREAD:
        var fragName = selection.name.value;
        if (visitedFragmentNames[fragName] || !shouldIncludeNode(exeContext, selection.directives)) {
          continue;
        }
        visitedFragmentNames[fragName] = true;
        var fragment = exeContext.fragments[fragName];
        if (!fragment || !shouldIncludeNode(exeContext, fragment.directives) || !doesFragmentConditionMatch(exeContext, fragment, runtimeType)) {
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
function shouldIncludeNode(exeContext, directives) {
  var skipAST = directives && (0, _find2.default)(directives, function (directive) {
    return directive.name.value === _directives.GraphQLSkipDirective.name;
  });
  if (skipAST) {
    var _getArgumentValues = (0, _values.getArgumentValues)(_directives.GraphQLSkipDirective.args, skipAST.arguments, exeContext.variableValues);

    var skipIf = _getArgumentValues.if;

    return !skipIf;
  }

  var includeAST = directives && (0, _find2.default)(directives, function (directive) {
    return directive.name.value === _directives.GraphQLIncludeDirective.name;
  });
  if (includeAST) {
    var _getArgumentValues2 = (0, _values.getArgumentValues)(_directives.GraphQLIncludeDirective.args, includeAST.arguments, exeContext.variableValues);

    var includeIf = _getArgumentValues2.if;

    return Boolean(includeIf);
  }

  return true;
}

/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(exeContext, fragment, type) {
  var typeConditionAST = fragment.typeCondition;
  if (!typeConditionAST) {
    return true;
  }
  var conditionalType = (0, _typeFromAST.typeFromAST)(exeContext.schema, typeConditionAST);
  if (conditionalType === type) {
    return true;
  }
  if ((0, _definition.isAbstractType)(conditionalType)) {
    var abstractType = conditionalType;
    return exeContext.schema.isPossibleType(abstractType, type);
  }
  return false;
}

/**
 * This function transforms a JS object `{[key: string]: Promise<T>}` into
 * a `Promise<{[key: string]: T}>`
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 */
function promiseForObject(object) {
  var keys = (0, _keys2.default)(object);
  var valuesAndPromises = keys.map(function (name) {
    return object[name];
  });
  return _promise2.default.all(valuesAndPromises).then(function (values) {
    return values.reduce(function (resolvedObject, value, i) {
      resolvedObject[keys[i]] = value;
      return resolvedObject;
    }, (0, _create2.default)(null));
  });
}

/**
 * Implements the logic to compute the key of a given field’s entry
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
function resolveField(exeContext, parentType, source, fieldASTs) {
  var fieldAST = fieldASTs[0];
  var fieldName = fieldAST.name.value;

  var fieldDef = getFieldDef(exeContext.schema, parentType, fieldName);
  if (!fieldDef) {
    return;
  }

  var returnType = fieldDef.type;
  var resolveFn = fieldDef.resolve || defaultResolveFn;

  // Build a JS object of arguments from the field.arguments AST, using the
  // variables scope to fulfill any variable references.
  // TODO: find a way to memoize, in case this field is within a List type.
  var args = (0, _values.getArgumentValues)(fieldDef.args, fieldAST.arguments, exeContext.variableValues);

  // The resolve function's optional third argument is a context value that
  // is provided to every resolve function within an execution. It is commonly
  // used to represent an authenticated user, or request-specific caches.
  var context = exeContext.contextValue;

  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  var info = {
    fieldName: fieldName,
    fieldASTs: fieldASTs,
    returnType: returnType,
    parentType: parentType,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues
  };

  // Get the resolve function, regardless of if its result is normal
  // or abrupt (error).
  var result = resolveOrError(resolveFn, source, args, context, info);

  return completeValueCatchingError(exeContext, returnType, fieldASTs, info, result);
}

// Isolates the "ReturnOrAbrupt" behavior to not de-opt the `resolveField`
// function. Returns the result of resolveFn or the abrupt-return Error object.
function resolveOrError(resolveFn, source, args, context, info) {
  try {
    return resolveFn(source, args, context, info);
  } catch (error) {
    // Sometimes a non-error is thrown, wrap it as an Error for a
    // consistent interface.
    return error instanceof Error ? error : new Error(error);
  }
}

// This is a small wrapper around completeValue which detects and logs errors
// in the execution context.
function completeValueCatchingError(exeContext, returnType, fieldASTs, info, result) {
  // If the field type is non-nullable, then it is resolved without any
  // protection from errors.
  if (returnType instanceof _definition.GraphQLNonNull) {
    return completeValue(exeContext, returnType, fieldASTs, info, result);
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  try {
    var completed = completeValue(exeContext, returnType, fieldASTs, info, result);
    if (isThenable(completed)) {
      // If `completeValue` returned a rejected promise, log the rejection
      // error and resolve to null.
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(undefined, function (error) {
        exeContext.errors.push(error);
        return _promise2.default.resolve(null);
      });
    }
    return completed;
  } catch (error) {
    // If `completeValue` returned abruptly (threw an error), log the error
    // and return null.
    exeContext.errors.push(error);
    return null;
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
function completeValue(exeContext, returnType, fieldASTs, info, result) {
  // If result is a Promise, apply-lift over completeValue.
  if (isThenable(result)) {
    return result.then(
    // Once resolved to a value, complete that value.
    function (resolved) {
      return completeValue(exeContext, returnType, fieldASTs, info, resolved);
    },
    // If rejected, create a located error, and continue to reject.
    function (error) {
      return _promise2.default.reject((0, _error.locatedError)(error, fieldASTs));
    });
  }

  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw (0, _error.locatedError)(result, fieldASTs);
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (returnType instanceof _definition.GraphQLNonNull) {
    var completed = completeValue(exeContext, returnType.ofType, fieldASTs, info, result);
    if (completed === null) {
      throw new _error.GraphQLError('Cannot return null for non-nullable field ' + info.parentType + '.' + info.fieldName + '.', fieldASTs);
    }
    return completed;
  }

  // If result value is null-ish (null, undefined, or NaN) then return null.
  if ((0, _isNullish2.default)(result)) {
    return null;
  }

  // If field type is List, complete each item in the list with the inner type
  if (returnType instanceof _definition.GraphQLList) {
    return completeListValue(exeContext, returnType, fieldASTs, info, result);
  }

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if (returnType instanceof _definition.GraphQLScalarType || returnType instanceof _definition.GraphQLEnumType) {
    return completeLeafValue(returnType, result);
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (returnType instanceof _definition.GraphQLInterfaceType || returnType instanceof _definition.GraphQLUnionType) {
    return completeAbstractValue(exeContext, returnType, fieldASTs, info, result);
  }

  // If field type is Object, execute and complete all sub-selections.
  if (returnType instanceof _definition.GraphQLObjectType) {
    return completeObjectValue(exeContext, returnType, fieldASTs, info, result);
  }

  // Not reachable. All possible output types have been considered.
  (0, _invariant2.default)(false, 'Cannot complete value of unexpected type "' + returnType + '".');
}

/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(exeContext, returnType, fieldASTs, info, result) {
  (0, _invariant2.default)(Array.isArray(result), 'User Error: expected iterable, but did not find one for field ' + info.parentType + '.' + info.fieldName + '.');

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  var itemType = returnType.ofType;
  var containsPromise = false;
  var completedResults = result.map(function (item) {
    var completedItem = completeValueCatchingError(exeContext, itemType, fieldASTs, info, item);
    if (!containsPromise && isThenable(completedItem)) {
      containsPromise = true;
    }
    return completedItem;
  });

  return containsPromise ? _promise2.default.all(completedResults) : completedResults;
}

/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(returnType, result) {
  (0, _invariant2.default)(returnType.serialize, 'Missing serialize method on type');
  var serializedResult = returnType.serialize(result);
  return (0, _isNullish2.default)(serializedResult) ? null : serializedResult;
}

/**
 * Complete a value of an abstract type by determining the runtime object type
 * of that value, then complete the value for that type.
 */
function completeAbstractValue(exeContext, returnType, fieldASTs, info, result) {
  var runtimeType = returnType.resolveType ? returnType.resolveType(result, exeContext.contextValue, info) : defaultResolveTypeFn(result, exeContext.contextValue, info, returnType);

  if (!runtimeType) {
    return null;
  }

  var schema = exeContext.schema;
  if (runtimeType && !schema.isPossibleType(returnType, runtimeType)) {
    throw new _error.GraphQLError('Runtime Object type "' + runtimeType + '" is not a possible type ' + ('for "' + returnType + '".'), fieldASTs);
  }

  return completeObjectValue(exeContext, runtimeType, fieldASTs, info, result);
}

/**
 * Complete an Object value by executing all sub-selections.
 */
function completeObjectValue(exeContext, returnType, fieldASTs, info, result) {
  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf && !returnType.isTypeOf(result, exeContext.contextValue, info)) {
    throw new _error.GraphQLError('Expected value of type "' + returnType + '" but got: ' + result + '.', fieldASTs);
  }

  // Collect sub-fields to execute to complete this value.
  var subFieldASTs = (0, _create2.default)(null);
  var visitedFragmentNames = (0, _create2.default)(null);
  for (var i = 0; i < fieldASTs.length; i++) {
    var selectionSet = fieldASTs[i].selectionSet;
    if (selectionSet) {
      subFieldASTs = collectFields(exeContext, returnType, selectionSet, subFieldASTs, visitedFragmentNames);
    }
  }

  return executeFields(exeContext, returnType, result, subFieldASTs);
}

/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which tests each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */
function defaultResolveTypeFn(value, context, info, abstractType) {
  var possibleTypes = info.schema.getPossibleTypes(abstractType);
  for (var i = 0; i < possibleTypes.length; i++) {
    var type = possibleTypes[i];
    if (type.isTypeOf && type.isTypeOf(value, context, info)) {
      return type;
    }
  }
}

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function.
 */
function defaultResolveFn(source, args, context, _ref) {
  var fieldName = _ref.fieldName;

  // ensure source is a value for which property access is acceptable.
  if ((typeof source === 'undefined' ? 'undefined' : (0, _typeof3.default)(source)) === 'object' || typeof source === 'function') {
    var property = source[fieldName];
    return typeof property === 'function' ? source[fieldName]() : property;
  }
}

/**
 * Checks to see if this object acts like a Promise, i.e. has a "then"
 * function.
 */
function isThenable(value) {
  return (typeof value === 'undefined' ? 'undefined' : (0, _typeof3.default)(value)) === 'object' && value !== null && typeof value.then === 'function';
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
function getFieldDef(schema, parentType, fieldName) {
  if (fieldName === _introspection.SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
    return _introspection.SchemaMetaFieldDef;
  } else if (fieldName === _introspection.TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
    return _introspection.TypeMetaFieldDef;
  } else if (fieldName === _introspection.TypeNameMetaFieldDef.name) {
    return _introspection.TypeNameMetaFieldDef;
  }
  return parentType.getFields()[fieldName];
}