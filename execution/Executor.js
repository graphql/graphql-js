"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Executor = exports.getStreamUsage = exports.collectSubfields = void 0;
const inspect_ts_1 = require("../jsutils/inspect.js");
const invariant_ts_1 = require("../jsutils/invariant.js");
const isAsyncIterable_ts_1 = require("../jsutils/isAsyncIterable.js");
const isIterableObject_ts_1 = require("../jsutils/isIterableObject.js");
const isPromise_ts_1 = require("../jsutils/isPromise.js");
const memoize2_ts_1 = require("../jsutils/memoize2.js");
const memoize3_ts_1 = require("../jsutils/memoize3.js");
const Path_ts_1 = require("../jsutils/Path.js");
const promiseForObject_ts_1 = require("../jsutils/promiseForObject.js");
const promiseReduce_ts_1 = require("../jsutils/promiseReduce.js");
const ensureGraphQLError_ts_1 = require("../error/ensureGraphQLError.js");
const GraphQLError_ts_1 = require("../error/GraphQLError.js");
const locatedError_ts_1 = require("../error/locatedError.js");
const ast_ts_1 = require("../language/ast.js");
const definition_ts_1 = require("../type/definition.js");
const diagnostics_ts_1 = require("../diagnostics.js");
const AbortedGraphQLExecutionError_ts_1 = require("./AbortedGraphQLExecutionError.js");
const buildResolveInfo_ts_1 = require("./buildResolveInfo.js");
const cancellablePromise_ts_1 = require("./cancellablePromise.js");
const collectFields_ts_1 = require("./collectFields.js");
const collectIteratorPromises_ts_1 = require("./collectIteratorPromises.js");
const createSharedExecutionContext_ts_1 = require("./createSharedExecutionContext.js");
const getStreamUsage_ts_1 = require("./getStreamUsage.js");
const hooks_ts_1 = require("./hooks.js");
const returnIteratorCatchingErrors_ts_1 = require("./returnIteratorCatchingErrors.js");
const values_ts_1 = require("./values.js");
exports.collectSubfields = (0, memoize3_ts_1.memoize3)((validatedExecutionArgs, returnType, fieldDetailsList) => {
    const { schema, fragments, variableValues, hideSuggestions } = validatedExecutionArgs;
    return (0, collectFields_ts_1.collectSubfields)(schema, fragments, variableValues, returnType, fieldDetailsList, hideSuggestions);
});
exports.getStreamUsage = (0, memoize2_ts_1.memoize2)((validatedExecutionArgs, fieldDetailsList) => (0, getStreamUsage_ts_1.getStreamUsage)(validatedExecutionArgs, fieldDetailsList));
class CollectedErrors {
    constructor() {
        this._errorPositions = new Set();
        this._errors = [];
    }
    get errors() {
        return this._errors;
    }
    add(error, path) {
        if (this.hasNulledPosition(path)) {
            return;
        }
        this._errorPositions.add(path);
        this._errors.push(error);
    }
    hasNulledPosition(startPath) {
        let path = startPath;
        while (path !== undefined) {
            if (this._errorPositions.has(path)) {
                return true;
            }
            path = path.prev;
        }
        return this._errorPositions.has(undefined);
    }
}
const defaultAbortReason = new Error('This operation was aborted');
class Executor {
    constructor(validatedExecutionArgs, sharedExecutionContext) {
        this.validatedExecutionArgs = validatedExecutionArgs;
        this.aborted = false;
        this.abortReason = defaultAbortReason;
        this.collectedErrors = new CollectedErrors();
        if (sharedExecutionContext === undefined) {
            this.resolverAbortController = new AbortController();
            this.sharedExecutionContext = (0, createSharedExecutionContext_ts_1.createSharedExecutionContext)(this.resolverAbortController.signal);
        }
        else {
            this.sharedExecutionContext = sharedExecutionContext;
        }
        const { getAbortSignal, getAsyncHelpers, promiseAll } = this.sharedExecutionContext;
        this.getAbortSignal = getAbortSignal;
        this.getAsyncHelpers = getAsyncHelpers;
        this.promiseAll = promiseAll;
    }
    executeRootSelectionSet(serially) {
        if (!(0, diagnostics_ts_1.shouldTrace)(diagnostics_ts_1.executeRootSelectionSetChannel)) {
            return this.executeRootSelectionSetImpl(serially);
        }
        return (0, diagnostics_ts_1.traceMixed)(diagnostics_ts_1.executeRootSelectionSetChannel, this.buildExecuteContextFromValidatedArgs(this.validatedExecutionArgs), () => this.executeRootSelectionSetImpl(serially));
    }
    buildExecuteContextFromValidatedArgs(args) {
        return {
            schema: args.schema,
            document: args.document,
            operation: args.operation,
            rawVariableValues: args.rawVariableValues,
            operationName: args.operation.name?.value,
            operationType: args.operation.operation,
        };
    }
    executeRootSelectionSetImpl(serially) {
        const externalAbortSignal = this.validatedExecutionArgs.externalAbortSignal;
        let removeExternalAbortListener;
        if (externalAbortSignal) {
            externalAbortSignal.throwIfAborted();
            const onExternalAbort = () => {
                this.abort(externalAbortSignal.reason);
            };
            removeExternalAbortListener = () => externalAbortSignal.removeEventListener('abort', onExternalAbort);
            externalAbortSignal.addEventListener('abort', onExternalAbort);
        }
        const maybeRemoveExternalAbortListener = () => {
            removeExternalAbortListener?.();
        };
        let result;
        try {
            const { schema, fragments, rootValue, operation, variableValues, hideSuggestions, } = this.validatedExecutionArgs;
            const { operation: operationType, selectionSet } = operation;
            const rootType = schema.getRootType(operationType);
            if (rootType == null) {
                throw new GraphQLError_ts_1.GraphQLError(`Schema is not configured to execute ${operationType} operation.`, { nodes: operation });
            }
            const { groupedFieldSet, newDeferUsages } = (0, collectFields_ts_1.collectFields)(schema, fragments, variableValues, rootType, selectionSet, hideSuggestions);
            result = this.executeCollectedRootFields(rootType, rootValue, groupedFieldSet, serially ?? operationType === ast_ts_1.OperationTypeNode.MUTATION, newDeferUsages);
            if ((0, isPromise_ts_1.isPromiseLike)(result)) {
                const promise = result.then((data) => {
                    maybeRemoveExternalAbortListener();
                    return this.buildResponse(data);
                }, (error) => {
                    maybeRemoveExternalAbortListener();
                    this.collectedErrors.add((0, ensureGraphQLError_ts_1.ensureGraphQLError)(error), undefined);
                    return this.buildResponse(null);
                });
                this.sharedExecutionContext.asyncWorkTracker.add(promise);
                const { promise: cancellablePromise, abort: abortResultPromise } = (0, cancellablePromise_ts_1.withCancellation)(promise.then((resolved) => this.finish(resolved)));
                this.abortResultPromise = () => {
                    abortResultPromise(this.createAbortedExecutionError(promise));
                };
                if (this.aborted) {
                    this.abortResultPromise();
                }
                return cancellablePromise;
            }
            maybeRemoveExternalAbortListener();
        }
        catch (error) {
            maybeRemoveExternalAbortListener();
            this.collectedErrors.add((0, ensureGraphQLError_ts_1.ensureGraphQLError)(error), undefined);
            return this.finish(this.buildResponse(null));
        }
        return this.finish(this.buildResponse(result));
    }
    abort(reason) {
        if (this.aborted) {
            return;
        }
        this.aborted = true;
        if (reason !== undefined) {
            this.abortReason = reason;
        }
        this.abortResultPromise?.();
        this.resolverAbortController?.abort(this.abortReason);
    }
    finish(result) {
        if (this.aborted) {
            throw this.createAbortedExecutionError(result);
        }
        this.aborted = true;
        return result;
    }
    createAbortedExecutionError(result) {
        return new AbortedGraphQLExecutionError_ts_1.AbortedGraphQLExecutionError(this.abortReason, result);
    }
    getFinishSharedExecution() {
        const resolverAbortController = this.resolverAbortController;
        const asyncWorkFinishedHook = this.validatedExecutionArgs.hooks?.asyncWorkFinished;
        if (asyncWorkFinishedHook === undefined) {
            return () => resolverAbortController?.abort();
        }
        const validatedExecutionArgs = this.validatedExecutionArgs;
        const sharedExecutionContext = this.sharedExecutionContext;
        return () => {
            resolverAbortController?.abort();
            (0, hooks_ts_1.runAsyncWorkFinishedHook)(validatedExecutionArgs, sharedExecutionContext, asyncWorkFinishedHook);
        };
    }
    buildResponse(data) {
        this.getFinishSharedExecution()();
        const errors = this.collectedErrors.errors;
        return errors.length ? { errors, data } : { data };
    }
    executeCollectedRootFields(rootType, rootValue, originalGroupedFieldSet, serially, _newDeferUsages) {
        return this.executeRootGroupedFieldSet(rootType, rootValue, originalGroupedFieldSet, serially, undefined);
    }
    executeRootGroupedFieldSet(rootType, rootValue, groupedFieldSet, serially, positionContext) {
        return serially
            ? this.executeFieldsSerially(rootType, rootValue, undefined, groupedFieldSet, positionContext)
            : this.executeFields(rootType, rootValue, undefined, groupedFieldSet, positionContext);
    }
    executeFieldsSerially(parentType, sourceValue, path, groupedFieldSet, positionContext) {
        let tracingChannel = (0, diagnostics_ts_1.shouldTrace)(diagnostics_ts_1.resolveChannel)
            ? diagnostics_ts_1.resolveChannel
            : undefined;
        return (0, promiseReduce_ts_1.promiseReduce)(groupedFieldSet, (results, [responseName, fieldDetailsList]) => {
            if (this.aborted) {
                throw new Error('Aborted!');
            }
            const fieldPath = (0, Path_ts_1.addPath)(path, responseName, parentType.name);
            const result = this.executeField(parentType, sourceValue, fieldDetailsList, fieldPath, positionContext, tracingChannel);
            if (result === undefined) {
                return results;
            }
            if ((0, isPromise_ts_1.isPromiseLike)(result)) {
                return result.then((resolved) => {
                    results[responseName] = resolved;
                    tracingChannel = (0, diagnostics_ts_1.shouldTrace)(diagnostics_ts_1.resolveChannel)
                        ? diagnostics_ts_1.resolveChannel
                        : undefined;
                    return results;
                });
            }
            results[responseName] = result;
            return results;
        }, Object.create(null));
    }
    executeFields(parentType, sourceValue, path, groupedFieldSet, positionContext) {
        const results = Object.create(null);
        let containsPromise = false;
        const tracingChannel = (0, diagnostics_ts_1.shouldTrace)(diagnostics_ts_1.resolveChannel)
            ? diagnostics_ts_1.resolveChannel
            : undefined;
        try {
            for (const [responseName, fieldDetailsList] of groupedFieldSet) {
                const fieldPath = (0, Path_ts_1.addPath)(path, responseName, parentType.name);
                const result = this.executeField(parentType, sourceValue, fieldDetailsList, fieldPath, positionContext, tracingChannel);
                if (result !== undefined) {
                    results[responseName] = result;
                    if ((0, isPromise_ts_1.isPromiseLike)(result)) {
                        containsPromise = true;
                    }
                }
            }
        }
        catch (error) {
            if (containsPromise) {
                this.sharedExecutionContext.asyncWorkTracker.addValues(Object.values(results));
            }
            throw error;
        }
        if (!containsPromise) {
            return results;
        }
        return (0, promiseForObject_ts_1.promiseForObject)(results, this.promiseAll);
    }
    executeField(parentType, source, fieldDetailsList, path, positionContext, tracingChannel) {
        const validatedExecutionArgs = this.validatedExecutionArgs;
        const { schema, contextValue, variableValues, hideSuggestions } = validatedExecutionArgs;
        const firstFieldDetails = fieldDetailsList[0];
        const firstNode = firstFieldDetails.node;
        const fieldName = firstNode.name.value;
        const fieldDef = schema.getField(parentType, fieldName);
        if (!fieldDef) {
            return;
        }
        const returnType = fieldDef.type;
        let resolveFn = fieldDef.resolve ?? validatedExecutionArgs.fieldResolver;
        if (tracingChannel !== undefined) {
            const originalResolveFn = resolveFn;
            resolveFn = (s, args, c, info) => (0, diagnostics_ts_1.traceMixed)(tracingChannel, this.buildResolveContext(args, info, fieldDef.resolve === undefined), () => originalResolveFn(s, args, c, info));
        }
        const info = (0, buildResolveInfo_ts_1.buildResolveInfo)(validatedExecutionArgs, fieldDef, toNodes(fieldDetailsList), parentType, path, this.getAbortSignal, this.getAsyncHelpers);
        try {
            const args = (0, values_ts_1.getArgumentValues)(fieldDef, firstNode, variableValues, firstFieldDetails.fragmentVariableValues, hideSuggestions);
            const result = resolveFn(source, args, contextValue, info);
            if ((0, isPromise_ts_1.isPromiseLike)(result)) {
                return this.completePromisedValue(returnType, fieldDetailsList, info, path, result, positionContext);
            }
            const completed = this.completeValue(returnType, fieldDetailsList, info, path, result, positionContext);
            if ((0, isPromise_ts_1.isPromiseLike)(completed)) {
                return completed.then(undefined, (rawError) => {
                    this.handleFieldError(rawError, returnType, fieldDetailsList, path);
                    return null;
                });
            }
            return completed;
        }
        catch (rawError) {
            this.handleFieldError(rawError, returnType, fieldDetailsList, path);
            return null;
        }
    }
    buildResolveContext(args, info, isDefaultResolver) {
        let cachedFieldPath;
        return {
            fieldName: info.fieldName,
            alias: String(info.path.key),
            parentType: info.parentType.name,
            fieldType: String(info.returnType),
            args,
            isDefaultResolver,
            get fieldPath() {
                cachedFieldPath ??= (0, Path_ts_1.pathToArray)(info.path).join('.');
                return cachedFieldPath;
            },
        };
    }
    handleFieldError(rawError, returnType, fieldDetailsList, path) {
        const error = (0, locatedError_ts_1.locatedError)(rawError, toNodes(fieldDetailsList), (0, Path_ts_1.pathToArray)(path));
        if (this.validatedExecutionArgs.errorPropagation &&
            (0, definition_ts_1.isNonNullType)(returnType)) {
            throw error;
        }
        this.collectedErrors.add(error, path);
    }
    completeValue(returnType, fieldDetailsList, info, path, result, positionContext) {
        if (result instanceof Error) {
            throw result;
        }
        if ((0, definition_ts_1.isNonNullType)(returnType)) {
            const completed = this.completeValue(returnType.ofType, fieldDetailsList, info, path, result, positionContext);
            if (completed === null) {
                throw new Error(`Cannot return null for non-nullable field ${info.parentType}.${info.fieldName}.`);
            }
            return completed;
        }
        if (result == null) {
            return null;
        }
        if ((0, definition_ts_1.isListType)(returnType)) {
            return this.completeListValue(returnType, fieldDetailsList, info, path, result, positionContext);
        }
        if ((0, definition_ts_1.isLeafType)(returnType)) {
            return this.completeLeafValue(returnType, result);
        }
        if ((0, definition_ts_1.isAbstractType)(returnType)) {
            return this.completeAbstractValue(returnType, fieldDetailsList, info, path, result, positionContext);
        }
        if ((0, definition_ts_1.isObjectType)(returnType)) {
            return this.completeObjectValue(returnType, fieldDetailsList, info, path, result, positionContext);
        }
        (0, invariant_ts_1.invariant)(false, 'Cannot complete value of unexpected output type: ' + (0, inspect_ts_1.inspect)(returnType));
    }
    async completePromisedValue(returnType, fieldDetailsList, info, path, result, positionContext) {
        try {
            const resolved = await result;
            if (this.aborted) {
                throw new Error('Aborted!');
            }
            let completed = this.completeValue(returnType, fieldDetailsList, info, path, resolved, positionContext);
            if ((0, isPromise_ts_1.isPromiseLike)(completed)) {
                completed = await completed;
            }
            return completed;
        }
        catch (rawError) {
            this.handleFieldError(rawError, returnType, fieldDetailsList, path);
            return null;
        }
    }
    async completeAsyncIterableValue(itemType, fieldDetailsList, info, path, items, positionContext) {
        const streamUsage = typeof path.key === 'number'
            ? undefined
            : (0, exports.getStreamUsage)(this.validatedExecutionArgs, fieldDetailsList);
        let containsPromise = false;
        const completedResults = [];
        const asyncIterator = items[Symbol.asyncIterator]();
        let index = 0;
        let iteration;
        try {
            while (true) {
                if (streamUsage?.initialCount === index &&
                    this.handleStream(index, path, { handle: asyncIterator, isAsync: true }, streamUsage, info, itemType)) {
                    break;
                }
                const itemPath = (0, Path_ts_1.addPath)(path, index, undefined);
                try {
                    iteration = await asyncIterator.next();
                }
                catch (rawError) {
                    throw (0, locatedError_ts_1.locatedError)(rawError, toNodes(fieldDetailsList), (0, Path_ts_1.pathToArray)(path));
                }
                if (this.aborted || iteration.done) {
                    break;
                }
                const item = iteration.value;
                if (this.completeMaybePromisedListItemValue(item, completedResults, itemType, fieldDetailsList, info, itemPath, positionContext)) {
                    containsPromise = true;
                }
                index++;
            }
        }
        catch (error) {
            this.sharedExecutionContext.asyncWorkTracker.add((0, returnIteratorCatchingErrors_ts_1.returnIteratorCatchingErrors)(asyncIterator));
            if (containsPromise) {
                this.sharedExecutionContext.asyncWorkTracker.addValues(completedResults);
            }
            throw error;
        }
        if (this.aborted) {
            if (!iteration?.done) {
                this.sharedExecutionContext.asyncWorkTracker.add((0, returnIteratorCatchingErrors_ts_1.returnIteratorCatchingErrors)(asyncIterator));
            }
            throw new Error('Aborted!');
        }
        return containsPromise
            ? this.promiseAll(completedResults)
            : completedResults;
    }
    handleStream(_index, _path, _iterator, _streamUsage, _info, _itemType) {
        return false;
    }
    completeListValue(returnType, fieldDetailsList, info, path, result, positionContext) {
        const itemType = returnType.ofType;
        if ((0, isAsyncIterable_ts_1.isAsyncIterable)(result)) {
            return this.completeAsyncIterableValue(itemType, fieldDetailsList, info, path, result, positionContext);
        }
        if (!(0, isIterableObject_ts_1.isIterableObject)(result)) {
            throw new GraphQLError_ts_1.GraphQLError(`Expected Iterable, but did not find one for field "${info.parentType}.${info.fieldName}".`);
        }
        return this.completeIterableValue(itemType, fieldDetailsList, info, path, result, positionContext);
    }
    completeIterableValue(itemType, fieldDetailsList, info, path, items, positionContext) {
        const streamUsage = typeof path.key === 'number'
            ? undefined
            : (0, exports.getStreamUsage)(this.validatedExecutionArgs, fieldDetailsList);
        let containsPromise = false;
        const completedResults = [];
        let index = 0;
        const iterator = items[Symbol.iterator]();
        try {
            while (true) {
                if (streamUsage?.initialCount === index &&
                    this.handleStream(index, path, { handle: iterator }, streamUsage, info, itemType)) {
                    break;
                }
                const iteration = iterator.next();
                if (iteration.done) {
                    break;
                }
                const item = iteration.value;
                const itemPath = (0, Path_ts_1.addPath)(path, index, undefined);
                if (this.completeMaybePromisedListItemValue(item, completedResults, itemType, fieldDetailsList, info, itemPath, positionContext)) {
                    containsPromise = true;
                }
                index++;
            }
        }
        catch (error) {
            const asyncWorkTracker = this.sharedExecutionContext.asyncWorkTracker;
            if (containsPromise) {
                asyncWorkTracker.addValues(completedResults);
            }
            asyncWorkTracker.addValues((0, collectIteratorPromises_ts_1.collectIteratorPromises)(iterator));
            throw error;
        }
        return containsPromise
            ? this.promiseAll(completedResults)
            : completedResults;
    }
    completeMaybePromisedListItemValue(item, completedResults, itemType, fieldDetailsList, info, itemPath, positionContext) {
        if ((0, isPromise_ts_1.isPromiseLike)(item)) {
            completedResults.push(this.completePromisedListItemValue(item, itemType, fieldDetailsList, info, itemPath, positionContext));
            return true;
        }
        else if (this.completeListItemValue(item, completedResults, itemType, fieldDetailsList, info, itemPath, positionContext)) {
            return true;
        }
        return false;
    }
    completeListItemValue(item, completedResults, itemType, fieldDetailsList, info, itemPath, positionContext) {
        try {
            const completedItem = this.completeValue(itemType, fieldDetailsList, info, itemPath, item, positionContext);
            if ((0, isPromise_ts_1.isPromiseLike)(completedItem)) {
                completedResults.push(completedItem.then(undefined, (rawError) => {
                    this.handleFieldError(rawError, itemType, fieldDetailsList, itemPath);
                    return null;
                }));
                return true;
            }
            completedResults.push(completedItem);
        }
        catch (rawError) {
            this.handleFieldError(rawError, itemType, fieldDetailsList, itemPath);
            completedResults.push(null);
        }
        return false;
    }
    async completePromisedListItemValue(item, itemType, fieldDetailsList, info, itemPath, positionContext) {
        try {
            const resolved = await item;
            if (this.aborted) {
                throw new Error('Aborted!');
            }
            let completed = this.completeValue(itemType, fieldDetailsList, info, itemPath, resolved, positionContext);
            if ((0, isPromise_ts_1.isPromiseLike)(completed)) {
                completed = await completed;
            }
            return completed;
        }
        catch (rawError) {
            this.handleFieldError(rawError, itemType, fieldDetailsList, itemPath);
            return null;
        }
    }
    completeLeafValue(returnType, result) {
        const coerced = returnType.coerceOutputValue(result);
        if (coerced == null) {
            throw new Error(`Expected \`${(0, inspect_ts_1.inspect)(returnType)}.coerceOutputValue(${(0, inspect_ts_1.inspect)(result)})\` to ` +
                `return non-nullable value, returned: ${(0, inspect_ts_1.inspect)(coerced)}`);
        }
        return coerced;
    }
    completeAbstractValue(returnType, fieldDetailsList, info, path, result, positionContext) {
        const validatedExecutionArgs = this.validatedExecutionArgs;
        const { schema, contextValue } = validatedExecutionArgs;
        const resolveTypeFn = returnType.resolveType ?? validatedExecutionArgs.typeResolver;
        const runtimeType = resolveTypeFn(result, contextValue, info, returnType);
        if ((0, isPromise_ts_1.isPromiseLike)(runtimeType)) {
            return runtimeType.then((resolvedRuntimeType) => {
                if (this.aborted) {
                    throw new Error('Aborted!');
                }
                return this.completeObjectValue(this.ensureValidRuntimeType(resolvedRuntimeType, schema, returnType, fieldDetailsList, info, result), fieldDetailsList, info, path, result, positionContext);
            });
        }
        return this.completeObjectValue(this.ensureValidRuntimeType(runtimeType, schema, returnType, fieldDetailsList, info, result), fieldDetailsList, info, path, result, positionContext);
    }
    ensureValidRuntimeType(runtimeTypeName, schema, returnType, fieldDetailsList, info, result) {
        if (runtimeTypeName == null) {
            throw new GraphQLError_ts_1.GraphQLError(`Abstract type "${returnType}" must resolve to an Object type at runtime for field "${info.parentType}.${info.fieldName}". Either the "${returnType}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`, { nodes: toNodes(fieldDetailsList) });
        }
        if (typeof runtimeTypeName !== 'string') {
            throw new GraphQLError_ts_1.GraphQLError(`Abstract type "${returnType}" must resolve to an Object type at runtime for field "${info.parentType}.${info.fieldName}" with ` +
                `value ${(0, inspect_ts_1.inspect)(result)}, received "${(0, inspect_ts_1.inspect)(runtimeTypeName)}", which is not a valid Object type name.`);
        }
        const runtimeType = schema.getType(runtimeTypeName);
        if (runtimeType == null) {
            throw new GraphQLError_ts_1.GraphQLError(`Abstract type "${returnType}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`, { nodes: toNodes(fieldDetailsList) });
        }
        if (!(0, definition_ts_1.isObjectType)(runtimeType)) {
            throw new GraphQLError_ts_1.GraphQLError(`Abstract type "${returnType}" was resolved to a non-object type "${runtimeTypeName}".`, { nodes: toNodes(fieldDetailsList) });
        }
        if (!schema.isSubType(returnType, runtimeType)) {
            throw new GraphQLError_ts_1.GraphQLError(`Runtime Object type "${runtimeType}" is not a possible type for "${returnType}".`, { nodes: toNodes(fieldDetailsList) });
        }
        return runtimeType;
    }
    completeObjectValue(returnType, fieldDetailsList, info, path, result, positionContext) {
        if (returnType.isTypeOf) {
            const isTypeOf = returnType.isTypeOf(result, this.validatedExecutionArgs.contextValue, info);
            if ((0, isPromise_ts_1.isPromiseLike)(isTypeOf)) {
                return isTypeOf.then((resolvedIsTypeOf) => {
                    if (this.aborted) {
                        throw new Error('Aborted!');
                    }
                    if (!resolvedIsTypeOf) {
                        throw this.invalidReturnTypeError(returnType, result, fieldDetailsList);
                    }
                    return this.collectAndExecuteSubfields(returnType, fieldDetailsList, path, result, positionContext);
                });
            }
            if (!isTypeOf) {
                throw this.invalidReturnTypeError(returnType, result, fieldDetailsList);
            }
        }
        return this.collectAndExecuteSubfields(returnType, fieldDetailsList, path, result, positionContext);
    }
    invalidReturnTypeError(returnType, result, fieldDetailsList) {
        return new GraphQLError_ts_1.GraphQLError(`Expected value of type "${returnType}" but got: ${(0, inspect_ts_1.inspect)(result)}.`, { nodes: toNodes(fieldDetailsList) });
    }
    collectAndExecuteSubfields(returnType, fieldDetailsList, path, result, positionContext) {
        const { groupedFieldSet, newDeferUsages } = (0, exports.collectSubfields)(this.validatedExecutionArgs, returnType, fieldDetailsList);
        return this.executeCollectedSubfields(returnType, result, path, groupedFieldSet, newDeferUsages, positionContext);
    }
    executeCollectedSubfields(parentType, sourceValue, path, originalGroupedFieldSet, _newDeferUsages, _positionContext) {
        return this.executeFields(parentType, sourceValue, path, originalGroupedFieldSet, undefined);
    }
}
exports.Executor = Executor;
function toNodes(fieldDetailsList) {
    return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}
//# sourceMappingURL=Executor.js.map