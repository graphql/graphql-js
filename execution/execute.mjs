import { inspect } from "../jsutils/inspect.mjs";
import { isAsyncIterable } from "../jsutils/isAsyncIterable.mjs";
import { isObjectLike } from "../jsutils/isObjectLike.mjs";
import { isPromise, isPromiseLike } from "../jsutils/isPromise.mjs";
import { addPath, pathToArray } from "../jsutils/Path.mjs";
import { ensureGraphQLError } from "../error/ensureGraphQLError.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import { locatedError } from "../error/locatedError.mjs";
import { Kind } from "../language/kinds.mjs";
import { isSubscriptionOperationDefinitionNode } from "../language/predicates.mjs";
import { GraphQLDisableErrorPropagationDirective } from "../type/directives.mjs";
import { assertValidSchema } from "../type/index.mjs";
import { getOperationAST } from "../utilities/getOperationAST.mjs";
import { executeChannel, executeVariableCoercionChannel, shouldTrace, subscribeChannel, traceMixed, } from "../diagnostics.mjs";
import { buildResolveInfo } from "./buildResolveInfo.mjs";
import { cancellablePromise } from "./cancellablePromise.mjs";
import { collectFields } from "./collectFields.mjs";
import { createSharedExecutionContext } from "./createSharedExecutionContext.mjs";
import { Executor } from "./Executor.mjs";
import { ExecutorThrowingOnIncremental } from "./ExecutorThrowingOnIncremental.mjs";
import { getVariableSignature } from "./getVariableSignature.mjs";
import { IncrementalExecutor } from "./incremental/IncrementalExecutor.mjs";
import { mapAsyncIterable } from "./mapAsyncIterable.mjs";
import { getArgumentValues, getVariableValues } from "./values.mjs";
const UNEXPECTED_EXPERIMENTAL_DIRECTIVES = 'The provided schema unexpectedly contains experimental directives (@defer or @stream). These directives may only be utilized if experimental execution features are explicitly enabled.';
export function execute(args) {
    if (!shouldTrace(executeChannel)) {
        return executeImpl(args);
    }
    return traceMixed(executeChannel, buildOperationContextFromArgs(args), () => executeImpl(args));
}
function buildOperationContextFromArgs(args) {
    let operation;
    const resolveOperation = () => {
        if (operation === undefined) {
            operation = getOperationAST(args.document, args.operationName);
        }
        return operation;
    };
    return {
        schema: args.schema,
        document: args.document,
        rawVariableValues: args.variableValues,
        get operationName() {
            return args.operationName ?? resolveOperation()?.name?.value;
        },
        get operationType() {
            return resolveOperation()?.operation;
        },
    };
}
function executeImpl(args) {
    if (args.schema.getDirective('defer') || args.schema.getDirective('stream')) {
        throw new Error(UNEXPECTED_EXPERIMENTAL_DIRECTIVES);
    }
    const validatedExecutionArgs = validateExecutionArgs(args);
    if (!('schema' in validatedExecutionArgs)) {
        return { errors: validatedExecutionArgs };
    }
    return executeRootSelectionSet(validatedExecutionArgs);
}
export function experimentalExecuteIncrementally(args) {
    if (!shouldTrace(executeChannel)) {
        return experimentalExecuteIncrementallyImpl(args);
    }
    return traceMixed(executeChannel, buildOperationContextFromArgs(args), () => experimentalExecuteIncrementallyImpl(args));
}
function experimentalExecuteIncrementallyImpl(args) {
    const validatedExecutionArgs = validateExecutionArgs(args);
    if (!('schema' in validatedExecutionArgs)) {
        return { errors: validatedExecutionArgs };
    }
    return experimentalExecuteRootSelectionSet(validatedExecutionArgs);
}
export function executeIgnoringIncremental(args) {
    if (!shouldTrace(executeChannel)) {
        return executeIgnoringIncrementalImpl(args);
    }
    return traceMixed(executeChannel, buildOperationContextFromArgs(args), () => executeIgnoringIncrementalImpl(args));
}
function executeIgnoringIncrementalImpl(args) {
    const validatedExecutionArgs = validateExecutionArgs(args);
    if (!('schema' in validatedExecutionArgs)) {
        return { errors: validatedExecutionArgs };
    }
    return executeRootSelectionSetIgnoringIncremental(validatedExecutionArgs);
}
export function executeRootSelectionSet(validatedExecutionArgs) {
    return new ExecutorThrowingOnIncremental(validatedExecutionArgs).executeRootSelectionSet();
}
export function experimentalExecuteRootSelectionSet(validatedExecutionArgs) {
    return new IncrementalExecutor(validatedExecutionArgs).executeRootSelectionSet();
}
export function executeRootSelectionSetIgnoringIncremental(validatedExecutionArgs) {
    return new Executor(validatedExecutionArgs).executeRootSelectionSet();
}
export function executeSync(args) {
    const result = experimentalExecuteIncrementally(args);
    if (isPromise(result) || 'initialResult' in result) {
        throw new Error('GraphQL execution failed to complete synchronously.');
    }
    return result;
}
export function executeSubscriptionEvent(validatedExecutionArgs) {
    return new ExecutorThrowingOnIncremental(validatedExecutionArgs).executeRootSelectionSet(false);
}
export function subscribe(args) {
    if (!shouldTrace(subscribeChannel)) {
        return subscribeImpl(args);
    }
    return traceMixed(subscribeChannel, buildOperationContextFromArgs(args), () => subscribeImpl(args));
}
function subscribeImpl(args) {
    const validatedExecutionArgs = validateSubscriptionArgs(args);
    if (!('schema' in validatedExecutionArgs)) {
        return { errors: validatedExecutionArgs };
    }
    const resultOrStream = createSourceEventStream(validatedExecutionArgs);
    if (isPromise(resultOrStream)) {
        return resultOrStream.then((resolvedResultOrStream) => isAsyncIterable(resolvedResultOrStream)
            ? mapSourceToResponseEvent(validatedExecutionArgs, resolvedResultOrStream)
            : resolvedResultOrStream);
    }
    return isAsyncIterable(resultOrStream)
        ? mapSourceToResponseEvent(validatedExecutionArgs, resultOrStream)
        : resultOrStream;
}
export function createSourceEventStream(validatedExecutionArgs) {
    if (!('operation' in validatedExecutionArgs)) {
        throw new GraphQLError('Passing ExecutionArgs to createSourceEventStream() was removed in graphql-js@17.0.0; call validateSubscriptionArgs() first and pass the result instead, or use subscribe() for the full subscription pipeline.');
    }
    try {
        const eventStream = executeSubscription(validatedExecutionArgs);
        if (isPromise(eventStream)) {
            return eventStream.then(undefined, (error) => ({
                errors: [ensureGraphQLError(error)],
            }));
        }
        return eventStream;
    }
    catch (error) {
        return { errors: [ensureGraphQLError(error)] };
    }
}
export function validateExecutionArgs(args) {
    const { schema, document, rootValue, contextValue, variableValues: rawVariableValues, operationName, fieldResolver, typeResolver, subscribeFieldResolver, abortSignal: externalAbortSignal, enableEarlyExecution, hooks, options, } = args;
    assertValidSchema(schema);
    let operation;
    const fragmentDefinitions = Object.create(null);
    const fragments = Object.create(null);
    const fragmentVariableSignatureErrors = [];
    for (const definition of document.definitions) {
        switch (definition.kind) {
            case Kind.OPERATION_DEFINITION:
                if (operationName == null) {
                    if (operation !== undefined) {
                        return [
                            new GraphQLError('Must provide operation name if query contains multiple operations.'),
                        ];
                    }
                    operation = definition;
                }
                else if (definition.name?.value === operationName) {
                    operation = definition;
                }
                break;
            case Kind.FRAGMENT_DEFINITION: {
                fragmentDefinitions[definition.name.value] = definition;
                let variableSignatures;
                if (definition.variableDefinitions) {
                    const signatures = Object.create(null);
                    for (const varDef of definition.variableDefinitions) {
                        const signature = getVariableSignature(schema, varDef);
                        if (signature instanceof GraphQLError) {
                            fragmentVariableSignatureErrors.push(signature);
                            continue;
                        }
                        signatures[signature.name] = signature;
                    }
                    variableSignatures = signatures;
                }
                fragments[definition.name.value] = { definition, variableSignatures };
                break;
            }
            default:
        }
    }
    if (!operation) {
        if (operationName != null) {
            return [new GraphQLError(`Unknown operation named "${operationName}".`)];
        }
        return [new GraphQLError('Must provide an operation.')];
    }
    if (fragmentVariableSignatureErrors.length > 0) {
        return fragmentVariableSignatureErrors;
    }
    const variableDefinitions = operation.variableDefinitions ?? [];
    const hideSuggestions = args.hideSuggestions ?? false;
    const coercionInput = rawVariableValues ?? {};
    const coercionOptions = {
        maxErrors: options?.maxCoercionErrors ?? 50,
        hideSuggestions,
    };
    const coercionChannel = executeVariableCoercionChannel;
    const variableValuesOrErrors = shouldTrace(coercionChannel)
        ? traceMixed(coercionChannel, {
            schema,
            document,
            operation,
            rawVariableValues,
            operationName: operation.name?.value,
            operationType: operation.operation,
        }, () => getVariableValues(schema, variableDefinitions, coercionInput, coercionOptions))
        : getVariableValues(schema, variableDefinitions, coercionInput, coercionOptions);
    if (variableValuesOrErrors.errors) {
        return variableValuesOrErrors.errors;
    }
    const errorPropagation = !operation.directives?.find((directive) => directive.name.value === GraphQLDisableErrorPropagationDirective.name);
    return {
        schema,
        document,
        fragmentDefinitions,
        fragments,
        rootValue,
        contextValue,
        operation,
        variableValues: variableValuesOrErrors.variableValues,
        fieldResolver: fieldResolver ?? defaultFieldResolver,
        typeResolver: typeResolver ?? defaultTypeResolver,
        subscribeFieldResolver: subscribeFieldResolver ?? defaultFieldResolver,
        hideSuggestions,
        errorPropagation,
        externalAbortSignal: externalAbortSignal ?? undefined,
        enableEarlyExecution: enableEarlyExecution === true,
        hooks: hooks ?? undefined,
        rawVariableValues,
    };
}
export function validateSubscriptionArgs(args) {
    const validatedExecutionArgs = validateExecutionArgs(args);
    if (!('schema' in validatedExecutionArgs)) {
        return validatedExecutionArgs;
    }
    assertSubscriptionExecutionArgs(validatedExecutionArgs);
    return validatedExecutionArgs;
}
function assertSubscriptionExecutionArgs(validatedExecutionArgs) {
    if (!isSubscriptionOperationDefinitionNode(validatedExecutionArgs.operation)) {
        throw new GraphQLError('Expected subscription operation.');
    }
}
export const defaultTypeResolver = function (value, contextValue, info, abstractType) {
    if (isObjectLike(value) && typeof value.__typename === 'string') {
        return value.__typename;
    }
    const possibleTypes = info.schema.getPossibleTypes(abstractType);
    const promisedIsTypeOfResults = [];
    try {
        for (let i = 0; i < possibleTypes.length; i++) {
            const type = possibleTypes[i];
            if (type.isTypeOf) {
                const isTypeOfResult = type.isTypeOf(value, contextValue, info);
                if (isPromiseLike(isTypeOfResult)) {
                    promisedIsTypeOfResults[i] = isTypeOfResult;
                }
                else if (isTypeOfResult) {
                    if (promisedIsTypeOfResults.length) {
                        info.getAsyncHelpers().track(promisedIsTypeOfResults);
                    }
                    return type.name;
                }
            }
        }
    }
    catch (error) {
        if (promisedIsTypeOfResults.length) {
            info.getAsyncHelpers().track(promisedIsTypeOfResults);
        }
        throw error;
    }
    if (promisedIsTypeOfResults.length) {
        return info
            .getAsyncHelpers()
            .promiseAll(promisedIsTypeOfResults)
            .then((isTypeOfResults) => {
            for (let i = 0; i < isTypeOfResults.length; i++) {
                if (isTypeOfResults[i]) {
                    return possibleTypes[i].name;
                }
            }
        });
    }
};
export const defaultFieldResolver = function (source, args, contextValue, info) {
    if (isObjectLike(source) || typeof source === 'function') {
        const property = source[info.fieldName];
        if (typeof property === 'function') {
            return source[info.fieldName](args, contextValue, info);
        }
        return property;
    }
};
export function mapSourceToResponseEvent(validatedExecutionArgs, sourceEventStream, rootSelectionSetExecutor = executeSubscriptionEvent) {
    function mapFn(payload) {
        const perEventExecutionArgs = {
            ...validatedExecutionArgs,
            rootValue: payload,
        };
        return rootSelectionSetExecutor(perEventExecutionArgs);
    }
    const externalAbortSignal = validatedExecutionArgs.externalAbortSignal;
    if (externalAbortSignal) {
        const generator = mapAsyncIterable(sourceEventStream, mapFn);
        return {
            ...generator,
            next: () => cancellablePromise(generator.next(), externalAbortSignal),
        };
    }
    return mapAsyncIterable(sourceEventStream, mapFn);
}
function executeSubscription(validatedExecutionArgs) {
    const { schema, fragments, rootValue, contextValue, operation, variableValues, hideSuggestions, externalAbortSignal, } = validatedExecutionArgs;
    const rootType = schema.getSubscriptionType();
    if (rootType == null) {
        throw new GraphQLError('Schema is not configured to execute subscription operation.', { nodes: operation });
    }
    const { groupedFieldSet } = collectFields(schema, fragments, variableValues, rootType, operation.selectionSet, hideSuggestions);
    const firstRootField = groupedFieldSet.entries().next().value;
    const [responseName, fieldDetailsList] = firstRootField;
    const firstFieldDetails = fieldDetailsList[0];
    const firstNode = firstFieldDetails.node;
    const fieldName = firstNode.name.value;
    const fieldDef = schema.getField(rootType, fieldName);
    const fieldNodes = fieldDetailsList.map((fieldDetails) => fieldDetails.node);
    if (!fieldDef) {
        throw new GraphQLError(`The subscription field "${fieldName}" is not defined.`, { nodes: fieldNodes });
    }
    const sharedExecutionContext = createSharedExecutionContext(externalAbortSignal);
    const path = addPath(undefined, responseName, rootType.name);
    const info = buildResolveInfo(validatedExecutionArgs, fieldDef, fieldNodes, rootType, path, sharedExecutionContext.getAbortSignal, sharedExecutionContext.getAsyncHelpers);
    try {
        const args = getArgumentValues(fieldDef, firstNode, variableValues, firstFieldDetails.fragmentVariableValues, hideSuggestions);
        const resolveFn = fieldDef.subscribe ?? validatedExecutionArgs.subscribeFieldResolver;
        const result = resolveFn(rootValue, args, contextValue, info);
        if (isPromiseLike(result)) {
            const promisedResult = Promise.resolve(result);
            const promise = externalAbortSignal
                ? cancellablePromise(promisedResult, externalAbortSignal)
                : promisedResult;
            return promise
                .then(assertEventStream)
                .then(undefined, (error) => {
                throw locatedError(error, toNodes(fieldDetailsList), pathToArray(path));
            });
        }
        return assertEventStream(result);
    }
    catch (error) {
        throw locatedError(error, fieldNodes, pathToArray(path));
    }
}
function assertEventStream(result) {
    if (result instanceof Error) {
        throw result;
    }
    if (!isAsyncIterable(result)) {
        throw new GraphQLError('Subscription field must return Async Iterable. ' +
            `Received: ${inspect(result)}.`);
    }
    return result;
}
function toNodes(fieldDetailsList) {
    return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}
//# sourceMappingURL=execute.mjs.map