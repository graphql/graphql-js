"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.subscribe = subscribe;
exports.createSourceEventStream = createSourceEventStream;

var _inspect = _interopRequireDefault(require("../jsutils/inspect.js"));

var _isAsyncIterable = _interopRequireDefault(require("../jsutils/isAsyncIterable.js"));

var _Path = require("../jsutils/Path.js");

var _GraphQLError = require("../error/GraphQLError.js");

var _locatedError = require("../error/locatedError.js");

var _values = require("../execution/values.js");

var _execute = require("../execution/execute.js");

var _getOperationRootType = require("../utilities/getOperationRootType.js");

var _mapAsyncIterator = _interopRequireDefault(require("./mapAsyncIterator.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function subscribe(argsOrSchema, document, rootValue, contextValue, variableValues, operationName, fieldResolver, subscribeFieldResolver) {
  /* eslint-enable no-redeclare */
  // Extract arguments from object args if provided.
  return arguments.length === 1 ? subscribeImpl(argsOrSchema) : subscribeImpl({
    schema: argsOrSchema,
    document: document,
    rootValue: rootValue,
    contextValue: contextValue,
    variableValues: variableValues,
    operationName: operationName,
    fieldResolver: fieldResolver,
    subscribeFieldResolver: subscribeFieldResolver
  });
}
/**
 * This function checks if the error is a GraphQLError. If it is, report it as
 * an ExecutionResult, containing only errors and no data. Otherwise treat the
 * error as a system-class error and re-throw it.
 */


function reportGraphQLError(error) {
  if (error instanceof _GraphQLError.GraphQLError) {
    return {
      errors: [error]
    };
  }

  throw error;
}

function subscribeImpl(args) {
  var schema = args.schema,
      document = args.document,
      rootValue = args.rootValue,
      contextValue = args.contextValue,
      variableValues = args.variableValues,
      operationName = args.operationName,
      fieldResolver = args.fieldResolver,
      subscribeFieldResolver = args.subscribeFieldResolver;
  var sourcePromise = createSourceEventStream(schema, document, rootValue, contextValue, variableValues, operationName, subscribeFieldResolver); // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  // This implements the "MapSourceToResponseEvent" algorithm described in
  // the GraphQL specification. The `execute` function provides the
  // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
  // "ExecuteQuery" algorithm, for which `execute` is also used.

  var mapSourceToResponse = function mapSourceToResponse(payload) {
    return (0, _execute.execute)({
      schema: schema,
      document: document,
      rootValue: payload,
      contextValue: contextValue,
      variableValues: variableValues,
      operationName: operationName,
      fieldResolver: fieldResolver
    });
  }; // Resolve the Source Stream, then map every source value to a
  // ExecutionResult value as described above.


  return sourcePromise.then(function (resultOrStream) {
    return (// Note: Flow can't refine isAsyncIterable, so explicit casts are used.
      (0, _isAsyncIterable.default)(resultOrStream) ? (0, _mapAsyncIterator.default)(resultOrStream, mapSourceToResponse, reportGraphQLError) : resultOrStream
    );
  });
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


function createSourceEventStream(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver) {
  // If arguments are missing or incorrectly typed, this is an internal
  // developer mistake which should throw an early error.
  (0, _execute.assertValidExecutionArguments)(schema, document, variableValues);
  return new Promise(function (resolve) {
    // If a valid context cannot be created due to incorrect arguments,
    // this will throw an error.
    var exeContext = (0, _execute.buildExecutionContext)(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver);
    resolve( // Return early errors if execution context failed.
    Array.isArray(exeContext) ? {
      errors: exeContext
    } : executeSubscription(exeContext));
  }).catch(reportGraphQLError);
}

function executeSubscription(exeContext) {
  var schema = exeContext.schema,
      operation = exeContext.operation,
      variableValues = exeContext.variableValues,
      rootValue = exeContext.rootValue;
  var type = (0, _getOperationRootType.getOperationRootType)(schema, operation);
  var fields = (0, _execute.collectFields)(exeContext, type, operation.selectionSet, Object.create(null), Object.create(null));
  var responseNames = Object.keys(fields);
  var responseName = responseNames[0];
  var fieldNodes = fields[responseName];
  var fieldNode = fieldNodes[0];
  var fieldName = fieldNode.name.value;
  var fieldDef = (0, _execute.getFieldDef)(schema, type, fieldName);

  if (!fieldDef) {
    throw new _GraphQLError.GraphQLError("The subscription field \"".concat(fieldName, "\" is not defined."), fieldNodes);
  }

  var path = (0, _Path.addPath)(undefined, responseName, type.name);
  var info = (0, _execute.buildResolveInfo)(exeContext, fieldDef, fieldNodes, type, path); // Coerce to Promise for easier error handling and consistent return type.

  return new Promise(function (resolveResult) {
    var _fieldDef$subscribe;

    // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
    // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    var args = (0, _values.getArgumentValues)(fieldDef, fieldNodes[0], variableValues); // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.

    var contextValue = exeContext.contextValue; // Call the `subscribe()` resolver or the default resolver to produce an
    // AsyncIterable yielding raw payloads.

    var resolveFn = (_fieldDef$subscribe = fieldDef.subscribe) !== null && _fieldDef$subscribe !== void 0 ? _fieldDef$subscribe : exeContext.fieldResolver;
    resolveResult(resolveFn(rootValue, args, contextValue, info));
  }).then(function (eventStream) {
    if (eventStream instanceof Error) {
      throw (0, _locatedError.locatedError)(eventStream, fieldNodes, (0, _Path.pathToArray)(path));
    } // Assert field returned an event stream, otherwise yield an error.


    if (!(0, _isAsyncIterable.default)(eventStream)) {
      throw new Error('Subscription field must return Async Iterable. ' + "Received: ".concat((0, _inspect.default)(eventStream), "."));
    }

    return eventStream;
  }, function (error) {
    throw (0, _locatedError.locatedError)(error, fieldNodes, (0, _Path.pathToArray)(path));
  });
}
