import { inspect } from "../jsutils/inspect.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { isAsyncIterable } from "../jsutils/isAsyncIterable.mjs";
import { isIterableObject } from "../jsutils/isIterableObject.mjs";
import { isPromise, isPromiseLike } from "../jsutils/isPromise.mjs";
import { memoize2 } from "../jsutils/memoize2.mjs";
import { memoize3 } from "../jsutils/memoize3.mjs";
import { addPath, pathToArray } from "../jsutils/Path.mjs";
import { promiseForObject } from "../jsutils/promiseForObject.mjs";
import { promiseReduce } from "../jsutils/promiseReduce.mjs";
import { ensureGraphQLError } from "../error/ensureGraphQLError.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import { locatedError } from "../error/locatedError.mjs";
import { OperationTypeNode } from "../language/ast.mjs";
import { isAbstractType, isLeafType, isListType, isNonNullType, isObjectType, } from "../type/definition.mjs";
import { executeRootSelectionSetChannel, resolveChannel, shouldTrace, traceMixed, } from "../diagnostics.mjs";
import { AbortedGraphQLExecutionError } from "./AbortedGraphQLExecutionError.mjs";
import { buildResolveInfo } from "./buildResolveInfo.mjs";
import { withCancellation } from "./cancellablePromise.mjs";
import { collectFields, collectSubfields as _collectSubfields, } from "./collectFields.mjs";
import { collectIteratorPromises } from "./collectIteratorPromises.mjs";
import { createSharedExecutionContext } from "./createSharedExecutionContext.mjs";
import { getStreamUsage as _getStreamUsage } from "./getStreamUsage.mjs";
import { runAsyncWorkFinishedHook } from "./hooks.mjs";
import { returnIteratorCatchingErrors } from "./returnIteratorCatchingErrors.mjs";
import { getArgumentValues } from "./values.mjs";
export const collectSubfields = memoize3((validatedExecutionArgs, returnType, fieldDetailsList) => {
    const { schema, fragments, variableValues, hideSuggestions } = validatedExecutionArgs;
    return _collectSubfields(schema, fragments, variableValues, returnType, fieldDetailsList, hideSuggestions);
});
export const getStreamUsage = memoize2((validatedExecutionArgs, fieldDetailsList) => _getStreamUsage(validatedExecutionArgs, fieldDetailsList));
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
export class Executor {
    constructor(validatedExecutionArgs, sharedExecutionContext) {
        this.validatedExecutionArgs = validatedExecutionArgs;
        this.aborted = false;
        this.abortReason = defaultAbortReason;
        this.collectedErrors = new CollectedErrors();
        if (sharedExecutionContext === undefined) {
            this.resolverAbortController = new AbortController();
            this.sharedExecutionContext = createSharedExecutionContext(this.resolverAbortController.signal);
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
        if (!shouldTrace(executeRootSelectionSetChannel)) {
            return this.executeRootSelectionSetImpl(serially);
        }
        return traceMixed(executeRootSelectionSetChannel, this.buildExecuteContextFromValidatedArgs(this.validatedExecutionArgs), () => this.executeRootSelectionSetImpl(serially));
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
                throw new GraphQLError(`Schema is not configured to execute ${operationType} operation.`, { nodes: operation });
            }
            const { groupedFieldSet, newDeferUsages } = collectFields(schema, fragments, variableValues, rootType, selectionSet, hideSuggestions);
            result = this.executeCollectedRootFields(rootType, rootValue, groupedFieldSet, serially ?? operationType === OperationTypeNode.MUTATION, newDeferUsages);
            if (isPromise(result)) {
                const promise = result.then((data) => {
                    maybeRemoveExternalAbortListener();
                    return this.buildResponse(data);
                }, (error) => {
                    maybeRemoveExternalAbortListener();
                    this.collectedErrors.add(ensureGraphQLError(error), undefined);
                    return this.buildResponse(null);
                });
                this.sharedExecutionContext.asyncWorkTracker.add(promise);
                const { promise: cancellablePromise, abort: abortResultPromise } = withCancellation(promise.then((resolved) => this.finish(resolved)));
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
            this.collectedErrors.add(ensureGraphQLError(error), undefined);
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
        return new AbortedGraphQLExecutionError(this.abortReason, result);
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
            runAsyncWorkFinishedHook(validatedExecutionArgs, sharedExecutionContext, asyncWorkFinishedHook);
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
        let tracingChannel = shouldTrace(resolveChannel)
            ? resolveChannel
            : undefined;
        return promiseReduce(groupedFieldSet, (results, [responseName, fieldDetailsList]) => {
            if (this.aborted) {
                throw new Error('Aborted!');
            }
            const fieldPath = addPath(path, responseName, parentType.name);
            const result = this.executeField(parentType, sourceValue, fieldDetailsList, fieldPath, positionContext, tracingChannel);
            if (result === undefined) {
                return results;
            }
            if (isPromise(result)) {
                return result.then((resolved) => {
                    results[responseName] = resolved;
                    tracingChannel = shouldTrace(resolveChannel)
                        ? resolveChannel
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
        const tracingChannel = shouldTrace(resolveChannel)
            ? resolveChannel
            : undefined;
        try {
            for (const [responseName, fieldDetailsList] of groupedFieldSet) {
                const fieldPath = addPath(path, responseName, parentType.name);
                const result = this.executeField(parentType, sourceValue, fieldDetailsList, fieldPath, positionContext, tracingChannel);
                if (result !== undefined) {
                    results[responseName] = result;
                    if (isPromise(result)) {
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
        return promiseForObject(results, this.promiseAll);
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
            resolveFn = (s, args, c, info) => traceMixed(tracingChannel, this.buildResolveContext(args, info, fieldDef.resolve === undefined), () => originalResolveFn(s, args, c, info));
        }
        const info = buildResolveInfo(validatedExecutionArgs, fieldDef, toNodes(fieldDetailsList), parentType, path, this.getAbortSignal, this.getAsyncHelpers);
        try {
            const args = getArgumentValues(fieldDef, firstNode, variableValues, firstFieldDetails.fragmentVariableValues, hideSuggestions);
            const result = resolveFn(source, args, contextValue, info);
            if (isPromiseLike(result)) {
                return this.completePromisedValue(returnType, fieldDetailsList, info, path, result, positionContext);
            }
            const completed = this.completeValue(returnType, fieldDetailsList, info, path, result, positionContext);
            if (isPromise(completed)) {
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
                cachedFieldPath ??= pathToArray(info.path).join('.');
                return cachedFieldPath;
            },
        };
    }
    handleFieldError(rawError, returnType, fieldDetailsList, path) {
        const error = locatedError(rawError, toNodes(fieldDetailsList), pathToArray(path));
        if (this.validatedExecutionArgs.errorPropagation &&
            isNonNullType(returnType)) {
            throw error;
        }
        this.collectedErrors.add(error, path);
    }
    completeValue(returnType, fieldDetailsList, info, path, result, positionContext) {
        if (result instanceof Error) {
            throw result;
        }
        if (isNonNullType(returnType)) {
            const completed = this.completeValue(returnType.ofType, fieldDetailsList, info, path, result, positionContext);
            if (completed === null) {
                throw new Error(`Cannot return null for non-nullable field ${info.parentType}.${info.fieldName}.`);
            }
            return completed;
        }
        if (result == null) {
            return null;
        }
        if (isListType(returnType)) {
            return this.completeListValue(returnType, fieldDetailsList, info, path, result, positionContext);
        }
        if (isLeafType(returnType)) {
            return this.completeLeafValue(returnType, result);
        }
        if (isAbstractType(returnType)) {
            return this.completeAbstractValue(returnType, fieldDetailsList, info, path, result, positionContext);
        }
        if (isObjectType(returnType)) {
            return this.completeObjectValue(returnType, fieldDetailsList, info, path, result, positionContext);
        }
        invariant(false, 'Cannot complete value of unexpected output type: ' + inspect(returnType));
    }
    async completePromisedValue(returnType, fieldDetailsList, info, path, result, positionContext) {
        try {
            const resolved = await result;
            if (this.aborted) {
                throw new Error('Aborted!');
            }
            let completed = this.completeValue(returnType, fieldDetailsList, info, path, resolved, positionContext);
            if (isPromise(completed)) {
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
            : getStreamUsage(this.validatedExecutionArgs, fieldDetailsList);
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
                const itemPath = addPath(path, index, undefined);
                try {
                    iteration = await asyncIterator.next();
                }
                catch (rawError) {
                    throw locatedError(rawError, toNodes(fieldDetailsList), pathToArray(path));
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
            this.sharedExecutionContext.asyncWorkTracker.add(returnIteratorCatchingErrors(asyncIterator));
            if (containsPromise) {
                this.sharedExecutionContext.asyncWorkTracker.addValues(completedResults);
            }
            throw error;
        }
        if (this.aborted) {
            if (!iteration?.done) {
                this.sharedExecutionContext.asyncWorkTracker.add(returnIteratorCatchingErrors(asyncIterator));
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
        if (isAsyncIterable(result)) {
            return this.completeAsyncIterableValue(itemType, fieldDetailsList, info, path, result, positionContext);
        }
        if (!isIterableObject(result)) {
            throw new GraphQLError(`Expected Iterable, but did not find one for field "${info.parentType}.${info.fieldName}".`);
        }
        return this.completeIterableValue(itemType, fieldDetailsList, info, path, result, positionContext);
    }
    completeIterableValue(itemType, fieldDetailsList, info, path, items, positionContext) {
        const streamUsage = typeof path.key === 'number'
            ? undefined
            : getStreamUsage(this.validatedExecutionArgs, fieldDetailsList);
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
                const itemPath = addPath(path, index, undefined);
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
            asyncWorkTracker.addValues(collectIteratorPromises(iterator));
            throw error;
        }
        return containsPromise
            ? this.promiseAll(completedResults)
            : completedResults;
    }
    completeMaybePromisedListItemValue(item, completedResults, itemType, fieldDetailsList, info, itemPath, positionContext) {
        if (isPromiseLike(item)) {
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
            if (isPromise(completedItem)) {
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
            if (isPromise(completed)) {
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
            throw new Error(`Expected \`${inspect(returnType)}.coerceOutputValue(${inspect(result)})\` to ` +
                `return non-nullable value, returned: ${inspect(coerced)}`);
        }
        return coerced;
    }
    completeAbstractValue(returnType, fieldDetailsList, info, path, result, positionContext) {
        const validatedExecutionArgs = this.validatedExecutionArgs;
        const { schema, contextValue } = validatedExecutionArgs;
        const resolveTypeFn = returnType.resolveType ?? validatedExecutionArgs.typeResolver;
        const runtimeType = resolveTypeFn(result, contextValue, info, returnType);
        if (isPromiseLike(runtimeType)) {
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
            throw new GraphQLError(`Abstract type "${returnType}" must resolve to an Object type at runtime for field "${info.parentType}.${info.fieldName}". Either the "${returnType}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`, { nodes: toNodes(fieldDetailsList) });
        }
        if (typeof runtimeTypeName !== 'string') {
            throw new GraphQLError(`Abstract type "${returnType}" must resolve to an Object type at runtime for field "${info.parentType}.${info.fieldName}" with ` +
                `value ${inspect(result)}, received "${inspect(runtimeTypeName)}", which is not a valid Object type name.`);
        }
        const runtimeType = schema.getType(runtimeTypeName);
        if (runtimeType == null) {
            throw new GraphQLError(`Abstract type "${returnType}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`, { nodes: toNodes(fieldDetailsList) });
        }
        if (!isObjectType(runtimeType)) {
            throw new GraphQLError(`Abstract type "${returnType}" was resolved to a non-object type "${runtimeTypeName}".`, { nodes: toNodes(fieldDetailsList) });
        }
        if (!schema.isSubType(returnType, runtimeType)) {
            throw new GraphQLError(`Runtime Object type "${runtimeType}" is not a possible type for "${returnType}".`, { nodes: toNodes(fieldDetailsList) });
        }
        return runtimeType;
    }
    completeObjectValue(returnType, fieldDetailsList, info, path, result, positionContext) {
        if (returnType.isTypeOf) {
            const isTypeOf = returnType.isTypeOf(result, this.validatedExecutionArgs.contextValue, info);
            if (isPromiseLike(isTypeOf)) {
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
        return new GraphQLError(`Expected value of type "${returnType}" but got: ${inspect(result)}.`, { nodes: toNodes(fieldDetailsList) });
    }
    collectAndExecuteSubfields(returnType, fieldDetailsList, path, result, positionContext) {
        const { groupedFieldSet, newDeferUsages } = collectSubfields(this.validatedExecutionArgs, returnType, fieldDetailsList);
        return this.executeCollectedSubfields(returnType, result, path, groupedFieldSet, newDeferUsages, positionContext);
    }
    executeCollectedSubfields(parentType, sourceValue, path, originalGroupedFieldSet, _newDeferUsages, _positionContext) {
        return this.executeFields(parentType, sourceValue, path, originalGroupedFieldSet, undefined);
    }
}
function toNodes(fieldDetailsList) {
    return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}
//# sourceMappingURL=Executor.mjs.map