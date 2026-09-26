import { invariant } from '../../jsutils/invariant.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DirectiveNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  ObjectValueNode,
  SelectionSetNode,
  ValueNode,
  VariableDefinitionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { isSubscriptionOperationDefinitionNode } from '../../language/predicates.ts';
import { print } from '../../language/printer.ts';

import type {
  GraphQLField,
  GraphQLInputType,
  GraphQLObjectType,
  GraphQLOutputType,
} from '../../type/definition.ts';
import {
  isAbstractType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
  isRequiredInputField,
  isScalarType,
} from '../../type/definition.ts';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from '../../type/scalars.ts';
import type { GraphQLSchema } from '../../type/schema.ts';

import {
  coerceDefaultValue,
  coerceInputLiteral,
} from '../../utilities/coerceInputValue.ts';
import { typeFromAST } from '../../utilities/typeFromAST.ts';

import type { BareVariableArgumentValueEntry } from '../compile/compileArgumentValues.ts';
import { compileArgumentValues } from '../compile/compileArgumentValues.ts';
import {
  compileExecutionState,
  isExecutionErrors,
} from '../compile/compileExecutionState.ts';
import type { CompileExecutionArgs } from '../ExecutionArgs.ts';

/**
 * Generates an ECMAScript module source string for a compiled execution
 * operation.
 *
 * The generated module exports `createCompiledExecution(args)`. Call that
 * factory with the schema and any resolver or hook functions that cannot be
 * serialized into source. The returned value has the same API as
 * `compileExecution(args)`.
 * @param args - Static execution arguments to generate from.
 * @returns A generated module source string, or validation errors.
 * @example
 * ```ts
 * const source = generateExecution({ schema, document });
 * ```
 * @category Execution
 */
export function generateExecution(
  args: CompileExecutionArgs,
): ReadonlyArray<GraphQLError> | string {
  const compiledExecution = compileExecutionState(args);
  if (isExecutionErrors(compiledExecution)) {
    return compiledExecution;
  }
  const operationPlan = getOperationPlan(args, compiledExecution);
  if (operationPlan === undefined) {
    return [nonStaticGeneratedExecutionError()];
  }
  return generateExecutionSource(
    args,
    compiledExecution,
    compiledExecution.variableDefinitions.map(
      (variableDefinition) =>
        variableDefinition.type.kind === Kind.NON_NULL_TYPE,
    ),
    getVariableValuesPlan(compiledExecution),
    operationPlan,
  );
}

/**
 * Generates an ECMAScript module source string for a compiled subscription
 * operation.
 *
 * The generated module exports `createCompiledSubscription(args)`. Call that
 * factory with the schema and any resolver or hook functions that cannot be
 * serialized into source. The returned value has the same API as
 * `compileSubscription(args)`.
 * @param args - Static execution arguments to generate from.
 * @returns A generated module source string, or validation errors.
 * @example
 * ```ts
 * const source = generateSubscription({ schema, document });
 * ```
 * @category Execution
 */
export function generateSubscription(
  args: CompileExecutionArgs,
): ReadonlyArray<GraphQLError> | string {
  const compiledExecution = compileExecutionState(args);
  if (isExecutionErrors(compiledExecution)) {
    return compiledExecution;
  }
  if (!isSubscriptionOperationDefinitionNode(compiledExecution.operation)) {
    return [new GraphQLError('Expected subscription operation.')];
  }
  const operationPlan = getOperationPlan(args, compiledExecution);
  if (operationPlan === undefined) {
    return [nonStaticGeneratedExecutionError()];
  }
  return generateSubscriptionSource(
    args,
    compiledExecution,
    compiledExecution.variableDefinitions.map(
      (variableDefinition) =>
        variableDefinition.type.kind === Kind.NON_NULL_TYPE,
    ),
    getVariableValuesPlan(compiledExecution),
    operationPlan,
  );
}

function nonStaticGeneratedExecutionError(): GraphQLError {
  return new GraphQLError(
    'Operation cannot be fully represented as static generated source.',
  );
}

function generateExecutionSource(
  args: CompileExecutionArgs,
  compiledExecution: Exclude<
    ReturnType<typeof compileExecutionState>,
    ReadonlyArray<GraphQLError>
  >,
  requiredVariableDefinitions: ReadonlyArray<boolean>,
  variableValuesPlan: VariableValuesPlan | undefined,
  operationPlan: OperationPlan,
): string {
  const variableDefinitionCount = compiledExecution.variableDefinitions.length;
  return `${importsForGeneratedExecution(
    variableDefinitionCount,
    variableValuesPlan,
    false,
    operationPlan,
  )}

${generatedOutputScalarHelpersSource(operationPlan)}
${staticDocumentSource(args)}
${staticCompiledExecutionSource(args, compiledExecution)}

export function createCompiledExecution(args) {
  return createOperation(createGeneratedCompiledExecution(args));
}

export default createCompiledExecution;

function createOperation(compiledExecution) {
${variableValueSetup(variableDefinitionCount, variableValuesPlan)}
${validatedExecutionArgsSetup(operationPlan)}
${operationSetup(operationPlan, false)}

  if (executeGeneratedRootFields === undefined) {
    throw new Error(
      'Generated execution is incompatible with the provided runtime arguments.',
    );
  }

${generatedExecutionEntrypointFunctions(variableDefinitionCount)}

${getValidatedExecutionArgsFunction(variableDefinitionCount, operationPlan)}

${getVariableValuesFunction(
  variableDefinitionCount,
  requiredVariableDefinitions,
  variableValuesPlan,
)}

  return {
    execute,
    experimentalExecuteIncrementally,
    executeIgnoringIncremental,
  };
}

${generatedArgumentFunctions(operationPlan)}

${generatedFieldBindingFunctions(operationPlan)}
`;
}

function generateSubscriptionSource(
  args: CompileExecutionArgs,
  compiledExecution: Exclude<
    ReturnType<typeof compileExecutionState>,
    ReadonlyArray<GraphQLError>
  >,
  requiredVariableDefinitions: ReadonlyArray<boolean>,
  variableValuesPlan: VariableValuesPlan | undefined,
  operationPlan: OperationPlan,
): string {
  const variableDefinitionCount = compiledExecution.variableDefinitions.length;
  return `${importsForGeneratedExecution(
    variableDefinitionCount,
    variableValuesPlan,
    true,
    operationPlan,
  )}

${generatedOutputScalarHelpersSource(operationPlan)}
${staticDocumentSource(args)}
${staticCompiledExecutionSource(args, compiledExecution)}

export function createCompiledSubscription(args) {
  return createOperation(createGeneratedCompiledExecution(args));
}

export default createCompiledSubscription;

function createOperation(compiledExecution) {
${variableValueSetup(variableDefinitionCount, variableValuesPlan)}
${validatedExecutionArgsSetup(operationPlan)}
${operationSetup(operationPlan, true)}
  const generatedSubscription = createGeneratedSubscription(
    compiledExecution,
    getValidatedExecutionArgs,
    executeGeneratedRootFields,
    executeGeneratedSubscriptionSource,
  );

  if (
    executeGeneratedRootFields === undefined ||
    generatedSubscription === undefined
  ) {
    throw new Error(
      'Generated subscription is incompatible with the provided runtime arguments.',
    );
  }

${generatedExecutionEntrypointFunctions(variableDefinitionCount)}

${getValidatedExecutionArgsFunction(variableDefinitionCount, operationPlan)}

${getVariableValuesFunction(
  variableDefinitionCount,
  requiredVariableDefinitions,
  variableValuesPlan,
)}

  return {
    execute,
    experimentalExecuteIncrementally,
    executeIgnoringIncremental,
    ...generatedSubscription,
  };
}

${generatedArgumentFunctions(operationPlan)}

${generatedFieldBindingFunctions(operationPlan)}

${generatedSubscriptionSourceFieldFunction(operationPlan)}
`;
}

function generatedExecutionEntrypointFunctions(
  variableDefinitionCount: number,
): string {
  const validationErrorCheck =
    variableDefinitionCount === 0
      ? ''
      : `    if (Array.isArray(validatedExecutionArgs)) {
      return { errors: validatedExecutionArgs };
    }
`;
  const entrypoint = (
    functionName: string,
    mode: string,
  ) => `  function ${functionName}(args = emptyRuntimeArgs) {
    const validatedExecutionArgs = getValidatedExecutionArgs(args);
${validationErrorCheck}    return executeGeneratedRootWithValidatedArgs(
      validatedExecutionArgs,
      ${toJavaScript(mode)},
      executeGeneratedRootFields,
    );
  }`;

  return [
    entrypoint('execute', 'throw'),
    entrypoint('experimentalExecuteIncrementally', 'incremental'),
    entrypoint('executeIgnoringIncremental', 'ignore'),
  ].join('\n\n');
}

function importsForGeneratedExecution(
  variableDefinitionCount: number,
  variableValuesPlan: VariableValuesPlan | undefined,
  includeSubscription: boolean,
  operationPlan: OperationPlan,
): string {
  const includeListHelpers = hasGeneratedListFields(operationPlan);
  const includeMetaFieldDefs = hasGeneratedMetaFields(operationPlan);
  const includeOutputScalarHelpers =
    hasGeneratedBuiltinOutputScalars(operationPlan);
  const scalarImports = getGeneratedBuiltinScalarImportNames(
    operationPlan,
    variableValuesPlan,
  );
  const includeScalarImports = scalarImports.length !== 0;
  const executionArgsImports =
    variableDefinitionCount === 0
      ? ''
      : `import { EMPTY_VARIABLE_VALUES } from 'graphql/execution/ExecutionArgs.js';
`;
  const graphQLErrorImport =
    variableDefinitionCount === 0 &&
    !includeSubscription &&
    !includeOutputScalarHelpers
      ? ''
      : `
import { GraphQLError } from 'graphql/error/GraphQLError.js';`;
  const variableImports =
    variableDefinitionCount === 0
      ? ''
      : variableValuesPlan === undefined
        ? `
import { printPathArray } from 'graphql/jsutils/printPathArray.js';
import { compileVariableValues } from 'graphql/execution/compile/compileVariableValues.js';
import { validateDefaultInput } from 'graphql/type/validate.js';
import { validateInputValue } from 'graphql/utilities/validateInputValue.js';`
        : `
import { printPathArray } from 'graphql/jsutils/printPathArray.js';
import { validateInputValue } from 'graphql/utilities/validateInputValue.js';`;
  const typeImports =
    variableValuesPlan?.variables.some((variable) => variable.required) === true
      ? `
import { GraphQLNonNull } from 'graphql/type/definition.js';`
      : '';
  const subscriptionImports = includeSubscription
    ? `
import { pathToArray } from 'graphql/jsutils/Path.js';
import { locatedError } from 'graphql/error/locatedError.js';
import { cancellablePromise } from 'graphql/execution/cancellablePromise.js';
import { createSharedExecutionContext } from 'graphql/execution/createSharedExecutionContext.js';
import { mapAsyncIterable } from 'graphql/execution/mapAsyncIterable.js';`
    : '';
  const asyncIterableImport =
    includeSubscription || includeListHelpers
      ? `import { isAsyncIterable } from 'graphql/jsutils/isAsyncIterable.js';
`
      : '';
  const listHelperImports = includeListHelpers
    ? `import { isIterableObject } from 'graphql/jsutils/isIterableObject.js';
import { collectIteratorPromises } from 'graphql/execution/collectIteratorPromises.js';
import { returnIteratorCatchingErrors } from 'graphql/execution/returnIteratorCatchingErrors.js';
`
    : '';
  const metaFieldDefImports = includeMetaFieldDefs
    ? `
import { SchemaMetaFieldDef, TypeMetaFieldDef } from 'graphql/type/introspection.js';`
    : '';
  const outputScalarImports = includeScalarImports
    ? `
import { ${scalarImports
        .map((scalarName) => `GraphQL${scalarName}`)
        .join(', ')} } from 'graphql/type/scalars.js';`
    : '';
  const rootCanNull = operationPlan.fields.some(
    (field) => field.completedNonNull,
  );
  return `${asyncIterableImport}${listHelperImports}import { inspect } from 'graphql/jsutils/inspect.js';
import { ensureGraphQLError } from 'graphql/error/ensureGraphQLError.js';
import { defaultFieldResolver, defaultTypeResolver } from 'graphql/execution/execute.js';
${executionArgsImports}import { parse } from 'graphql/language/parser.js';
import { CompiledExecutor, CompiledExecutionRunner } from 'graphql/execution/compile/CompiledExecutor.js';${variableImports}
${graphQLErrorImport}${subscriptionImports}${typeImports}${metaFieldDefImports}${outputScalarImports}

const emptyGeneratedArgumentValues = Object.freeze(Object.create(null));

${generatedRootExecutionHelperSource(
  rootCanNull,
  operationPlan.deferUsages.length !== 0,
  hasGeneratedIncrementalFields(operationPlan),
)}

${
  includeSubscription
    ? `function createGeneratedSubscription(
  compiledExecution,
  getValidatedExecutionArgs,
  executeGeneratedRootFields,
  executeGeneratedSubscriptionSource,
) {
  if (compiledExecution.operation.operation !== 'subscription') {
    return undefined;
  }

  if (
    executeGeneratedRootFields === undefined ||
    executeGeneratedSubscriptionSource === undefined
  ) {
    return undefined;
  }

  function executeSubscriptionEvent(validatedExecutionArgs) {
    return executeGeneratedRootWithValidatedArgs(
      validatedExecutionArgs,
      'throw',
      executeGeneratedRootFields,
    );
  }

  function createSourceEventStream(validatedExecutionArgs) {
    if (!('operation' in validatedExecutionArgs)) {
      throw new GraphQLError(
        'Passing ExecutionArgs to createSourceEventStream() was removed in graphql-js@17.0.0; call validateSubscriptionArgs() first and pass the result instead, or use subscribe() for the full subscription pipeline.',
      );
    }

    try {
      const eventStream =
        executeGeneratedSubscriptionSource(validatedExecutionArgs);
      if (eventStream != null && typeof eventStream.then === 'function') {
        return Promise.resolve(eventStream).then(undefined, (error) => ({
          errors: [ensureGraphQLError(error)],
        }));
      }
      return eventStream;
    } catch (error) {
      return { errors: [ensureGraphQLError(error)] };
    }
  }

  function mapSourceToResponseEvent(
    validatedExecutionArgs,
    sourceEventStream,
    rootSelectionSetExecutor = executeSubscriptionEvent,
  ) {
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

  function subscribe(args = {}) {
    const validatedExecutionArgs = getValidatedExecutionArgs(args);
    if (Array.isArray(validatedExecutionArgs)) {
      return { errors: validatedExecutionArgs };
    }

    const resultOrStream = createSourceEventStream(validatedExecutionArgs);
    if (
      resultOrStream != null &&
      typeof resultOrStream.then === 'function'
    ) {
      return Promise.resolve(resultOrStream).then((resolvedResultOrStream) =>
        isAsyncIterable(resolvedResultOrStream)
          ? mapSourceToResponseEvent(
              validatedExecutionArgs,
              resolvedResultOrStream,
              executeSubscriptionEvent,
            )
          : resolvedResultOrStream,
      );
    }

    return isAsyncIterable(resultOrStream)
      ? mapSourceToResponseEvent(
          validatedExecutionArgs,
          resultOrStream,
          executeSubscriptionEvent,
        )
      : resultOrStream;
  }

  return {
    executeSubscriptionEvent,
    createSourceEventStream,
    mapSourceToResponseEvent,
    subscribe,
  };
}

function assertGeneratedEventStream(result) {
  if (result instanceof Error) {
    throw result;
  }

  if (!isAsyncIterable(result)) {
    throw new GraphQLError(
      'Subscription field must return Async Iterable. ' +
        \`Received: \${inspect(result)}.\`,
    );
  }

  return result;
}
`
    : ''
}

`;
}

function generatedRootExecutionHelperSource(
  rootCanNull: boolean,
  includeDeliveryGroupMap: boolean,
  includeIncrementalFinish: boolean,
): string {
  const rootObjectSource = generatedResultObjectSource();
  const deliveryGroupMapArgument = includeDeliveryGroupMap
    ? '      undefined,\n'
    : '';
  const finishSource = includeIncrementalFinish
    ? {
        async: (
          _dataExpression: string,
          rootBoxExpression: string,
        ) => `return executor.finishAsyncRootExecution(
        completed,
        ${rootBoxExpression},
        removeExternalAbortListener,
      );`,
        catch: `return executor.finish(executor.buildResponse(null));`,
        sync: (dataExpression: string) =>
          `return executor.finish(executor.buildResponse(${dataExpression}));`,
        helper: '',
      }
    : {
        async: (dataExpression: string, rootBoxExpression: string) => `if (
        validatedExecutionArgs.hooks?.asyncWorkFinished === undefined &&
        externalAbortSignal === undefined
      ) {
        return completed.then(
          () => finishGeneratedExecution(executor, ${dataExpression}),
          /* node:coverage ignore next 4 */
          (error) => {
            executor.collectedErrors.add(ensureGraphQLError(error), undefined);
            return finishGeneratedExecution(executor, null);
          },
        );
      }
      return executor.finishAsyncRootExecution(
        completed,
        ${rootBoxExpression},
        removeExternalAbortListener,
      );`,
        catch: `return finishGeneratedExecution(executor, null);`,
        sync: (dataExpression: string) =>
          `return finishGeneratedExecution(executor, ${dataExpression});`,
        helper: `
function finishGeneratedExecution(executor, data) {
  if (executor.validatedExecutionArgs.hooks?.asyncWorkFinished === undefined) {
    if (executor.resolverAbortController === undefined) {
      executor._resolverAbortFinished = true;
    } else {
      executor.abortResolverSignal();
    }
  } else {
    executor.finishSharedExecution();
  }
  const errors = executor._collectedErrors?._errors;
  const result =
    errors === undefined || errors.length === 0 ? { data } : { errors, data };
  if (executor.aborted) {
    throw executor.createAbortedExecutionError(result);
  }
  executor.aborted = true;
  return result;
}
`,
      };
  if (!rootCanNull) {
    return `function executeGeneratedRootWithValidatedArgs(
  validatedExecutionArgs,
  mode,
  executeGeneratedRootFields,
) {
  const executor = new CompiledExecutor(validatedExecutionArgs, mode);
  const externalAbortSignal = validatedExecutionArgs.externalAbortSignal;
  let removeExternalAbortListener;
  if (externalAbortSignal) {
    externalAbortSignal.throwIfAborted();
    const onExternalAbort = () => {
      executor.abort(externalAbortSignal.reason);
    };
    removeExternalAbortListener = () =>
      externalAbortSignal.removeEventListener('abort', onExternalAbort);
    externalAbortSignal.addEventListener('abort', onExternalAbort);
  }

  let data;
  try {
    data = ${rootObjectSource};
    const runner = new CompiledExecutionRunner(executor);
    executeGeneratedRootFields(
      executor,
      runner,
      validatedExecutionArgs.rootValue,
      data,
      undefined,
${deliveryGroupMapArgument.trimEnd()}
    );
    const completed = runner.runUntilNulled(undefined);
    if (completed !== undefined) {
      ${finishSource.async('data', '{ data }')}
    }
    removeExternalAbortListener?.();
  } catch (error) {
    removeExternalAbortListener?.();
    executor.collectedErrors.add(ensureGraphQLError(error), undefined);
    ${finishSource.catch}
  }
  ${finishSource.sync('data')}
}${finishSource.helper}`;
  }

  return `function executeGeneratedRootWithValidatedArgs(
  validatedExecutionArgs,
  mode,
  executeGeneratedRootFields,
) {
  const executor = new CompiledExecutor(validatedExecutionArgs, mode);
  const externalAbortSignal = validatedExecutionArgs.externalAbortSignal;
  let removeExternalAbortListener;
  if (externalAbortSignal) {
    externalAbortSignal.throwIfAborted();
    const onExternalAbort = () => {
      executor.abort(externalAbortSignal.reason);
    };
    removeExternalAbortListener = () =>
      externalAbortSignal.removeEventListener('abort', onExternalAbort);
    externalAbortSignal.addEventListener('abort', onExternalAbort);
  }

  let rootBox;
  try {
    const data = ${rootObjectSource};
    rootBox = { data };
    const runner = new CompiledExecutionRunner(executor);
    executeGeneratedRootFields(
      executor,
      runner,
      validatedExecutionArgs.rootValue,
      data,
      {
        container: rootBox,
        key: 'data',
        path: undefined,
      },
${deliveryGroupMapArgument.trimEnd()}
    );
    const completed = runner.runUntilNulled(undefined);
    if (completed !== undefined) {
      ${finishSource.async('rootBox.data', 'rootBox')}
    }
    removeExternalAbortListener?.();
  } catch (error) {
    removeExternalAbortListener?.();
    executor.collectedErrors.add(ensureGraphQLError(error), undefined);
    ${finishSource.catch}
  }
  ${finishSource.sync('rootBox.data')}
}${finishSource.helper}`;
}

function variableValueSetup(
  variableDefinitionCount: number,
  variableValuesPlan: VariableValuesPlan | undefined,
): string {
  if (variableDefinitionCount === 0) {
    return `  const emptyVariableValues = {
    sources: ${generatedNullPrototypeObjectSource()},
    coerced: ${generatedNullPrototypeObjectSource()},
  };`;
  }

  if (variableValuesPlan !== undefined) {
    return `  const generatedVariableEntries = createGeneratedVariableEntries(
    compiledExecution,
  );
  if (generatedVariableEntries === undefined) {
    throw new Error(
      'Generated execution is incompatible with the provided runtime arguments.',
    );
  }
${variableValuesPlan.variables
  .map(
    (variable) =>
      `  const ${generatedVariableSignatureName(
        variable,
      )} = generatedVariableEntries[${String(variable.entryIndex)}].signature;`,
  )
  .join('\n')}`;
  }

  return `  let compiledVariableValues;
  function getCompiledVariableValues() {
    compiledVariableValues ??= compileVariableValues(
      compiledExecution.schema,
      compiledExecution.variableDefinitions,
      compiledExecution.hideSuggestions,
    );
    return compiledVariableValues;
  }`;
}

function validatedExecutionArgsSetup(operationPlan: OperationPlan): string {
  const typeResolverSetup = hasGeneratedAbstractFields(operationPlan)
    ? `  const staticSchema = compiledExecution.schema;
  const staticTypeResolver =
    compiledExecution.typeResolver ?? defaultTypeResolver;
`
    : `  const staticSchema = compiledExecution.schema;
`;
  const earlyExecutionSetup = hasGeneratedIncrementalFields(operationPlan)
    ? `  const staticEnableEarlyExecution = compiledExecution.enableEarlyExecution;
`
    : '';

  return `  const emptyRuntimeArgs = Object.freeze({});
${typeResolverSetup}  const staticDocument = compiledExecution.document;
  const staticOperation = compiledExecution.operation;
  const staticHideSuggestions = compiledExecution.hideSuggestions;
  const staticErrorPropagation = compiledExecution.errorPropagation;
${earlyExecutionSetup}  const staticHooks = compiledExecution.hooks;
  const staticNeedsHookValidatedArgs =
    staticHooks?.asyncWorkFinished !== undefined;`;
}

function getValidatedExecutionArgsFunction(
  variableDefinitionCount: number,
  operationPlan: OperationPlan,
): string {
  const variableValuesSetup =
    variableDefinitionCount === 0
      ? `    const variableValues = emptyVariableValues;`
      : `    const variableValues = getVariableValues(args);
    if (variableValues.coerced === undefined) {
      return variableValues;
    }
`;

  const includeTypeResolver = hasGeneratedAbstractFields(operationPlan);
  const includeEarlyExecution = hasGeneratedIncrementalFields(operationPlan);
  const optionalProperties = [
    'schema: staticSchema',
    'document: staticDocument',
    'operation: staticOperation',
    includeTypeResolver ? 'typeResolver: staticTypeResolver' : undefined,
    includeEarlyExecution
      ? 'enableEarlyExecution: staticEnableEarlyExecution'
      : undefined,
  ].filter((property): property is string => property !== undefined);
  const optionalPropertiesSource = `${optionalProperties
    .map((property) => `      ${property},`)
    .join('\n')}\n`;

  const validatedArgsPropertiesSource = (includeHookProperties: boolean) => {
    const staticPropertiesSource = includeHookProperties
      ? `      schema: compiledExecution.schema,
      document: compiledExecution.document,
      operation: compiledExecution.operation,
      typeResolver: compiledExecution.typeResolver ?? defaultTypeResolver,
      enableEarlyExecution: compiledExecution.enableEarlyExecution,
`
      : optionalPropertiesSource;
    return `${staticPropertiesSource}      rootValue: args.rootValue,
      contextValue: args.contextValue,
      variableValues,
      rawVariableValues: args.variableValues,
      errorPropagation: staticErrorPropagation,
      externalAbortSignal: args.abortSignal ?? undefined,
      hooks: staticHooks,`;
  };

  if (operationPlan.operationType !== 'subscription') {
    return `  const getValidatedExecutionArgs = staticNeedsHookValidatedArgs
    ? getValidatedExecutionArgsWithHookProperties
    : getValidatedExecutionArgsWithoutHookProperties;

  function getValidatedExecutionArgsWithHookProperties(args = emptyRuntimeArgs) {
${variableValuesSetup}
    return {
${validatedArgsPropertiesSource(true)}
    };
  }

  function getValidatedExecutionArgsWithoutHookProperties(args = emptyRuntimeArgs) {
${variableValuesSetup}
    return {
${validatedArgsPropertiesSource(false)}
    };
  }`;
  }

  return `  function getValidatedExecutionArgs(args = emptyRuntimeArgs) {
${variableValuesSetup}
    return {
${validatedArgsPropertiesSource(true)}
    };
  }`;
}

interface OperationPlan {
  deferUsages: ReadonlyArray<DeferUsagePlan>;
  fields: ReadonlyArray<FieldPlan>;
  operationType: 'query' | 'mutation' | 'subscription';
  rootTypeName: string;
  serialRoot: boolean;
}

interface DeferUsagePlan {
  index: number;
  label?: string;
  parentIndex?: number;
  selectionSetPath: ReadonlyArray<number>;
}

interface FieldPlan {
  argumentPlan: ArgumentPlan;
  childTypeName?: string;
  childrenCanNullParent?: boolean;
  completedItemNonNull: boolean;
  completedNonNull: boolean;
  deferUsageIndexes: Array<number | undefined>;
  errorPropagation: boolean;
  fieldName: string;
  fieldNodeAccessors: Array<string>;
  inclusionCondition: string | undefined;
  builtinScalarName?: BuiltInScalarVariablePlan['scalarName'];
  outputKind:
    | 'leaf'
    | 'leafList'
    | 'object'
    | 'objectList'
    | 'abstract'
    | 'abstractList';
  objectTypeHasIsTypeOf?: boolean;
  parentTypeName: string;
  possibleFields?: Array<PossibleFieldsPlan>;
  resolveMode: 'customDefault' | 'default' | 'field';
  responseName: string;
  fields?: Array<FieldPlan>;
  streamPlan?: StreamPlan;
}

type NonLeafFieldPlan = FieldPlan & {
  outputKind: Exclude<FieldPlan['outputKind'], 'leaf'>;
};

interface PossibleFieldsPlan {
  fields: Array<FieldPlan>;
  typeName: string;
}

interface StreamPlan {
  condition?: string;
  initialCount: number;
  label?: string;
}

interface ArgumentPlan {
  isConstant: boolean;
  key: string;
  objectSource: string;
  returnExpression?: string;
  statements: ReadonlyArray<string>;
}

interface GeneratedObjectProperty {
  name: string;
  value: string;
}

interface VariableValuesPlan {
  variables: ReadonlyArray<VariablePlan>;
}

type VariablePlan = BuiltInScalarVariablePlan | CoercerVariablePlan;

interface BuiltInScalarVariablePlan {
  defaultValueSource?: string;
  entryIndex: number;
  kind: 'builtinScalar';
  name: string;
  required: boolean;
  scalarName: 'Boolean' | 'Float' | 'ID' | 'Int' | 'String';
  typeName: string;
}

interface CoercerVariablePlan {
  defaultValueSource?: string;
  entryIndex: number;
  kind: 'compiledCoercer';
  name: string;
  required: boolean;
  typeName: string;
}

type InclusionPlan =
  | { kind: 'include'; condition?: string }
  | { kind: 'skip' }
  | { kind: 'dynamic' };

type StaticDeferPlan =
  | { kind: 'defer'; label?: string }
  | { kind: 'dynamic' }
  | { kind: 'disabled' }
  | undefined;

type ObjectOutputPlan =
  | {
      kind: 'object' | 'objectList';
      objectType: GraphQLObjectType;
    }
  | {
      kind: 'abstract' | 'abstractList';
      possibleTypes: ReadonlyArray<GraphQLObjectType>;
    };

function getOperationPlan(
  args: CompileExecutionArgs,
  compiledExecution: Exclude<
    ReturnType<typeof compileExecutionState>,
    ReadonlyArray<GraphQLError>
  >,
): OperationPlan | undefined {
  const rootType = compiledExecution.schema.getRootType(
    compiledExecution.operation.operation,
  );
  if (
    rootType == null ||
    (compiledExecution.operation.operation !== 'query' &&
      compiledExecution.operation.operation !== 'mutation' &&
      compiledExecution.operation.operation !== 'subscription')
  ) {
    return undefined;
  }

  const variableAvailability = getVariableAvailability(
    compiledExecution.variableDefinitions,
  );
  const deferUsages: Array<DeferUsagePlan> = [];
  const fields = planSelectionSet({
    deferUsageIndex: undefined,
    deferUsages,
    errorPropagation: compiledExecution.errorPropagation,
    hasFallbackFieldResolver: args.fieldResolver != null,
    hideSuggestions: compiledExecution.hideSuggestions,
    schema: compiledExecution.schema,
    fragments: compiledExecution.fragmentDefinitions,
    inclusionCondition: undefined,
    operationType: compiledExecution.operation.operation,
    parentDeferUsageIndex: undefined,
    parentType: rootType,
    selectionSet: compiledExecution.operation.selectionSet,
    selectionSetAccessor: 'staticOperation.selectionSet',
    selectionSetPath: [],
    skipUnknownFields: compiledExecution.operation.operation !== 'subscription',
    variableAvailability,
    visitedFragmentNames: new Set(),
  });
  if (fields === undefined) {
    return undefined;
  }
  if (
    deferUsages.some((deferUsage) => deferUsage.parentIndex !== undefined) ||
    (deferUsages.length > 0 && hasComplexGeneratedDeferShape(fields))
  ) {
    return undefined;
  }
  return {
    deferUsages,
    fields,
    operationType: compiledExecution.operation.operation,
    rootTypeName: rootType.name,
    serialRoot: compiledExecution.operation.operation === 'mutation',
  };
}

function hasComplexGeneratedDeferShape(
  fields: ReadonlyArray<FieldPlan>,
): boolean {
  return fields.some((field) => {
    if (field.deferUsageIndexes.length > 1) {
      return true;
    }
    if (
      field.fields !== undefined &&
      hasComplexGeneratedDeferShape(field.fields)
    ) {
      return true;
    }
    return (
      field.possibleFields?.some((possibleField) =>
        hasComplexGeneratedDeferShape(possibleField.fields),
      ) === true
    );
  });
}

interface SelectionSetPlanContext {
  deferUsageIndex: number | undefined;
  deferUsages: Array<DeferUsagePlan>;
  errorPropagation: boolean;
  schema: GraphQLSchema;
  fragments: { readonly [fragmentName: string]: FragmentDefinitionNode };
  hasFallbackFieldResolver: boolean;
  hideSuggestions: boolean;
  inclusionCondition: string | undefined;
  operationType: 'query' | 'mutation' | 'subscription';
  parentDeferUsageIndex: number | undefined;
  parentType: GraphQLObjectType;
  selectionSet: SelectionSetNode;
  selectionSetAccessor: string;
  selectionSetPath: ReadonlyArray<number>;
  skipUnknownFields: boolean;
  variableAvailability: VariableAvailability;
  visitedFragmentNames: Set<string>;
}

interface VariableAvailability {
  alwaysDefined: ReadonlySet<string>;
  alwaysNonNull: ReadonlySet<string>;
}

function getVariableAvailability(
  variableDefinitions: ReadonlyArray<VariableDefinitionNode>,
): VariableAvailability {
  const alwaysDefinedVariables = new Set<string>();
  const alwaysNonNullVariables = new Set<string>();
  for (const variableDefinition of variableDefinitions) {
    if (variableDefinition.type.kind === Kind.NON_NULL_TYPE) {
      alwaysDefinedVariables.add(variableDefinition.variable.name.value);
      alwaysNonNullVariables.add(variableDefinition.variable.name.value);
      continue;
    }
    if (variableDefinition.defaultValue !== undefined) {
      alwaysDefinedVariables.add(variableDefinition.variable.name.value);
    }
  }
  return {
    alwaysDefined: alwaysDefinedVariables,
    alwaysNonNull: alwaysNonNullVariables,
  };
}

function getVariableValuesPlan(
  compiledExecution: Exclude<
    ReturnType<typeof compileExecutionState>,
    ReadonlyArray<GraphQLError>
  >,
): VariableValuesPlan | undefined {
  const variableDefinitions = compiledExecution.variableDefinitions;
  if (variableDefinitions.length === 0) {
    return undefined;
  }

  const variables: Array<VariablePlan> = [];
  for (
    let entryIndex = 0;
    entryIndex < variableDefinitions.length;
    entryIndex++
  ) {
    const variableDefinition = variableDefinitions[entryIndex];
    const type = typeFromAST(compiledExecution.schema, variableDefinition.type);
    if (type === undefined || !isInputType(type)) {
      return undefined;
    }

    const required = isNonNullType(type);
    const nullableType = required ? type.ofType : type;
    const builtinScalarName = getBuiltinScalarName(nullableType);
    let defaultValueSource: string | undefined;
    if (variableDefinition.defaultValue !== undefined) {
      const defaultValue = coerceInputLiteral(
        variableDefinition.defaultValue,
        type,
      );
      if (defaultValue === undefined) {
        return undefined;
      }
      defaultValueSource = toSerializableJavaScript(defaultValue);
      if (defaultValueSource === undefined) {
        return undefined;
      }
    }

    const name = variableDefinition.variable.name.value;
    if (builtinScalarName !== undefined) {
      variables.push({
        entryIndex,
        kind: 'builtinScalar',
        name,
        required,
        scalarName: builtinScalarName,
        typeName: builtinScalarName,
        ...(defaultValueSource === undefined ? {} : { defaultValueSource }),
      });
      continue;
    }

    if (!isScalarType(nullableType) && !isEnumType(nullableType)) {
      return undefined;
    }

    const typeName = nullableType.name;
    variables.push({
      entryIndex,
      kind: 'compiledCoercer',
      name,
      required,
      typeName,
      ...(defaultValueSource === undefined ? {} : { defaultValueSource }),
    });
  }

  return { variables };
}

function getBuiltinScalarName(
  type: unknown,
): BuiltInScalarVariablePlan['scalarName'] | undefined {
  switch (type) {
    case GraphQLBoolean:
      return 'Boolean';
    case GraphQLFloat:
      return 'Float';
    case GraphQLID:
      return 'ID';
    case GraphQLInt:
      return 'Int';
    case GraphQLString:
      return 'String';
    default:
      return undefined;
  }
}

function getArgumentPlan(
  fieldDef: GraphQLField<unknown, unknown>,
  fieldNode: FieldNode,
  fieldNodeAccessor: string,
  hideSuggestions: boolean,
  variableAvailability: VariableAvailability,
): ArgumentPlan | undefined {
  const compiledArgumentValues = compileArgumentValues(
    fieldDef,
    fieldNode,
    hideSuggestions,
    undefined,
  );
  if (compiledArgumentValues.entries.length === 0) {
    return {
      isConstant: true,
      key: 'constant:',
      objectSource: generatedNullPrototypeObjectSource(),
      statements: [],
    };
  }

  const statements: Array<string> = [];
  const alwaysAssignedArgumentNames = new Set<string>();
  const properties: Array<GeneratedObjectProperty> = [];
  let isConstant = true;
  for (const entry of compiledArgumentValues.entries) {
    switch (entry.kind) {
      case 'constant': {
        const valueSource = toSerializableJavaScript(entry.value);
        if (valueSource === undefined) {
          return undefined;
        }
        statements.push(
          `  ${argumentPropertyAssignment(entry.name)} = ${valueSource};`,
        );
        alwaysAssignedArgumentNames.add(entry.name);
        properties.push({ name: entry.name, value: valueSource });
        break;
      }
      case 'bareVariable': {
        isConstant = false;
        const variableNameSource = toJavaScript(entry.variableName);
        const coercedVariableSource = generatedObjectAssignmentSource(
          'coerced',
          entry.variableName,
        );
        if (entry.isNonNull) {
          if (variableAvailability.alwaysNonNull.has(entry.variableName)) {
            statements.push(
              `  ${argumentPropertyAssignment(
                entry.name,
              )} = ${coercedVariableSource};`,
            );
            alwaysAssignedArgumentNames.add(entry.name);
            properties.push({
              name: entry.name,
              value: coercedVariableSource,
            });
            break;
          }

          const valueNodeAccessor = variableArgumentValueNodeAccessor(
            fieldNode,
            fieldNodeAccessor,
            entry.name,
          );
          const valueName = `value${statements.length}`;
          let missingValueSource: string;
          if (entry.defaultValue === undefined) {
            missingValueSource = `    throw ${generatedInvalidArgumentVariableValueSource(
              entry,
              valueNodeAccessor,
              'missing',
            )};`;
          } else {
            const defaultValueSource = toSerializableJavaScript(
              entry.defaultValue,
            );
            if (defaultValueSource === undefined) {
              return undefined;
            }
            missingValueSource = `    ${argumentPropertyAssignment(
              entry.name,
            )} = ${defaultValueSource};`;
          }
          statements.push(`  if (${variableNameSource} in coerced) {
    const ${valueName} = ${coercedVariableSource};
    if (${valueName} == null) {
      throw ${generatedInvalidArgumentVariableValueSource(
        entry,
        valueNodeAccessor,
        'null',
      )};
    }
    ${argumentPropertyAssignment(entry.name)} = ${valueName};
  } else {
${missingValueSource}
  }`);
          alwaysAssignedArgumentNames.add(entry.name);
          break;
        }

        if (variableAvailability.alwaysDefined.has(entry.variableName)) {
          statements.push(
            `  ${argumentPropertyAssignment(
              entry.name,
            )} = ${coercedVariableSource};`,
          );
          alwaysAssignedArgumentNames.add(entry.name);
          properties.push({
            name: entry.name,
            value: coercedVariableSource,
          });
          break;
        }

        if (entry.defaultValue !== undefined) {
          const defaultValueSource = toSerializableJavaScript(
            entry.defaultValue,
          );
          if (defaultValueSource === undefined) {
            return undefined;
          }
          statements.push(`  if (${variableNameSource} in coerced) {
    ${argumentPropertyAssignment(entry.name)} = ${coercedVariableSource};
  } else {
    ${argumentPropertyAssignment(entry.name)} = ${defaultValueSource};
          }`);
          alwaysAssignedArgumentNames.add(entry.name);
          const valueSource = `${variableNameSource} in coerced ? ${coercedVariableSource} : ${defaultValueSource}`;
          properties.push({ name: entry.name, value: valueSource });
          break;
        }

        statements.push(`  if (${variableNameSource} in coerced) {
    ${argumentPropertyAssignment(entry.name)} = ${coercedVariableSource};
  }`);
        break;
      }
      case 'embeddedVariable': {
        isConstant = false;
        const valueExpression = inputValueExpression(
          entry.valueNode,
          entry.argDef.type,
          variableAvailability,
        );
        if (valueExpression === undefined) {
          return undefined;
        }
        statements.push(
          `  ${argumentPropertyAssignment(entry.name)} = ${valueExpression};`,
        );
        alwaysAssignedArgumentNames.add(entry.name);
        properties.push({ name: entry.name, value: valueExpression });
        break;
      }
      case 'invalidLiteral':
      case 'invalidDefault':
      case 'missing':
        return undefined;
    }
  }

  const objectSource = isConstant
    ? generatedArgumentObjectSource(fieldDef, alwaysAssignedArgumentNames)
    : generatedNullPrototypeObjectSource();
  const returnExpression =
    !isConstant || properties.length !== fieldDef.args.length
      ? undefined
      : generatedNullPrototypeObjectSource(properties);
  return {
    isConstant,
    key: `${isConstant ? 'constant' : 'runtime'}:${
      returnExpression ?? objectSource
    }:${statements.join('\n')}`,
    objectSource,
    ...(returnExpression === undefined ? {} : { returnExpression }),
    statements,
  };
}

function variableArgumentValueNodeAccessor(
  fieldNode: FieldNode,
  fieldNodeAccessor: string,
  argumentName: string,
): string {
  const argumentIndex = fieldNode.arguments?.findIndex(
    (argumentNode) => argumentNode.name.value === argumentName,
  );
  invariant(argumentIndex !== undefined && argumentIndex !== -1);
  return `${fieldNodeAccessor}.arguments[${String(argumentIndex)}].value`;
}

function generatedInvalidArgumentVariableValueSource(
  entry: BareVariableArgumentValueEntry,
  valueNodeAccessor: string,
  reason: 'missing' | 'null',
): string {
  const variableName = entry.variableName;
  const type = String(entry.argDef.type);
  const reasonMessage =
    reason === 'missing'
      ? `Expected variable "$${variableName}" provided to type "${type}" to provide a runtime value.`
      : `Expected variable "$${variableName}" provided to non-null type "${type}" not to be null.`;
  return `new GraphQLError(${toJavaScript(
    `Argument "${entry.argDef}" has invalid value: ${reasonMessage}`,
  )}, { nodes: ${valueNodeAccessor} })`;
}

function generatedArgumentObjectSource(
  fieldDef: GraphQLField<unknown, unknown>,
  alwaysAssignedArgumentNames: ReadonlySet<string>,
): string {
  const properties = fieldDef.args
    .filter((arg) => alwaysAssignedArgumentNames.has(arg.name))
    .map((arg) => ({ name: arg.name, value: 'undefined' }));
  return generatedNullPrototypeObjectSource(properties);
}

function generatedNullPrototypeObjectSource(
  properties: ReadonlyArray<GeneratedObjectProperty> = [],
): string {
  if (properties.length === 0) {
    return 'Object.create(null)';
  }

  const assignments = properties.map(
    (property) =>
      `${generatedObjectAssignmentSource('object', property.name)} = ${
        property.value
      };`,
  );
  return `(() => {
  const object = Object.create(null);
  ${assignments.join('\n  ')}
  return object;
})()`;
}

function generatedObjectAssignmentSource(
  objectName: string,
  propertyName: string,
): string {
  return /^[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*$/u.test(propertyName)
    ? `${objectName}.${propertyName}`
    : `${objectName}[${toJavaScript(propertyName)}]`;
}

function argumentPropertyAssignment(argumentName: string): string {
  return generatedObjectAssignmentSource('args', argumentName);
}

function inputValueExpression(
  valueNode: ValueNode,
  type: GraphQLInputType,
  variableAvailability: VariableAvailability,
): string | undefined {
  if (!inputLiteralContainsVariable(valueNode)) {
    const coerced = coerceInputLiteral(valueNode, type);
    return coerced === undefined
      ? undefined
      : toSerializableJavaScript(coerced);
  }

  const isRequired = isNonNullType(type);
  const nullableType = isRequired ? type.ofType : type;

  if (valueNode.kind === Kind.VARIABLE) {
    return (isRequired
      ? variableAvailability.alwaysNonNull
      : variableAvailability.alwaysDefined
    ).has(valueNode.name.value)
      ? `coerced[${toJavaScript(valueNode.name.value)}]`
      : undefined;
  }

  if (valueNode.kind === Kind.LIST) {
    if (!isListType(nullableType)) {
      return undefined;
    }
    const itemType = nullableType.ofType;
    const itemExpressions = [];
    for (const itemNode of valueNode.values) {
      const itemExpression = inputValueExpression(
        itemNode,
        itemType,
        variableAvailability,
      );
      if (itemExpression === undefined) {
        return undefined;
      }
      itemExpressions.push(itemExpression);
    }
    return `[${itemExpressions.join(', ')}]`;
  }

  const objectValueNode = valueNode as ObjectValueNode;

  if (!isInputObjectType(nullableType) || nullableType.isOneOf) {
    return undefined;
  }

  const fields = nullableType.getFields();
  const providedFieldNames = new Set<string>();
  const fieldStatements: Array<string> = [];
  for (const fieldNode of objectValueNode.fields) {
    const fieldName = fieldNode.name.value;
    const field = fields[fieldName];
    if (field === undefined) {
      return undefined;
    }
    providedFieldNames.add(fieldName);
    const fieldExpression = inputValueExpression(
      fieldNode.value,
      field.type,
      variableAvailability,
    );
    if (fieldExpression === undefined) {
      return undefined;
    }
    fieldStatements.push(
      `${generatedObjectAssignmentSource(
        'object',
        fieldName,
      )} = ${fieldExpression};`,
    );
  }

  for (const field of Object.values(fields)) {
    if (
      !providedFieldNames.has(field.name) &&
      (field.default !== undefined || field.defaultValue !== undefined)
    ) {
      const defaultValue = coerceDefaultValue(field);
      if (defaultValue !== undefined) {
        const defaultValueSource = toSerializableJavaScript(defaultValue);
        if (defaultValueSource === undefined) {
          return undefined;
        }
        fieldStatements.push(
          `${generatedObjectAssignmentSource(
            'object',
            field.name,
          )} = ${defaultValueSource};`,
        );
      }
    } else if (
      !providedFieldNames.has(field.name) &&
      isRequiredInputField(field)
    ) {
      return undefined;
    }
  }

  const objectSource = generatedNullPrototypeObjectSource();
  return `(() => {
    const object = ${objectSource};
    ${fieldStatements.join('\n    ')}
    return object;
  })()`;
}

function inputLiteralContainsVariable(valueNode: ValueNode): boolean {
  switch (valueNode.kind) {
    case Kind.VARIABLE:
      return true;
    case Kind.LIST:
      return valueNode.values.some(inputLiteralContainsVariable);
    case Kind.OBJECT:
      return valueNode.fields.some((fieldNode) =>
        inputLiteralContainsVariable(fieldNode.value),
      );
    case Kind.NULL:
    case Kind.INT:
    case Kind.FLOAT:
    case Kind.STRING:
    case Kind.BOOLEAN:
    case Kind.ENUM:
      return false;
  }
}

function getStaticInclusionPlan(
  directives: ReadonlyArray<DirectiveNode> | undefined,
  variableAvailability: VariableAvailability,
): InclusionPlan {
  if (directives === undefined || directives.length === 0) {
    return { kind: 'include' };
  }

  const conditions: Array<string> = [];
  for (const directive of directives) {
    const directiveName = directive.name.value;
    if (directiveName !== 'skip' && directiveName !== 'include') {
      if (directiveName === 'stream') {
        continue;
      }
      continue;
    }

    const ifArgument = directive.arguments?.find(
      (argument) => argument.name.value === 'if',
    );
    if (ifArgument === undefined) {
      return { kind: 'dynamic' };
    }

    const ifExpression = directiveIfExpression(
      ifArgument.value,
      variableAvailability,
    );
    if (ifExpression === undefined) {
      return { kind: 'dynamic' };
    }

    if (directiveName === 'skip') {
      if (ifExpression === true) {
        return { kind: 'skip' };
      }
      if (ifExpression !== false) {
        conditions.push(`${ifExpression} !== true`);
      }
      continue;
    }

    if (ifExpression === false) {
      return { kind: 'skip' };
    }
    if (ifExpression !== true) {
      conditions.push(`${ifExpression} === true`);
    }
  }

  return conditions.length === 0
    ? { kind: 'include' }
    : { kind: 'include', condition: conditions.join(' && ') };
}

function getStaticDeferPlan(
  directives: ReadonlyArray<DirectiveNode> | undefined,
): StaticDeferPlan {
  const deferDirective = directives?.find(
    (directive) => directive.name.value === 'defer',
  );
  if (deferDirective === undefined) {
    return;
  }

  let label: string | undefined;
  for (const argument of deferDirective.arguments ?? []) {
    switch (argument.name.value) {
      case 'if':
        if (argument.value.kind === Kind.BOOLEAN) {
          if (!argument.value.value) {
            return { kind: 'disabled' };
          }
          break;
        }
        return { kind: 'dynamic' };
      case 'label':
        if (argument.value.kind === Kind.STRING) {
          label = argument.value.value;
        } else if (argument.value.kind !== Kind.NULL) {
          return { kind: 'dynamic' };
        }
        break;
    }
  }

  return {
    kind: 'defer',
    ...(label === undefined ? {} : { label }),
  };
}

function getStaticStreamPlan(
  directives: ReadonlyArray<DirectiveNode> | undefined,
): StreamPlan | 'dynamic' | undefined {
  const streamDirective = directives?.find(
    (directive) => directive.name.value === 'stream',
  );
  if (streamDirective === undefined) {
    return;
  }

  let condition: string | undefined;
  let initialCount = 0;
  let label: string | undefined;
  for (const argument of streamDirective.arguments ?? []) {
    switch (argument.name.value) {
      case 'if': {
        const ifExpression = incrementalDirectiveIfExpression(argument.value);
        if (ifExpression === undefined) {
          return 'dynamic';
        }
        if (ifExpression === false) {
          return;
        }
        if (ifExpression !== true) {
          condition = ifExpression;
        }
        break;
      }
      case 'initialCount':
        if (argument.value.kind !== Kind.INT) {
          return 'dynamic';
        }
        initialCount = Number(argument.value.value);
        break;
      case 'label':
        if (argument.value.kind === Kind.STRING) {
          label = argument.value.value;
        } else if (argument.value.kind !== Kind.NULL) {
          return 'dynamic';
        }
        break;
    }
  }

  return {
    initialCount,
    ...(condition === undefined ? {} : { condition }),
    ...(label === undefined ? {} : { label }),
  };
}

function incrementalDirectiveIfExpression(
  valueNode: ValueNode,
): boolean | string | undefined {
  switch (valueNode.kind) {
    case Kind.BOOLEAN:
      return valueNode.value;
    case Kind.VARIABLE:
      return `coerced[${toJavaScript(valueNode.name.value)}] !== false`;
    case Kind.NULL:
    case Kind.INT:
    case Kind.FLOAT:
    case Kind.STRING:
    case Kind.ENUM:
    case Kind.LIST:
    case Kind.OBJECT:
      return undefined;
  }
}

function directiveIfExpression(
  valueNode: ValueNode,
  variableAvailability: VariableAvailability,
): boolean | string | undefined {
  switch (valueNode.kind) {
    case Kind.BOOLEAN:
      return valueNode.value;
    case Kind.VARIABLE:
      return variableAvailability.alwaysNonNull.has(valueNode.name.value)
        ? `coerced[${toJavaScript(valueNode.name.value)}]`
        : undefined;
    case Kind.NULL:
    case Kind.INT:
    case Kind.FLOAT:
    case Kind.STRING:
    case Kind.ENUM:
    case Kind.LIST:
    case Kind.OBJECT:
      return undefined;
  }
}

function combineInclusionConditions(
  left: string | undefined,
  right: string | undefined,
): string | undefined {
  if (left === undefined) {
    return right;
  }
  if (right === undefined) {
    return left;
  }
  return `${left} && ${right}`;
}

function addDeferUsagePlan(
  deferUsages: Array<DeferUsagePlan>,
  selectionSetPath: ReadonlyArray<number>,
  parentIndex: number | undefined,
  deferPlan: Extract<StaticDeferPlan, { kind: 'defer' }>,
): number {
  const index = deferUsages.length;
  deferUsages.push({
    index,
    selectionSetPath,
    ...(parentIndex === undefined ? {} : { parentIndex }),
    ...(deferPlan.label === undefined ? {} : { label: deferPlan.label }),
  });
  return index;
}

function planSelectionSet({
  deferUsageIndex,
  deferUsages,
  errorPropagation,
  schema,
  fragments,
  hasFallbackFieldResolver,
  hideSuggestions,
  inclusionCondition,
  operationType,
  parentDeferUsageIndex,
  parentType,
  selectionSet,
  selectionSetAccessor,
  selectionSetPath,
  skipUnknownFields,
  variableAvailability,
  visitedFragmentNames,
}: SelectionSetPlanContext): Array<FieldPlan> | undefined {
  const fieldsByResponseName = new Map<string, FieldPlan>();
  const selections = selectionSet.selections;
  for (
    let selectionIndex = 0;
    selectionIndex < selections.length;
    selectionIndex++
  ) {
    const selection = selections[selectionIndex];
    if (selection.kind === 'FragmentSpread') {
      if ((selection.arguments?.length ?? 0) !== 0) {
        return undefined;
      }
      const fragmentInclusionPlan = getStaticInclusionPlan(
        selection.directives,
        variableAvailability,
      );
      if (fragmentInclusionPlan.kind === 'dynamic') {
        return undefined;
      }
      if (fragmentInclusionPlan.kind === 'skip') {
        continue;
      }
      const fragmentDeferPlan = getStaticDeferPlan(selection.directives);
      if (fragmentDeferPlan?.kind === 'dynamic') {
        return undefined;
      }
      const nextDeferUsageIndex =
        fragmentDeferPlan?.kind === 'defer'
          ? addDeferUsagePlan(
              deferUsages,
              selectionSetPath,
              parentDeferUsageIndex,
              fragmentDeferPlan,
            )
          : deferUsageIndex;
      const fragmentName = selection.name.value;
      const nextInclusionCondition = combineInclusionConditions(
        inclusionCondition,
        fragmentInclusionPlan.condition,
      );
      const visitedFragmentKey =
        nextInclusionCondition === undefined
          ? `${fragmentName}:${String(nextDeferUsageIndex)}`
          : `${fragmentName}:${nextInclusionCondition}:${String(
              nextDeferUsageIndex,
            )}`;
      if (visitedFragmentNames.has(visitedFragmentKey)) {
        continue;
      }
      const fragment = fragments[fragmentName];
      if (fragment === undefined) {
        continue;
      }
      if ((fragment.variableDefinitions?.length ?? 0) !== 0) {
        return undefined;
      }
      if (!fragmentConditionApplies(schema, parentType, fragment)) {
        continue;
      }
      visitedFragmentNames.add(visitedFragmentKey);
      const fragmentFields = planSelectionSet({
        deferUsageIndex: nextDeferUsageIndex,
        deferUsages,
        errorPropagation,
        schema,
        fragments,
        hasFallbackFieldResolver,
        hideSuggestions,
        inclusionCondition: nextInclusionCondition,
        operationType,
        parentDeferUsageIndex: nextDeferUsageIndex ?? parentDeferUsageIndex,
        parentType,
        selectionSet: fragment.selectionSet,
        selectionSetAccessor: `staticFragmentDefinitions[${toJavaScript(
          fragmentName,
        )}].selectionSet`,
        selectionSetPath,
        skipUnknownFields,
        variableAvailability,
        visitedFragmentNames,
      });
      if (
        fragmentFields === undefined ||
        !mergeFieldPlans(fieldsByResponseName, fragmentFields)
      ) {
        return undefined;
      }
      continue;
    }

    if (selection.kind === 'InlineFragment') {
      const fragmentInclusionPlan = getStaticInclusionPlan(
        selection.directives,
        variableAvailability,
      );
      if (fragmentInclusionPlan.kind === 'dynamic') {
        return undefined;
      }
      if (fragmentInclusionPlan.kind === 'skip') {
        continue;
      }
      const fragmentDeferPlan = getStaticDeferPlan(selection.directives);
      if (fragmentDeferPlan?.kind === 'dynamic') {
        return undefined;
      }
      if (!fragmentConditionApplies(schema, parentType, selection)) {
        continue;
      }
      const nextDeferUsageIndex =
        fragmentDeferPlan?.kind === 'defer'
          ? addDeferUsagePlan(
              deferUsages,
              selectionSetPath,
              parentDeferUsageIndex,
              fragmentDeferPlan,
            )
          : deferUsageIndex;
      const fragmentFields = planSelectionSet({
        deferUsageIndex: nextDeferUsageIndex,
        deferUsages,
        errorPropagation,
        schema,
        fragments,
        hasFallbackFieldResolver,
        hideSuggestions,
        inclusionCondition: combineInclusionConditions(
          inclusionCondition,
          fragmentInclusionPlan.condition,
        ),
        operationType,
        parentDeferUsageIndex: nextDeferUsageIndex ?? parentDeferUsageIndex,
        parentType,
        selectionSet: selection.selectionSet,
        selectionSetAccessor: `${selectionSetAccessor}.selections[${selectionIndex}].selectionSet`,
        selectionSetPath,
        skipUnknownFields,
        variableAvailability,
        visitedFragmentNames,
      });
      if (
        fragmentFields === undefined ||
        !mergeFieldPlans(fieldsByResponseName, fragmentFields)
      ) {
        return undefined;
      }
      continue;
    }

    const inclusionPlan = getStaticInclusionPlan(
      selection.directives,
      variableAvailability,
    );
    if (inclusionPlan.kind === 'dynamic') {
      return undefined;
    }
    if (inclusionPlan.kind === 'skip') {
      continue;
    }

    const fieldDef = schema.getField(parentType, selection.name.value);
    if (fieldDef === undefined) {
      if (skipUnknownFields) {
        continue;
      }
      return undefined;
    }
    const streamPlan = getStaticStreamPlan(selection.directives);
    if (
      streamPlan === 'dynamic' ||
      (operationType === 'subscription' && streamPlan !== undefined)
    ) {
      return undefined;
    }
    const argumentPlan = getArgumentPlan(
      fieldDef,
      selection,
      `${selectionSetAccessor}.selections[${selectionIndex}]`,
      hideSuggestions,
      variableAvailability,
    );
    if (argumentPlan === undefined) {
      return undefined;
    }
    const resolveMode =
      fieldDef.resolve === undefined
        ? hasFallbackFieldResolver
          ? 'customDefault'
          : 'default'
        : 'field';

    if (selection.selectionSet === undefined) {
      const outputKind = getLeafOutputKind(fieldDef.type);
      if (outputKind === undefined) {
        return undefined;
      }
      const builtinScalarName = getBuiltinLeafScalarName(
        fieldDef.type,
        outputKind,
      );
      if (streamPlan !== undefined && outputKind !== 'leafList') {
        return undefined;
      }
      if (
        !mergeFieldPlan(fieldsByResponseName, {
          argumentPlan,
          completedItemNonNull: getCompletedItemNonNull(fieldDef.type),
          completedNonNull: isNonNullType(fieldDef.type),
          deferUsageIndexes: [deferUsageIndex],
          errorPropagation,
          fieldName: selection.name.value,
          fieldNodeAccessors: [
            `${selectionSetAccessor}.selections[${selectionIndex}]`,
          ],
          inclusionCondition: combineInclusionConditions(
            inclusionCondition,
            inclusionPlan.condition,
          ),
          ...(builtinScalarName === undefined ? {} : { builtinScalarName }),
          outputKind,
          parentTypeName: parentType.name,
          resolveMode,
          responseName: selection.alias?.value ?? selection.name.value,
          ...(streamPlan === undefined ? {} : { streamPlan }),
        })
      ) {
        return undefined;
      }
      continue;
    }

    const objectOutput = getObjectOutputPlan(schema, fieldDef.type);
    if (objectOutput === undefined) {
      return undefined;
    }
    if (
      streamPlan !== undefined &&
      objectOutput.kind !== 'objectList' &&
      objectOutput.kind !== 'abstractList'
    ) {
      return undefined;
    }
    let childFields: Array<FieldPlan> | undefined;
    let possibleFields: Array<PossibleFieldsPlan> | undefined;
    let childTypeName: string | undefined;
    let objectTypeHasIsTypeOf: boolean | undefined;
    const childParentDeferUsageIndex = deferUsageIndex ?? parentDeferUsageIndex;
    switch (objectOutput.kind) {
      case 'object':
      case 'objectList':
        objectTypeHasIsTypeOf = objectOutput.objectType.isTypeOf !== undefined;
        childFields = planSelectionSet({
          deferUsageIndex: undefined,
          deferUsages,
          errorPropagation,
          schema,
          fragments,
          hasFallbackFieldResolver,
          hideSuggestions,
          inclusionCondition: undefined,
          operationType,
          parentDeferUsageIndex: childParentDeferUsageIndex,
          parentType: objectOutput.objectType,
          selectionSet: selection.selectionSet,
          selectionSetAccessor: `${selectionSetAccessor}.selections[${selectionIndex}].selectionSet`,
          selectionSetPath: [...selectionSetPath, selectionIndex],
          skipUnknownFields: true,
          variableAvailability,
          visitedFragmentNames: new Set(),
        });
        if (childFields === undefined) {
          return undefined;
        }
        childTypeName = objectOutput.objectType.name;
        break;
      case 'abstract':
      case 'abstractList':
        possibleFields = [];
        for (
          let possibleIndex = 0;
          possibleIndex < objectOutput.possibleTypes.length;
          possibleIndex++
        ) {
          const possibleType = objectOutput.possibleTypes[possibleIndex];
          const fieldsForType = planSelectionSet({
            deferUsageIndex: undefined,
            deferUsages,
            errorPropagation,
            schema,
            fragments,
            hasFallbackFieldResolver,
            hideSuggestions,
            inclusionCondition: undefined,
            operationType,
            parentDeferUsageIndex: childParentDeferUsageIndex,
            parentType: possibleType,
            selectionSet: selection.selectionSet,
            selectionSetAccessor: `${selectionSetAccessor}.selections[${selectionIndex}].selectionSet`,
            selectionSetPath: [
              ...selectionSetPath,
              selectionIndex,
              possibleIndex,
            ],
            skipUnknownFields: true,
            variableAvailability,
            visitedFragmentNames: new Set(),
          });
          if (fieldsForType === undefined) {
            return undefined;
          }
          possibleFields.push({
            fields: fieldsForType,
            typeName: possibleType.name,
          });
        }
    }
    if (
      !mergeFieldPlan(fieldsByResponseName, {
        argumentPlan,
        ...((childFields !== undefined &&
          selectionSetCanNullParent(childFields)) ||
        possibleFields?.some((possibleField) =>
          selectionSetCanNullParent(possibleField.fields),
        ) === true
          ? { childrenCanNullParent: true }
          : {}),
        completedItemNonNull: getCompletedItemNonNull(fieldDef.type),
        completedNonNull: isNonNullType(fieldDef.type),
        deferUsageIndexes: [deferUsageIndex],
        errorPropagation,
        fieldName: selection.name.value,
        fieldNodeAccessors: [
          `${selectionSetAccessor}.selections[${selectionIndex}]`,
        ],
        inclusionCondition: combineInclusionConditions(
          inclusionCondition,
          inclusionPlan.condition,
        ),
        outputKind: objectOutput.kind,
        parentTypeName: parentType.name,
        resolveMode,
        responseName: selection.alias?.value ?? selection.name.value,
        ...(streamPlan === undefined ? {} : { streamPlan }),
        ...(childFields === undefined ? {} : { fields: childFields }),
        ...(childTypeName === undefined ? {} : { childTypeName }),
        ...(objectTypeHasIsTypeOf === undefined
          ? {}
          : { objectTypeHasIsTypeOf }),
        ...(possibleFields === undefined ? {} : { possibleFields }),
      })
    ) {
      return undefined;
    }
  }

  return [...fieldsByResponseName.values()];
}

function selectionSetCanNullParent(fields: ReadonlyArray<FieldPlan>): boolean {
  return fields.some(
    (field) =>
      field.errorPropagation &&
      field.completedNonNull &&
      !isGeneratedTypenameField(field),
  );
}

function mergeFieldPlans(
  fieldsByResponseName: Map<string, FieldPlan>,
  fields: ReadonlyArray<FieldPlan>,
): boolean {
  for (const field of fields) {
    if (!mergeFieldPlan(fieldsByResponseName, field)) {
      return false;
    }
  }
  return true;
}

function mergeFieldPlan(
  fieldsByResponseName: Map<string, FieldPlan>,
  field: FieldPlan,
): boolean {
  const existingField = fieldsByResponseName.get(field.responseName);
  if (existingField === undefined) {
    fieldsByResponseName.set(field.responseName, field);
    return true;
  }

  if (existingField.fieldName !== field.fieldName) {
    return false;
  }

  if (!canMergeFieldPlans(existingField, field)) {
    return false;
  }

  existingField.fieldNodeAccessors.push(...field.fieldNodeAccessors);
  existingField.deferUsageIndexes.push(...field.deferUsageIndexes);
  if (existingField.fields !== undefined && field.fields !== undefined) {
    const fieldsByChildResponseName = new Map(
      existingField.fields.map((childField) => [
        childField.responseName,
        childField,
      ]),
    );
    if (!mergeFieldPlans(fieldsByChildResponseName, field.fields)) {
      return false;
    }
    existingField.fields = [...fieldsByChildResponseName.values()];
  }
  if (
    existingField.possibleFields !== undefined &&
    field.possibleFields !== undefined
  ) {
    for (
      let possibleIndex = 0;
      possibleIndex < existingField.possibleFields.length;
      possibleIndex++
    ) {
      const existingPossibleField = existingField.possibleFields[possibleIndex];
      const possibleField = field.possibleFields[possibleIndex];
      const fieldsByChildResponseName = new Map(
        existingPossibleField.fields.map((childField) => [
          childField.responseName,
          childField,
        ]),
      );
      if (!mergeFieldPlans(fieldsByChildResponseName, possibleField.fields)) {
        return false;
      }
      existingPossibleField.fields = [...fieldsByChildResponseName.values()];
    }
  }
  if (
    (existingField.fields !== undefined &&
      selectionSetCanNullParent(existingField.fields)) ||
    existingField.possibleFields?.some((possibleField) =>
      selectionSetCanNullParent(possibleField.fields),
    ) === true
  ) {
    existingField.childrenCanNullParent = true;
  } else {
    delete existingField.childrenCanNullParent;
  }
  return true;
}

function canMergeFieldPlans(left: FieldPlan, right: FieldPlan): boolean {
  return (
    left.argumentPlan.key === right.argumentPlan.key &&
    left.childTypeName === right.childTypeName &&
    left.completedItemNonNull === right.completedItemNonNull &&
    left.completedNonNull === right.completedNonNull &&
    left.errorPropagation === right.errorPropagation &&
    left.inclusionCondition === right.inclusionCondition &&
    left.builtinScalarName === right.builtinScalarName &&
    left.objectTypeHasIsTypeOf === right.objectTypeHasIsTypeOf &&
    left.outputKind === right.outputKind &&
    left.parentTypeName === right.parentTypeName &&
    left.resolveMode === right.resolveMode &&
    haveSameStreamPlan(left.streamPlan, right.streamPlan) &&
    (left.fields === undefined) === (right.fields === undefined) &&
    haveSamePossibleFieldTypes(left, right)
  );
}

function haveSameStreamPlan(
  left: StreamPlan | undefined,
  right: StreamPlan | undefined,
): boolean {
  return (
    left?.condition === right?.condition &&
    left?.initialCount === right?.initialCount &&
    left?.label === right?.label
  );
}

function haveSamePossibleFieldTypes(
  left: FieldPlan,
  right: FieldPlan,
): boolean {
  if (left.possibleFields === undefined) {
    return true;
  }
  const rightPossibleFields = right.possibleFields as Array<PossibleFieldsPlan>;
  return (
    left.possibleFields.length === rightPossibleFields.length &&
    left.possibleFields.every(
      (possibleField, index) =>
        possibleField.typeName === rightPossibleFields[index].typeName,
    )
  );
}

function fragmentConditionApplies(
  schema: GraphQLSchema,
  parentType: GraphQLObjectType,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
): boolean {
  const typeCondition = fragment.typeCondition;
  if (typeCondition === undefined) {
    return true;
  }

  const conditionalType = typeFromAST(schema, typeCondition);
  if (conditionalType === parentType) {
    return true;
  }
  return isAbstractType(conditionalType)
    ? schema.isSubType(conditionalType, parentType)
    : false;
}

function getLeafOutputKind(
  type: GraphQLOutputType,
): 'leaf' | 'leafList' | undefined {
  let nullableType = type;
  if (isNonNullType(nullableType)) {
    nullableType = nullableType.ofType;
  }
  if (isLeafType(nullableType)) {
    return 'leaf';
  }
  if (!isListType(nullableType)) {
    return undefined;
  }

  let itemType = nullableType.ofType;
  if (isNonNullType(itemType)) {
    itemType = itemType.ofType;
  }
  return isLeafType(itemType) ? 'leafList' : undefined;
}

function getBuiltinLeafScalarName(
  type: GraphQLOutputType,
  outputKind: 'leaf' | 'leafList',
): BuiltInScalarVariablePlan['scalarName'] | undefined {
  let nullableType = type;
  if (isNonNullType(nullableType)) {
    nullableType = nullableType.ofType;
  }
  if (outputKind === 'leaf') {
    return getBuiltinScalarName(nullableType);
  }

  invariant(isListType(nullableType));
  let itemType = nullableType.ofType;
  if (isNonNullType(itemType)) {
    itemType = itemType.ofType;
  }
  return getBuiltinScalarName(itemType);
}

function getCompletedItemNonNull(type: GraphQLOutputType): boolean {
  let nullableType = type;
  if (isNonNullType(nullableType)) {
    nullableType = nullableType.ofType;
  }
  return isListType(nullableType) && isNonNullType(nullableType.ofType);
}

function getObjectOutputPlan(
  schema: GraphQLSchema,
  type: GraphQLOutputType,
): ObjectOutputPlan | undefined {
  let nullableType = type;
  if (isNonNullType(nullableType)) {
    nullableType = nullableType.ofType;
  }
  if (isObjectType(nullableType)) {
    return { kind: 'object', objectType: nullableType };
  }
  if (isAbstractType(nullableType)) {
    return {
      kind: 'abstract',
      possibleTypes: schema.getPossibleTypes(nullableType),
    };
  }
  if (!isListType(nullableType)) {
    return undefined;
  }
  let itemType = nullableType.ofType;
  if (isNonNullType(itemType)) {
    itemType = itemType.ofType;
  }
  if (isObjectType(itemType)) {
    return { kind: 'objectList', objectType: itemType };
  }
  if (isAbstractType(itemType)) {
    return {
      kind: 'abstractList',
      possibleTypes: schema.getPossibleTypes(itemType),
    };
  }
  return undefined;
}

function operationSetup(
  operationPlan: OperationPlan,
  includeSubscriptionSource: boolean,
): string {
  const subscriptionSourceSetup =
    includeSubscriptionSource && operationPlan.operationType === 'subscription'
      ? `  const executeGeneratedSubscriptionSource =
    generatedRootType == null
      ? undefined
      : bindGeneratedSubscriptionSource(
          compiledExecution,
          generatedRootType,
          undefined,
        );
`
      : '';

  return `  const generatedRootType = compiledExecution.schema.getRootType(
    ${toJavaScript(operationPlan.operationType)},
  );
  const executeGeneratedRootFields =
    generatedRootType == null
      ? undefined
      : bindGeneratedRootFields(
          compiledExecution,
          generatedRootType,
          undefined,
        );
${subscriptionSourceSetup}`;
}

function fieldBindingFunctionName(
  selectionSetPath: ReadonlyArray<number>,
  parentTypeName: string,
): string {
  return selectionSetPath.length === 0
    ? 'bindGeneratedRootFields'
    : `bindGenerated${toIdentifierPart(
        parentTypeName,
      )}Fields${selectionSetPath.join('_')}`;
}

function abstractFieldBindingFunctionName(
  fieldPath: ReadonlyArray<number>,
  fieldName: string,
): string {
  return `bindGenerated${toIdentifierPart(
    fieldName,
  )}AbstractFields${fieldPath.join('_')}`;
}

function executeFunctionName(
  selectionSetPath: ReadonlyArray<number>,
  parentTypeName: string,
): string {
  return selectionSetPath.length === 0
    ? `executeGenerated${toIdentifierPart(parentTypeName)}RootFields`
    : `executeGenerated${toIdentifierPart(
        parentTypeName,
      )}SelectionSet${selectionSetPath.join('_')}`;
}

function abstractExecuteFunctionName(
  fieldPath: ReadonlyArray<number>,
  fieldName: string,
): string {
  return `executeGenerated${toIdentifierPart(
    fieldName,
  )}AbstractSelectionSet${fieldPath.join('_')}`;
}

function argumentFunctionName(fieldPath: ReadonlyArray<number>): string {
  return `getGeneratedArgumentValues${fieldPath.join('_')}`;
}

function generatedArgumentFunctions(operationPlan: OperationPlan): string {
  const chunks: Array<string> = [];
  emitArgumentFunctions([], operationPlan.fields);
  return chunks.join('\n\n');

  function emitArgumentFunctions(
    selectionSetPath: ReadonlyArray<number>,
    fields: ReadonlyArray<FieldPlan>,
  ): void {
    fields.forEach((field, index) => {
      const fieldPath = [...selectionSetPath, index];
      if (requiresGeneratedArgumentFunction(field.argumentPlan)) {
        chunks.push(
          generatedArgumentFunctionSource(
            argumentFunctionName(fieldPath),
            field.argumentPlan,
          ),
        );
      }
      if (field.fields !== undefined) {
        emitArgumentFunctions(fieldPath, field.fields);
      }
      if (field.possibleFields !== undefined) {
        field.possibleFields.forEach((possibleField, possibleIndex) => {
          emitArgumentFunctions(
            [...fieldPath, possibleIndex],
            possibleField.fields,
          );
        });
      }
    });
  }
}

function requiresGeneratedArgumentFunction(
  argumentPlan: ArgumentPlan,
): boolean {
  return argumentPlan.isConstant && hasGeneratedArgumentValues(argumentPlan);
}

function hasGeneratedArgumentValues(argumentPlan: ArgumentPlan): boolean {
  return (
    argumentPlan.statements.length !== 0 ||
    argumentPlan.returnExpression !== undefined ||
    argumentPlan.objectSource !== 'Object.create(null)'
  );
}

function hasGeneratedMetaFields(operationPlan: OperationPlan): boolean {
  return operationPlan.fields.some(hasGeneratedMetaField);
}

function hasGeneratedMetaField(field: FieldPlan): boolean {
  return (
    isGeneratedMetaFieldDefName(field.fieldName) ||
    field.fields?.some(hasGeneratedMetaField) === true ||
    field.possibleFields?.some((possibleField) =>
      possibleField.fields.some(hasGeneratedMetaField),
    ) === true
  );
}

function hasGeneratedListFields(operationPlan: OperationPlan): boolean {
  return operationPlan.fields.some(hasGeneratedListField);
}

function hasGeneratedListField(field: FieldPlan): boolean {
  return (
    field.outputKind === 'leafList' ||
    field.outputKind === 'objectList' ||
    field.outputKind === 'abstractList' ||
    field.fields?.some(hasGeneratedListField) === true ||
    field.possibleFields?.some((possibleField) =>
      possibleField.fields.some(hasGeneratedListField),
    ) === true
  );
}

function hasGeneratedAbstractFields(operationPlan: OperationPlan): boolean {
  return operationPlan.fields.some(hasGeneratedAbstractField);
}

function hasGeneratedAbstractField(field: FieldPlan): boolean {
  return (
    field.outputKind === 'abstract' ||
    field.outputKind === 'abstractList' ||
    field.fields?.some(hasGeneratedAbstractField) === true
  );
}

function hasGeneratedIncrementalFields(operationPlan: OperationPlan): boolean {
  return (
    operationPlan.deferUsages.length !== 0 ||
    operationPlan.fields.some(hasGeneratedStreamField)
  );
}

function hasGeneratedStreamField(field: FieldPlan): boolean {
  return (
    field.streamPlan !== undefined ||
    field.fields?.some(hasGeneratedStreamField) === true ||
    field.possibleFields?.some((possibleField) =>
      possibleField.fields.some(hasGeneratedStreamField),
    ) === true
  );
}

function hasGeneratedBuiltinOutputScalars(
  operationPlan: OperationPlan,
): boolean {
  return getGeneratedBuiltinOutputScalarNames(operationPlan).size !== 0;
}

function getGeneratedBuiltinScalarImportNames(
  operationPlan: OperationPlan,
  variableValuesPlan: VariableValuesPlan | undefined,
): ReadonlyArray<BuiltInScalarVariablePlan['scalarName']> {
  const scalarNames = new Set(
    getGeneratedBuiltinOutputScalarNames(operationPlan),
  );
  if (variableValuesPlan !== undefined) {
    for (const variable of variableValuesPlan.variables) {
      if (variable.kind === 'builtinScalar') {
        scalarNames.add(variable.scalarName);
      }
    }
  }
  return (['Boolean', 'Float', 'ID', 'Int', 'String'] as const).filter(
    (scalarName) => scalarNames.has(scalarName),
  );
}

function getGeneratedBuiltinOutputScalarNames(
  operationPlan: OperationPlan,
): ReadonlySet<BuiltInScalarVariablePlan['scalarName']> {
  const scalarNames = new Set<BuiltInScalarVariablePlan['scalarName']>();
  for (const field of operationPlan.fields) {
    collectGeneratedBuiltinOutputScalarNames(field, scalarNames);
  }
  return scalarNames;
}

function collectGeneratedBuiltinOutputScalarNames(
  field: FieldPlan,
  scalarNames: Set<BuiltInScalarVariablePlan['scalarName']>,
): void {
  if (
    (field.outputKind === 'leaf' || field.outputKind === 'leafList') &&
    field.builtinScalarName !== undefined
  ) {
    scalarNames.add(field.builtinScalarName);
  }
  if (field.fields !== undefined) {
    for (const childField of field.fields) {
      collectGeneratedBuiltinOutputScalarNames(childField, scalarNames);
    }
  }
  if (field.possibleFields !== undefined) {
    for (const possibleFields of field.possibleFields) {
      for (const possibleField of possibleFields.fields) {
        collectGeneratedBuiltinOutputScalarNames(possibleField, scalarNames);
      }
    }
  }
}

function generatedOutputScalarHelpersSource(
  operationPlan: OperationPlan,
): string {
  const scalarNames = getGeneratedBuiltinOutputScalarNames(operationPlan);
  if (scalarNames.size === 0) {
    return '';
  }

  return `
function isGeneratedObjectLike(value) {
  return (
    (typeof value === 'object' && value !== null) ||
    typeof value === 'function'
  );
}

function coerceGeneratedOutputValueObject(outputValue) {
  if (isGeneratedObjectLike(outputValue)) {
    if (typeof outputValue.valueOf === 'function') {
      const valueOfResult = outputValue.valueOf();
      if (!isGeneratedObjectLike(valueOfResult)) {
        return valueOfResult;
      }
    }
    if (typeof outputValue.toJSON === 'function') {
      return outputValue.toJSON();
    }
  }
  return outputValue;
}

${
  scalarNames.has('Int')
    ? `
function coerceGeneratedIntOutputValue(outputValue) {
  if (typeof outputValue === 'number') {
    return coerceGeneratedIntFromNumber(outputValue);
  }
  if (typeof outputValue === 'string') {
    return coerceGeneratedIntFromString(outputValue);
  }
  if (typeof outputValue === 'bigint') {
    return coerceGeneratedIntFromBigInt(outputValue);
  }
  const coercedValue = coerceGeneratedOutputValueObject(outputValue);
  if (coercedValue !== outputValue) {
    if (typeof coercedValue === 'number') {
      return coerceGeneratedIntFromNumber(coercedValue);
    }
    if (typeof coercedValue === 'boolean') {
      return coercedValue ? 1 : 0;
    }
    if (typeof coercedValue === 'string') {
      return coerceGeneratedIntFromString(coercedValue);
    }
    if (typeof coercedValue === 'bigint') {
      return coerceGeneratedIntFromBigInt(coercedValue);
    }
  }
  throw new GraphQLError(
    \`Int cannot represent non-integer value: \${inspect(coercedValue)}\`,
  );
}

function coerceGeneratedIntFromNumber(value) {
  if (!Number.isInteger(value)) {
    throw new GraphQLError(
      \`Int cannot represent non-integer value: \${inspect(value)}\`,
    );
  }
  if (value > 2147483647 || value < -2147483648) {
    throw new GraphQLError(
      \`Int cannot represent non 32-bit signed integer value: \${inspect(value)}\`,
    );
  }
  return value;
}

function coerceGeneratedIntFromString(value) {
  if (value === '') {
    throw new GraphQLError(
      \`Int cannot represent non-integer value: \${inspect(value)}\`,
    );
  }
  const num = Number(value);
  if (!Number.isInteger(num)) {
    throw new GraphQLError(
      \`Int cannot represent non-integer value: \${inspect(value)}\`,
    );
  }
  if (num > 2147483647 || num < -2147483648) {
    throw new GraphQLError(
      \`Int cannot represent non 32-bit signed integer value: \${inspect(value)}\`,
    );
  }
  return num;
}

function coerceGeneratedIntFromBigInt(value) {
  if (value > 2147483647 || value < -2147483648) {
    throw new GraphQLError(
      \`Int cannot represent non 32-bit signed integer value: \${String(value)}\`,
    );
  }
  return Number(value);
}
`
    : ''
}
${
  scalarNames.has('Float')
    ? `
function coerceGeneratedFloatOutputValue(outputValue) {
  if (typeof outputValue === 'number') {
    return coerceGeneratedFloatFromNumber(outputValue);
  }
  if (typeof outputValue === 'string') {
    return coerceGeneratedFloatFromString(outputValue);
  }
  if (typeof outputValue === 'bigint') {
    return coerceGeneratedFloatFromBigInt(outputValue);
  }
  const coercedValue = coerceGeneratedOutputValueObject(outputValue);
  if (coercedValue !== outputValue) {
    if (typeof coercedValue === 'number') {
      return coerceGeneratedFloatFromNumber(coercedValue);
    }
    if (typeof coercedValue === 'boolean') {
      return coercedValue ? 1 : 0;
    }
    if (typeof coercedValue === 'string') {
      return coerceGeneratedFloatFromString(coercedValue);
    }
    if (typeof coercedValue === 'bigint') {
      return coerceGeneratedFloatFromBigInt(coercedValue);
    }
  }
  throw new GraphQLError(
    \`Float cannot represent non numeric value: \${inspect(coercedValue)}\`,
  );
}

function coerceGeneratedFloatFromNumber(value) {
  if (!Number.isFinite(value)) {
    throw new GraphQLError(
      \`Float cannot represent non numeric value: \${inspect(value)}\`,
    );
  }
  return value;
}

function coerceGeneratedFloatFromString(value) {
  if (value === '') {
    throw new GraphQLError(
      \`Float cannot represent non numeric value: \${inspect(value)}\`,
    );
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new GraphQLError(
      \`Float cannot represent non numeric value: \${inspect(value)}\`,
    );
  }
  return num;
}

function coerceGeneratedFloatFromBigInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new GraphQLError(
      \`Float cannot represent non numeric value: \${inspect(value)} (value is too large)\`,
    );
  }
  if (BigInt(num) !== value) {
    throw new GraphQLError(
      \`Float cannot represent non numeric value: \${inspect(value)} (value would lose precision)\`,
    );
  }
  return num;
}
`
    : ''
}
${
  scalarNames.has('String')
    ? `
function coerceGeneratedStringOutputValue(outputValue) {
  if (typeof outputValue === 'number') {
    return coerceGeneratedStringFromNumber(outputValue);
  }
  const coercedValue = coerceGeneratedOutputValueObject(outputValue);
  if (coercedValue !== outputValue) {
    if (typeof coercedValue === 'string') {
      return coercedValue;
    }
    if (typeof coercedValue === 'boolean') {
      return coercedValue ? 'true' : 'false';
    }
    if (typeof coercedValue === 'number') {
      return coerceGeneratedStringFromNumber(coercedValue);
    }
    if (typeof coercedValue === 'bigint') {
      return String(coercedValue);
    }
  }
  throw new GraphQLError(
    \`String cannot represent value: \${inspect(outputValue)}\`,
  );
}

function coerceGeneratedStringFromNumber(value) {
  if (!Number.isFinite(value)) {
    throw new GraphQLError(\`String cannot represent value: \${inspect(value)}\`);
  }
  return String(value);
}
`
    : ''
}
${
  scalarNames.has('Boolean')
    ? `
function coerceGeneratedBooleanOutputValue(outputValue) {
  if (typeof outputValue === 'number') {
    return coerceGeneratedBooleanFromNumber(outputValue);
  }
  const coercedValue = coerceGeneratedOutputValueObject(outputValue);
  if (coercedValue !== outputValue) {
    if (typeof coercedValue === 'boolean') {
      return coercedValue;
    }
    if (typeof coercedValue === 'number') {
      return coerceGeneratedBooleanFromNumber(coercedValue);
    }
    if (typeof coercedValue === 'bigint') {
      return coercedValue !== 0n;
    }
  }
  throw new GraphQLError(
    \`Boolean cannot represent a non boolean value: \${inspect(coercedValue)}\`,
  );
}

function coerceGeneratedBooleanFromNumber(value) {
  if (!Number.isFinite(value)) {
    throw new GraphQLError(
      \`Boolean cannot represent a non boolean value: \${inspect(value)}\`,
    );
  }
  return value !== 0;
}
`
    : ''
}
${
  scalarNames.has('ID')
    ? `
function coerceGeneratedIDOutputValue(outputValue) {
  if (typeof outputValue === 'number') {
    return coerceGeneratedIDFromNumber(outputValue);
  }
  const coercedValue = coerceGeneratedOutputValueObject(outputValue);
  if (coercedValue !== outputValue) {
    if (typeof coercedValue === 'string') {
      return coercedValue;
    }
    if (typeof coercedValue === 'number') {
      return coerceGeneratedIDFromNumber(coercedValue);
    }
    if (typeof coercedValue === 'bigint') {
      return String(coercedValue);
    }
  }
  throw new GraphQLError(\`ID cannot represent value: \${inspect(outputValue)}\`);
}

function coerceGeneratedIDFromNumber(value) {
  if (!Number.isInteger(value)) {
    throw new GraphQLError(\`ID cannot represent value: \${inspect(value)}\`);
  }
  return String(value);
}
`
    : ''
}
`;
}

function isGeneratedMetaFieldName(fieldName: string): boolean {
  return (
    fieldName === '__schema' ||
    fieldName === '__type' ||
    fieldName === '__typename'
  );
}

function isGeneratedMetaFieldDefName(fieldName: string): boolean {
  return fieldName === '__schema' || fieldName === '__type';
}

function generatedArgumentFunctionSource(
  functionName: string,
  argumentPlan: ArgumentPlan,
): string {
  invariant(
    argumentPlan.isConstant,
    'Expected generated argument functions only for constant arguments.',
  );
  const valueName = `${functionName}Value`;
  if (argumentPlan.returnExpression !== undefined) {
    return `const ${valueName} = Object.freeze(${argumentPlan.returnExpression});

function ${functionName}() {
  return ${valueName};
}`;
  }
  return `const ${valueName} = Object.freeze((() => {
  const args = ${argumentPlan.objectSource};
${argumentPlan.statements.join('\n')}
  return args;
})());

function ${functionName}() {
  return ${valueName};
}`;
}

interface GeneratedArgumentValuesSource {
  setup: string;
  expression: string;
}

function generatedArgumentValuesSource(
  fieldPath: ReadonlyArray<number>,
  argumentPlan: ArgumentPlan,
  variableValuesExpression: string,
): GeneratedArgumentValuesSource {
  if (!hasGeneratedArgumentValues(argumentPlan)) {
    return { setup: '', expression: 'emptyGeneratedArgumentValues' };
  }

  if (argumentPlan.isConstant) {
    return { setup: '', expression: `${argumentFunctionName(fieldPath)}()` };
  }

  return {
    setup: `    const coerced = ${variableValuesExpression}.coerced;
    const args = ${argumentPlan.objectSource};
${argumentPlan.statements
  .map((statement) => indentGeneratedSource(statement, '  '))
  .join('\n')}`,
    expression: 'args',
  };
}

function generatedFieldBindingFunctions(operationPlan: OperationPlan): string {
  const plan = operationPlan;
  const chunks: Array<string> = [];
  emitBindingFunction(
    [],
    plan.rootTypeName,
    plan.fields,
    plan.serialRoot,
    false,
  );
  const source = chunks.join('\n\n');
  return plan.deferUsages.length === 0
    ? stripGeneratedDeliveryGroupMapSource(source)
    : source;

  function emitBindingFunction(
    selectionSetPath: ReadonlyArray<number>,
    parentTypeName: string,
    fields: ReadonlyArray<FieldPlan>,
    serial: boolean,
    needsDynamicPathFactory: boolean,
  ): void {
    const functionName = fieldBindingFunctionName(
      selectionSetPath,
      parentTypeName,
    );
    const selectionSetName = executeFunctionName(
      selectionSetPath,
      parentTypeName,
    );
    const localDeferUsages = plan.deferUsages.filter((deferUsage) =>
      haveSameSelectionSetPath(deferUsage.selectionSetPath, selectionSetPath),
    );
    const conditionNames = getGeneratedConditionNames(fields);
    const fieldBindingResults = fields.map((field, index) => {
      const childPath = [...selectionSetPath, index];
      let childFunctionName = 'undefined';
      let childExecutorName: string | undefined;
      const childNeedsDynamicPathFactory =
        field.outputKind === 'objectList' ||
        (needsDynamicPathFactory && field.outputKind === 'object');
      const childUsesOnlyDynamicPath = field.outputKind === 'objectList';
      if (field.fields !== undefined) {
        const childTypeName = field.childTypeName;
        invariant(
          childTypeName !== undefined,
          'Expected an object field plan to include a child type name.',
        );
        childFunctionName = fieldBindingFunctionName(childPath, childTypeName);
        emitBindingFunction(
          childPath,
          childTypeName,
          field.fields,
          false,
          childNeedsDynamicPathFactory,
        );
        childExecutorName = `children${index}`;
      }
      if (field.possibleFields !== undefined) {
        childFunctionName = abstractFieldBindingFunctionName(
          childPath,
          field.fieldName,
        );
        emitAbstractBindingFunction(childPath, field);
        childExecutorName = `children${index}`;
      }
      const executeName = `${selectionSetName}${toIdentifierPart(
        field.fieldName,
      )}Field${index}`;
      const completeName = `${executeName}Complete`;
      const sharedDefaultLeafName = `${selectionSetName}DefaultLeafField`;
      const useSharedDefaultLeaf = isGeneratedSharedDefaultLeafField(field);
      const sourceObjectArgument = canUseSelectionSetSourceObject(field)
        ? 'sourceObject'
        : 'undefined';
      const call =
        field.outputKind === 'leaf' && isGeneratedTypenameField(field)
          ? generatedTypenameFieldSource(field)
          : useSharedDefaultLeaf
            ? generatedSharedDefaultLeafFieldCallSource({
                executeName: sharedDefaultLeafName,
                fieldIndex: index,
                fieldPlan: field,
                sourceObjectName: sourceObjectArgument,
              })
            : field.outputKind === 'leaf'
              ? `  ${executeName}(
		    executor,
		    runner,
	    source,
	    ${sourceObjectArgument},
	    target,
	    parentNullTarget,
	    path${index},
	  );`
              : `  ${executeName}(
	    executor,
	    runner,
	    source,
	    ${sourceObjectArgument},
	    target,
	    parentNullTarget,
	    deliveryGroupMap,
	  );`;
      const dynamicCall =
        field.outputKind === 'leaf' && isGeneratedTypenameField(field)
          ? generatedTypenameFieldSource(field)
          : useSharedDefaultLeaf
            ? generatedSharedDefaultLeafFieldCallSource({
                executeName: sharedDefaultLeafName,
                fieldIndex: index,
                fieldPlan: field,
                sourceObjectName: sourceObjectArgument,
              })
            : field.outputKind === 'leaf'
              ? `  ${executeName}(
		    executor,
		    runner,
	    source,
	    ${sourceObjectArgument},
	    target,
	    parentNullTarget,
	    path${index},
	  );`
              : `  ${executeName}(
	    executor,
	    runner,
	    source,
	    ${sourceObjectArgument},
	    target,
	    parentNullTarget,
	    deliveryGroupMap,
	    path${index},
	  );`;
      const fieldSource = useSharedDefaultLeaf
        ? ''
        : field.outputKind === 'leaf'
          ? isGeneratedTypenameField(field)
            ? ''
            : `${generatedLeafFieldFunctionSource({
                completeName,
                executeName,
                fieldIndex: index,
                fieldPath: childPath,
                fieldPlan: field,
                sourceObjectName: canUseSelectionSetSourceObject(field)
                  ? 'sourceObject'
                  : undefined,
              })}

${generatedLeafFieldCompletionFunctionSource(completeName, field, index)}`
          : generatedFieldFunctionSource({
              childSelectionSetName: childExecutorName,
              completeName,
              executeName,
              fieldIndex: index,
              fieldPath: childPath,
              fieldPlan: field as NonLeafFieldPlan,
              sourceObjectName: canUseSelectionSetSourceObject(field)
                ? 'sourceObject'
                : undefined,
            });
      return {
        declarations: generatedFieldBindingDeclarationSource(
          field,
          index,
          childFunctionName,
          childNeedsDynamicPathFactory,
          childUsesOnlyDynamicPath,
        ),
        call: withInclusionCondition(
          call,
          getGeneratedConditionExpression(
            field.inclusionCondition,
            conditionNames,
          ),
        ),
        dynamicCall: withInclusionCondition(
          dynamicCall,
          getGeneratedConditionExpression(
            field.inclusionCondition,
            conditionNames,
          ),
        ),
        source: fieldSource,
        usesSharedDefaultLeaf: useSharedDefaultLeaf,
      };
    });
    const conditionSetup = generatedConditionSetup(conditionNames);
    const sourceObjectSetup = generatedSourceObjectSetup(fields);
    const fieldCalls = fieldBindingResults.map((result) => result.call);
    const dynamicFieldCalls = fieldBindingResults.map(
      (result) => result.dynamicCall,
    );
    const fieldSources = fieldBindingResults
      .map((result) => result.source)
      .join('\n\n');
    const sharedDefaultLeafSource = fieldBindingResults.some(
      (result) => result.usesSharedDefaultLeaf,
    )
      ? generatedSharedDefaultLeafFieldFunctionSource(
          `${selectionSetName}DefaultLeafField`,
        )
      : '';
    const selectionSetSource = generatedSelectionSetFunction({
      conditionSetup: `${conditionSetup}${sourceObjectSetup}`,
      fields,
      fieldCalls,
      localDeferUsages,
      selectionSetName,
      serial,
    });
    const dynamicSelectionSetSource = needsDynamicPathFactory
      ? `function ${selectionSetName}WithParentPath(
  executor,
  runner,
  source,
  target,
  parentNullTarget,
  deliveryGroupMap,
  parentPath,
) {
${generatedFieldPathDeclarationsSource(fields)}
${indentGeneratedSource(
  generatedSelectionSetBody({
    conditionSetup: `${conditionSetup}${sourceObjectSetup}`,
    fields,
    fieldCalls: dynamicFieldCalls,
    localDeferUsages,
    selectionSetName: `${selectionSetName}WithParentPath`,
    serial,
  }),
  '  ',
)}
}

${selectionSetName}.withParentPath = ${selectionSetName}WithParentPath;`
      : '';
    chunks.push(`function ${functionName}(
  compiledExecution,
  parentType,
  parentPath,
) {
  if (parentType.name !== ${toJavaScript(parentTypeName)}) {
    return undefined;
  }
  const schema = compiledExecution.schema;
  const parentFields = parentType.getFields();
${fieldBindingResults.map((result) => result.declarations).join('\n')}
${indentGeneratedSource(selectionSetSource, '  ')}
${indentGeneratedSource(sharedDefaultLeafSource, '  ')}
${indentGeneratedSource(fieldSources, '  ')}
${indentGeneratedSource(dynamicSelectionSetSource, '  ')}
  return ${selectionSetName};
}`);
  }

  function emitAbstractBindingFunction(
    fieldPath: ReadonlyArray<number>,
    field: FieldPlan,
  ): void {
    invariant(field.possibleFields !== undefined);
    const declarations = field.possibleFields.map(
      (possibleField, possibleIndex) => {
        const possiblePath = [...fieldPath, possibleIndex];
        const functionName = fieldBindingFunctionName(
          possiblePath,
          possibleField.typeName,
        );
        emitBindingFunction(
          possiblePath,
          possibleField.typeName,
          possibleField.fields,
          false,
          false,
        );
        const typeName = `type${possibleIndex}`;
        const executeName = `execute${possibleIndex}`;
        return `  const ${typeName} = typeMap[${toJavaScript(
          possibleField.typeName,
        )}];
  if (${typeName} == null) {
    return undefined;
  }
  const ${executeName} = ${functionName}(
    compiledExecution,
    ${typeName},
    parentPath,
  );
  if (${executeName} === undefined) {
    return undefined;
  }`;
      },
    );
    const cases = field.possibleFields.map(
      (possibleField, possibleIndex) =>
        `      case ${toJavaScript(possibleField.typeName)}:
        return execute${possibleIndex}(
          executor,
          runner,
          source,
          target,
          parentNullTarget,
          deliveryGroupMap,
        );`,
    );
    chunks.push(`function ${abstractFieldBindingFunctionName(fieldPath, field.fieldName)}(
  compiledExecution,
  abstractType,
  parentPath,
) {
  const typeMap = compiledExecution.schema.getTypeMap();
${declarations.join('\n')}
  return function ${abstractExecuteFunctionName(fieldPath, field.fieldName)}(
    executor,
    runner,
    source,
    target,
    parentNullTarget,
    deliveryGroupMap,
    runtimeType,
  ) {
    switch (runtimeType.name) {
${cases.join('\n')}
    }
  };
}`);
  }
}

function stripGeneratedDeliveryGroupMapSource(source: string): string {
  return source
    .replace(/\n[ \t]*deliveryGroupMap,\n/g, '\n')
    .replace(
      /\n([ \t]*)undefined,\n\1(fieldPath|itemPath|runtimeType|path\d+),/g,
      '\n$1$2,',
    );
}

function haveSameSelectionSetPath(
  left: ReadonlyArray<number>,
  right: ReadonlyArray<number>,
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function generatedFieldBindingDeclarationSource(
  field: FieldPlan,
  index: number,
  childFunctionName: string,
  childNeedsDynamicPathFactory: boolean,
  childUsesOnlyDynamicPath: boolean,
): string {
  if (isGeneratedTypenameField(field)) {
    return '';
  }

  const fieldDefName = `fieldDef${index}`;
  const returnTypeName = `returnType${index}`;
  const fieldNodesName = `fieldNodes${index}`;
  const fieldDetailsListName = `fieldDetailsList${index}`;
  const pathName = `path${index}`;
  const childrenName = `children${index}`;
  const childTypeExpression =
    field.outputKind === 'object' || field.outputKind === 'objectList'
      ? `objectType${index}`
      : `abstractType${index}`;
  const childrenSource =
    childFunctionName === 'undefined'
      ? ''
      : childNeedsDynamicPathFactory
        ? childUsesOnlyDynamicPath
          ? `  const ${childrenName}Template = ${childFunctionName}(
    compiledExecution,
    ${childTypeExpression},
    ${pathName},
  );
  if (${childrenName}Template === undefined) {
    return undefined;
  }
  const ${childrenName} = ${childrenName}Template.withParentPath;
`
          : `  const ${childrenName}Template = ${childFunctionName}(
    compiledExecution,
    ${childTypeExpression},
    ${pathName},
  );
  if (${childrenName}Template === undefined) {
    return undefined;
  }
  function ${childrenName}(
    executor,
    runner,
    source,
    target,
    parentNullTarget,
    deliveryGroupMap,
    runtimeParentPath,
  ) {
    if (runtimeParentPath === undefined || runtimeParentPath === ${pathName}) {
      ${childrenName}Template(
      executor,
      runner,
      source,
      target,
      parentNullTarget,
      deliveryGroupMap,
      );
      return;
    }
    ${childrenName}Template.withParentPath(
      executor,
      runner,
      source,
      target,
      parentNullTarget,
      deliveryGroupMap,
      runtimeParentPath,
    );
  }
`
        : `  const ${childrenName} = ${childFunctionName}(
    compiledExecution,
    ${childTypeExpression},
    ${pathName},
  );
  if (${childrenName} === undefined) {
    return undefined;
  }
`;

  return `${generatedFieldDefSource(field, fieldDefName)}
  if (${fieldDefName} === undefined) {
    return undefined;
  }
${generatedResolveModeGuardSource(fieldDefName, field.resolveMode)}
  const ${returnTypeName} = ${fieldDefName}.type;
${generatedResolveFnBindingSource(field, index, fieldDefName)}
${generatedOutputTypeBindingsSource(field, index, returnTypeName)}
  const ${pathName} = {
    prev: parentPath,
    key: ${toJavaScript(field.responseName)},
    typename: ${toJavaScript(field.parentTypeName)},
  };
  const ${fieldNodesName} = [${field.fieldNodeAccessors.join(', ')}];
  const ${fieldDetailsListName} = [
${field.fieldNodeAccessors
  .map((_fieldNodeAccessor, fieldNodeIndex) =>
    generatedFieldDetailsSource(fieldNodesName, fieldNodeIndex),
  )
  .join(',\n')}
  ];
${childrenSource}`;
}

function generatedFieldPathDeclarationsSource(
  fields: ReadonlyArray<FieldPlan>,
): string {
  return fields
    .map((field, index) => {
      if (isGeneratedTypenameField(field)) {
        return '';
      }
      return `  const path${index} = {
    prev: parentPath,
    key: ${toJavaScript(field.responseName)},
    typename: ${toJavaScript(field.parentTypeName)},
  };`;
    })
    .filter((source) => source.length > 0)
    .join('\n');
}

function generatedFieldDefSource(
  field: FieldPlan,
  fieldDefName: string,
): string {
  switch (field.fieldName) {
    case '__schema':
      return `  const ${fieldDefName} = SchemaMetaFieldDef;`;
    case '__type':
      return `  const ${fieldDefName} = TypeMetaFieldDef;`;
    default:
      return `  const ${fieldDefName} = parentFields[${toJavaScript(
        field.fieldName,
      )}];`;
  }
}

function generatedResolveModeGuardSource(
  fieldDefName: string,
  resolveMode: FieldPlan['resolveMode'],
): string {
  switch (resolveMode) {
    case 'default':
      return `  if (${fieldDefName}.resolve !== undefined || compiledExecution.fieldResolver != null) {
    return undefined;
  }`;
    case 'field':
      return `  if (${fieldDefName}.resolve === undefined) {
    return undefined;
  }`;
    case 'customDefault':
      return `  if (${fieldDefName}.resolve !== undefined || compiledExecution.fieldResolver == null) {
    return undefined;
  }`;
  }
}

function generatedResolveFnBindingSource(
  field: FieldPlan,
  index: number,
  fieldDefName: string,
): string {
  switch (field.resolveMode) {
    case 'default':
      return '';
    case 'field':
      return `  const resolveFn${index} = ${fieldDefName}.resolve;`;
    case 'customDefault':
      return `  const resolveFn${index} = compiledExecution.fieldResolver;`;
  }
}

function generatedFieldDetailsSource(
  fieldNodesName: string,
  fieldNodeIndex: number,
): string {
  return `    {
      node: ${fieldNodesName}[${String(fieldNodeIndex)}],
    }`;
}

function generatedOutputTypeBindingsSource(
  field: FieldPlan,
  index: number,
  returnType: string,
): string {
  const nullableReturnType = field.completedNonNull
    ? `${returnType}.ofType`
    : returnType;

  if (
    field.outputKind === 'leafList' ||
    field.outputKind === 'objectList' ||
    field.outputKind === 'abstractList'
  ) {
    const listType = nullableReturnType;
    const itemType = `${listType}.ofType`;
    const nullableItemType = field.completedItemNonNull
      ? `${itemType}.ofType`
      : itemType;
    const itemTypeSource = `  const itemType${index} = ${itemType};`;
    if (field.outputKind === 'leafList') {
      return `${itemTypeSource}
  const leafType${index} = ${nullableItemType};
${generatedOutputCoerceBindingSource(index, field, `leafType${index}`)};`;
    }
    if (field.outputKind === 'objectList') {
      return `${itemTypeSource}
  const objectType${index} = ${nullableItemType};
${generatedIsTypeOfGuardSource(field, `objectType${index}`)}`;
    }
    return `${itemTypeSource}
  const abstractType${index} = ${nullableItemType};`;
  }

  if (field.outputKind === 'leaf') {
    return `  const leafType${index} = ${nullableReturnType};
${generatedOutputCoerceBindingSource(index, field, `leafType${index}`)};`;
  }
  if (field.outputKind === 'object') {
    return `  const objectType${index} = ${nullableReturnType};
${generatedIsTypeOfGuardSource(field, `objectType${index}`)}`;
  }
  return `  const abstractType${index} = ${nullableReturnType};`;
}

function generatedOutputCoerceBindingSource(
  index: number,
  field: FieldPlan,
  leafTypeName: string,
): string {
  const helperName = generatedBuiltinOutputCoerceFunctionName(
    field.builtinScalarName,
  );
  if (helperName === undefined) {
    return `  const coerceOutputValue${index} = ${leafTypeName}.coerceOutputValue.bind(${leafTypeName})`;
  }
  const specifiedScalarName = `GraphQL${field.builtinScalarName}`;
  return `  if (${leafTypeName}.coerceOutputValue !== ${specifiedScalarName}.coerceOutputValue) {
    return undefined;
  }
  const coerceOutputValue${index} = ${helperName}`;
}

function generatedBuiltinOutputCoerceFunctionName(
  scalarName: string | undefined,
): string | undefined {
  switch (scalarName) {
    case 'Boolean':
      return 'coerceGeneratedBooleanOutputValue';
    case 'Float':
      return 'coerceGeneratedFloatOutputValue';
    case 'ID':
      return 'coerceGeneratedIDOutputValue';
    case 'Int':
      return 'coerceGeneratedIntOutputValue';
    case 'String':
      return 'coerceGeneratedStringOutputValue';
    default:
      return undefined;
  }
}

function generatedIsTypeOfGuardSource(
  field: FieldPlan,
  objectTypeName: string,
): string {
  return field.objectTypeHasIsTypeOf
    ? `  if (${objectTypeName}.isTypeOf === undefined) {
    return undefined;
  }`
    : `  if (${objectTypeName}.isTypeOf !== undefined) {
    return undefined;
  }`;
}

function generatedSubscriptionSourceFieldFunction(
  operationPlan: OperationPlan,
): string {
  invariant(operationPlan.operationType === 'subscription');
  const declarations = operationPlan.fields
    .map((field, index) =>
      generatedSubscriptionSourceFieldDeclarationSource(field, index),
    )
    .join('\n');
  const conditionSetup = operationPlan.fields.some(
    (field) => field.inclusionCondition !== undefined,
  )
    ? `  const coerced = validatedExecutionArgs.variableValues.coerced;\n`
    : '';
  const fieldChecks = operationPlan.fields.map((field, index) => {
    const returnSource = `  return executeGeneratedSubscriptionSourceField${index}(
    validatedExecutionArgs,
  );`;
    if (field.inclusionCondition === undefined) {
      return returnSource;
    }
    return `  if (${field.inclusionCondition}) {
${indentGeneratedSource(returnSource, '  ')}
  }`;
  });
  const fieldFunctions = operationPlan.fields
    .map((field, index) => generatedSubscriptionSourceFieldSource(field, index))
    .join('\n\n');
  const noSelectedFieldSource = operationPlan.fields.every(
    (field) => field.inclusionCondition !== undefined,
  )
    ? `\n    throw new GraphQLError('Subscription operation must select a field.');`
    : '';

  return `function bindGeneratedSubscriptionSource(
  compiledExecution,
  parentType,
  parentPath,
) {
  if (parentType.name !== ${toJavaScript(operationPlan.rootTypeName)}) {
    return undefined;
  }
  const schema = compiledExecution.schema;
  const parentFields = parentType.getFields();
${declarations}

  function executeGeneratedSubscriptionSource(validatedExecutionArgs) {
${conditionSetup}${fieldChecks.join('\n')}${noSelectedFieldSource}
  }

${indentGeneratedSource(fieldFunctions, '  ')}

  return executeGeneratedSubscriptionSource;
}`;
}

function generatedSubscriptionSourceFieldSource(
  fieldPlan: FieldPlan,
  fieldIndex: number,
): string {
  const argumentValues = generatedArgumentValuesSource(
    [fieldIndex],
    fieldPlan.argumentPlan,
    'validatedExecutionArgs.variableValues',
  );
  return `function executeGeneratedSubscriptionSourceField${fieldIndex}(
  validatedExecutionArgs,
) {
${generatedSubscriptionSourceFieldAliasSource(fieldIndex)}
  const {
    rootValue,
    contextValue,
    externalAbortSignal,
  } = validatedExecutionArgs;
  const sharedExecutionContext =
    createSharedExecutionContext(externalAbortSignal);
${argumentValues.setup === '' ? '' : `${argumentValues.setup}\n`}
  const info = ${generatedResolveInfoObjectSource({
    fieldName: toJavaScript(fieldPlan.fieldName),
    fieldNodes: 'fieldNodes',
    helpersName: 'sharedExecutionContext',
    parentType: 'parentType',
    path: 'fieldPath',
    returnType: 'returnType',
  })};

  try {
    const result = subscribeFn${fieldIndex}(
      rootValue,
      ${argumentValues.expression},
      contextValue,
      info,
    );

    if (result != null && typeof result.then === 'function') {
      const promisedResult = Promise.resolve(result);
      const promise = externalAbortSignal
        ? cancellablePromise(promisedResult, externalAbortSignal)
        : promisedResult;
      return promise
        .then(assertGeneratedEventStream)
        .then(undefined, (error) => {
          throw locatedError(
            error,
            fieldNodes,
            pathToArray(fieldPath),
          );
        });
    }
    return assertGeneratedEventStream(result);
  } catch (error) {
    throw locatedError(error, fieldNodes, pathToArray(fieldPath));
  }
}`;
}

function generatedSubscriptionSourceFieldDeclarationSource(
  field: FieldPlan,
  index: number,
): string {
  const fieldDefName = `fieldDef${index}`;
  const returnTypeName = `returnType${index}`;
  const fieldNodesName = `fieldNodes${index}`;
  const pathName = `path${index}`;

  return `${generatedFieldDefSource(field, fieldDefName)}
  if (${fieldDefName} === undefined) {
    return undefined;
  }
  const ${returnTypeName} = ${fieldDefName}.type;
  const subscribeFn${index} =
    ${fieldDefName}.subscribe ??
    (compiledExecution.subscribeFieldResolver ?? defaultFieldResolver);
  const ${pathName} = {
    prev: parentPath,
    key: ${toJavaScript(field.responseName)},
    typename: ${toJavaScript(field.parentTypeName)},
  };
  const ${fieldNodesName} = [${field.fieldNodeAccessors.join(', ')}];`;
}

function generatedSubscriptionSourceFieldAliasSource(
  fieldIndex: number,
): string {
  return `  const fieldNodes = fieldNodes${fieldIndex};
  const returnType = returnType${fieldIndex};
  const fieldPath = path${fieldIndex};`;
}

function isGeneratedTypenameField(field: FieldPlan): boolean {
  return field.fieldName === '__typename';
}

function generatedResultObjectSource(): string {
  return generatedNullPrototypeObjectSource();
}

function generatedAbstractResultObjectSource(): string {
  return generatedNullPrototypeObjectSource();
}

interface GeneratedSelectionSetSourceContext {
  conditionSetup: string;
  fields: ReadonlyArray<FieldPlan>;
  fieldCalls: ReadonlyArray<string>;
  localDeferUsages: ReadonlyArray<DeferUsagePlan>;
  selectionSetName: string;
  serial: boolean;
}

function generatedSelectionSetFunction({
  conditionSetup,
  fields,
  fieldCalls,
  localDeferUsages,
  selectionSetName,
  serial,
}: GeneratedSelectionSetSourceContext): string {
  return `function ${selectionSetName}(
  executor,
  runner,
  source,
  target,
  parentNullTarget,
  deliveryGroupMap,
) {
${generatedSelectionSetBody({
  conditionSetup,
  fields,
  fieldCalls,
  localDeferUsages,
  selectionSetName,
  serial,
})}
}`;
}

function generatedSelectionSetBody({
  conditionSetup,
  fields,
  fieldCalls,
  localDeferUsages,
  selectionSetName,
  serial,
}: GeneratedSelectionSetSourceContext): string {
  const deferGroups = generatedDeferFieldGroups(fields, fieldCalls);
  const localDeferUsageIndexes = new Set(
    localDeferUsages.map((deferUsage) => deferUsage.index),
  );
  if (deferGroups.length === 0 && localDeferUsages.length === 0) {
    return serial
      ? generatedSerialSelectionSetBody(conditionSetup, fieldCalls)
      : generatedParallelSelectionSetBody(conditionSetup, fieldCalls);
  }

  const currentFieldCalls = fieldCalls.filter((_call, index) => {
    const usageIndexes = generatedFilteredDeferUsageIndexes(fields[index]);
    return usageIndexes.length === 0;
  });
  const allFieldsBody = serial
    ? generatedSerialSelectionSetBody('', fieldCalls)
    : generatedParallelSelectionSetBody('', fieldCalls);
  const currentFieldsBody = serial
    ? generatedSerialSelectionSetBody('', currentFieldCalls)
    : generatedParallelSelectionSetBody('', currentFieldCalls);
  const localDeferSetup = generatedLocalDeferUsageSetupSource(localDeferUsages);
  const groupSources = deferGroups
    .map((group, groupIndex) =>
      generatedDeferGroupSource(selectionSetName, group, groupIndex),
    )
    .join('\n');

  invariant(localDeferUsages.length > 0);
  const localDeliverySetup = `${localDeferSetup}  const generatedDelivery = executor.getNewDeliveryGroupMap(
    [${localDeferUsages
      .map((deferUsage) => `deferUsage${String(deferUsage.index)}`)
      .join(', ')}],
    deliveryGroupMap,
    parentPath,
  );
  deliveryGroupMap = generatedDelivery.newDeliveryGroupMap;
  executor.groups.push(...generatedDelivery.newDeliveryGroups);
`;

  return `${conditionSetup}${groupSources}
  if (executor.mode === 'ignore') {
${indentGeneratedSource(allFieldsBody, '    ')}
    return;
  }
  if (executor.mode === 'throw') {
    executor.throwUnexpectedIncremental();
  }
${localDeliverySetup}${currentFieldsBody}${deferGroups
    .map((group, groupIndex) => {
      const setName = `deferUsageSet${groupIndex}`;
      return `  const ${setName} = new Set([${group.usageIndexes
        .map((usageIndex) =>
          generatedDeferUsageReferenceSource(
            usageIndex,
            localDeferUsageIndexes,
          ),
        )
        .join(', ')}]);
  if (executor.isCurrentDeferUsageSet(${setName})) {
    ${selectionSetName}DeferGroup${groupIndex}(
      executor,
      runner,
      source,
      target,
      parentNullTarget,
      deliveryGroupMap,
    );
  } else {
    executor.deferPreplannedExecutionGroup(
      ${setName},
      deliveryGroupMap,
      parentPath,
      source,
      ${selectionSetName}DeferGroup${groupIndex},
    );
  }`;
    })
    .join('\n')}`;
}

function generatedParallelSelectionSetBody(
  conditionSetup: string,
  fieldCalls: ReadonlyArray<string>,
): string {
  return `${conditionSetup}${fieldCalls.join('\n')}`;
}

interface GeneratedDeferFieldGroup {
  calls: ReadonlyArray<string>;
  usageIndexes: ReadonlyArray<number>;
}

function generatedDeferFieldGroups(
  fields: ReadonlyArray<FieldPlan>,
  fieldCalls: ReadonlyArray<string>,
): ReadonlyArray<GeneratedDeferFieldGroup> {
  const groupsByKey = new Map<
    string,
    { calls: Array<string>; usageIndexes: ReadonlyArray<number> }
  >();
  fields.forEach((field, index) => {
    const usageIndexes = generatedFilteredDeferUsageIndexes(field);
    if (usageIndexes.length === 0) {
      return;
    }
    const key = usageIndexes.join(',');
    let group = groupsByKey.get(key);
    if (group === undefined) {
      group = { calls: [], usageIndexes };
      groupsByKey.set(key, group);
    }
    group.calls.push(fieldCalls[index]);
  });
  return Array.from(groupsByKey.values());
}

function generatedFilteredDeferUsageIndexes(
  field: FieldPlan,
): ReadonlyArray<number> {
  const usageIndexes: Array<number> = [];
  for (const usageIndex of field.deferUsageIndexes) {
    if (usageIndex === undefined) {
      return [];
    }
    if (!usageIndexes.includes(usageIndex)) {
      usageIndexes.push(usageIndex);
    }
  }
  return usageIndexes;
}

function generatedLocalDeferUsageSetupSource(
  localDeferUsages: ReadonlyArray<DeferUsagePlan>,
): string {
  return localDeferUsages
    .map(
      (deferUsage) => `  const deferUsage${String(deferUsage.index)} = {
    label: ${toJavaScript(deferUsage.label)},
    parentDeferUsage: undefined,
  };
`,
    )
    .join('');
}

function generatedDeferUsageReferenceSource(
  usageIndex: number,
  localDeferUsageIndexes: ReadonlySet<number>,
): string {
  invariant(localDeferUsageIndexes.has(usageIndex));
  return `deferUsage${String(usageIndex)}`;
}

function generatedDeferGroupSource(
  selectionSetName: string,
  group: GeneratedDeferFieldGroup,
  groupIndex: number,
): string {
  return `  function ${selectionSetName}DeferGroup${groupIndex}(
    executor,
    runner,
    source,
    target,
    parentNullTarget,
    deliveryGroupMap,
  ) {
${indentGeneratedSource(generatedParallelSelectionSetBody('', group.calls), '    ')}
  }
`;
}

function generatedSerialSelectionSetBody(
  conditionSetup: string,
  fieldCalls: ReadonlyArray<string>,
): string {
  const cases = fieldCalls.map(
    (call, index) => `      case ${String(index)}:
        runner.runWhenDrained(runNext);
${indentGeneratedSource(call, '        ')}
        return;`,
  );
  return `${conditionSetup}  let index = 0;
  const runNext = () => {
    switch (index++) {
${cases.join('\n')}
    }
  };
  runNext();`;
}

function withInclusionCondition(
  source: string,
  condition: string | undefined,
): string {
  if (condition === undefined) {
    return source;
  }

  return `  if (${condition}) {
${indentGeneratedSource(source, '  ')}
  }`;
}

function getGeneratedConditionNames(
  fields: ReadonlyArray<FieldPlan>,
): ReadonlyMap<string, string> {
  const conditionNames = new Map<string, string>();
  for (const field of fields) {
    const condition = field.inclusionCondition;
    if (condition !== undefined && !conditionNames.has(condition)) {
      conditionNames.set(condition, `condition${conditionNames.size}`);
    }
  }
  return conditionNames;
}

function getGeneratedConditionExpression(
  condition: string | undefined,
  conditionNames: ReadonlyMap<string, string>,
): string | undefined {
  return condition === undefined ? undefined : conditionNames.get(condition);
}

function generatedConditionSetup(
  conditionNames: ReadonlyMap<string, string>,
): string {
  if (conditionNames.size === 0) {
    return '';
  }

  const conditions = Array.from(
    conditionNames,
    ([condition, name]) => `  const ${name} = ${condition};`,
  );
  return `  const coerced = executor.validatedExecutionArgs.variableValues.coerced;
${conditions.join('\n')}
`;
}

function generatedSourceObjectSetup(fields: ReadonlyArray<FieldPlan>): string {
  return fields.some(canUseSelectionSetSourceObject)
    ? `  const sourceObject =
    (typeof source === 'object' && source !== null) ||
    typeof source === 'function'
      ? source
      : undefined;
`
    : '';
}

function canUseSelectionSetSourceObject(field: FieldPlan): boolean {
  return field.resolveMode === 'default' && !isGeneratedTypenameField(field);
}

function indentGeneratedSource(source: string, indentation: string): string {
  return source
    .split('\n')
    .map((line) => (line.length === 0 ? line : `${indentation}${line}`))
    .join('\n');
}

interface SimplePromiseSourceContext {
  promiseExpression: string;
  resolvedName?: string;
  onResolveSource: string;
  onRejectSource: string;
}

function generatedSimplePromiseSource({
  promiseExpression,
  resolvedName = 'resolved',
  onResolveSource,
  onRejectSource,
}: SimplePromiseSourceContext): string {
  return `runner._pending++;
try {
  ${promiseExpression}.then(
    (${resolvedName}) => {
      if (runner._settled) {
        runner._pending--;
        return;
      }
      try {
${indentGeneratedSource(onResolveSource, '        ')}
        runner._pending--;
        runner._drainIfReady();
      } catch (error) {
        runner._pending--;
        runner._fail(error);
      }
    },
    (rawError) => {
      if (runner._settled) {
        runner._pending--;
        return;
      }
      try {
${indentGeneratedSource(onRejectSource, '        ')}
        runner._pending--;
        runner._drainIfReady();
      } catch (error) {
        runner._pending--;
        runner._fail(error);
      }
    },
  );
} catch (rawError) {
  runner._pending--;
${indentGeneratedSource(onRejectSource, '  ')}
}`;
}

interface ResolveInfoSourceContext {
  fieldName: string;
  fieldNodes: string;
  helpersName?: 'executor' | 'sharedExecutionContext';
  parentType: string;
  path: string;
  returnType: string;
}

function generatedResolveInfoObjectSource({
  fieldName,
  fieldNodes,
  helpersName = 'executor',
  parentType,
  path,
  returnType,
}: ResolveInfoSourceContext): string {
  const getAbortSignal =
    helpersName === 'executor'
      ? 'executor.getAbortSignal'
      : 'sharedExecutionContext.getAbortSignal';
  const getAsyncHelpers =
    helpersName === 'executor'
      ? 'executor.getAsyncHelpers'
      : 'sharedExecutionContext.getAsyncHelpers';
  return `{
  fieldName: ${fieldName},
  fieldNodes: ${fieldNodes},
  returnType: ${returnType},
  parentType: ${parentType},
  path: ${path},
  schema,
  fragments: staticFragmentDefinitions,
  rootValue: validatedExecutionArgs.rootValue,
  operation: staticOperation,
  variableValues: validatedExecutionArgs.variableValues,
  getAbortSignal: ${getAbortSignal},
  getAsyncHelpers: ${getAsyncHelpers},
}`;
}

interface FieldFunctionSourceContext {
  childSelectionSetName: string | undefined;
  completeName: string;
  executeName: string;
  fieldIndex: number;
  fieldPath: ReadonlyArray<number>;
  fieldPlan: NonLeafFieldPlan;
  sourceObjectName?: string | undefined;
}

interface FieldAliasOptions {
  abstractType?: boolean;
  fieldDetailsList?: boolean;
  fieldNodes?: boolean;
  fieldPath?: boolean;
  itemType?: boolean;
  objectType?: boolean;
  returnType?: boolean;
}

function generatedFieldAliasSource(
  fieldIndex: number,
  _fieldPlan: FieldPlan,
  options: FieldAliasOptions,
): string {
  const aliases: Array<string> = [];
  if (options.fieldNodes === true) {
    aliases.push(`const fieldNodes = fieldNodes${fieldIndex};`);
  }
  if (options.fieldDetailsList === true) {
    aliases.push(`const fieldDetailsList = fieldDetailsList${fieldIndex};`);
  }
  if (options.returnType === true) {
    aliases.push(`const returnType = returnType${fieldIndex};`);
  }
  if (options.fieldPath === true) {
    aliases.push(`const fieldPath = path${fieldIndex};`);
  }
  if (options.itemType === true) {
    aliases.push(`const itemType = itemType${fieldIndex};`);
  }
  if (options.objectType === true) {
    aliases.push(`const objectType = objectType${fieldIndex};`);
  }
  if (options.abstractType === true) {
    aliases.push(`const abstractType = abstractType${fieldIndex};`);
  }
  return aliases.map((alias) => `  ${alias}`).join('\n');
}

function completionAliasOptions(
  fieldPlan: NonLeafFieldPlan,
): FieldAliasOptions {
  switch (fieldPlan.outputKind) {
    case 'object':
      return {
        fieldDetailsList: true,
        fieldNodes: true,
        fieldPath: true,
        objectType: true,
        returnType: true,
      };
    case 'abstract':
      return {
        abstractType: true,
        fieldDetailsList: true,
        fieldNodes: true,
        fieldPath: true,
        returnType: true,
      };
    case 'leafList':
    case 'objectList':
    case 'abstractList':
      return {
        fieldDetailsList: true,
        fieldNodes: fieldPlan.streamPlan !== undefined,
        fieldPath: true,
        itemType: fieldPlan.streamPlan !== undefined,
        returnType: true,
      };
  }
}

function completionAliasOptionsWithoutFieldPath(
  fieldPlan: NonLeafFieldPlan,
): FieldAliasOptions {
  return {
    ...completionAliasOptions(fieldPlan),
    fieldPath: false,
  };
}

function generatedFieldFunctionSource({
  childSelectionSetName,
  completeName,
  executeName,
  fieldIndex,
  fieldPath,
  fieldPlan,
  sourceObjectName,
}: FieldFunctionSourceContext): string {
  const responseNameExpression = toJavaScript(fieldPlan.responseName);
  const fieldNameExpression = toJavaScript(fieldPlan.fieldName);
  const fieldDetailsList = `fieldDetailsList${fieldIndex}`;
  const staticFieldPathName = `path${fieldIndex}`;
  const fieldPathName = 'fieldPath';
  const returnType = `returnType${fieldIndex}`;
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  if (canUseNullableObjectFieldWithoutSuccessTarget(fieldPlan)) {
    return generatedNullableObjectFieldFunctionSource({
      childSelectionSetName,
      completeName,
      executeName,
      fieldIndex,
      fieldNameExpression,
      fieldPath,
      fieldPathName,
      fieldPlan,
      responseNameExpression,
      returnType,
      sourceObjectName,
      staticFieldPathName,
    });
  }
  if (canUseNullableObjectListFieldWithoutSuccessTarget(fieldPlan)) {
    return generatedNullableObjectListFieldFunctionSource({
      childSelectionSetName,
      completeName,
      executeName,
      fieldIndex,
      fieldNameExpression,
      fieldPath,
      fieldPathName,
      fieldPlan,
      responseNameExpression,
      returnType,
      sourceObjectName,
      staticFieldPathName,
    });
  }

  return `function ${executeName}(
  executor,
  runner,
  source,
  sourceObject,
  target,
  parentNullTarget,
  deliveryGroupMap,
  fieldPath = ${staticFieldPathName},
) {
  const fieldTarget = {
    container: target,
    key: ${responseNameExpression},
    path: ${fieldPathName},
  };
  const nullTarget = ${
    fieldPlan.completedNonNull ? 'parentNullTarget' : 'fieldTarget'
  };
  let result;
  try {
${generatedSpecializedResolveFieldSource({
  fieldIndex,
  fieldNameExpression,
  fieldPath,
  fieldPathName,
  fieldPlan,
  returnType,
  sourceObjectName,
})}
  } catch (rawError) {
    executor.handleCompletionError(
      rawError,
      ${returnType},
      ${fieldDetailsList},
      ${fieldPathName},
      fieldTarget,
      nullTarget,
    );
    return;
  }

  if (result != null && typeof result.then === 'function') {
    ${targetField} = undefined;
    runner._pending++;
    try {
      result.then(
        (resolved) => {
          if (runner._settled) {
            runner._pending--;
            return;
          }
          try {
        ${completeName}(
          executor,
          runner,
          resolved,
          target,
          fieldTarget,
          nullTarget,
          deliveryGroupMap,
          fieldPath,
        );
            runner._pending--;
            runner._drainIfReady();
          } catch (error) {
            runner._pending--;
            runner._fail(error);
          }
        },
        (rawError) => {
          if (runner._settled) {
            runner._pending--;
            return;
          }
          try {
          executor.handleCompletionError(
            rawError,
            ${returnType},
            ${fieldDetailsList},
            ${fieldPathName},
            fieldTarget,
            nullTarget,
          );
            runner._pending--;
            runner._drainIfReady();
          } catch (error) {
            runner._pending--;
            runner._fail(error);
          }
        },
      );
    } catch (rawError) {
      runner._pending--;
      executor.handleCompletionError(
        rawError,
        ${returnType},
        ${fieldDetailsList},
        ${fieldPathName},
        fieldTarget,
        nullTarget,
      );
    }
    return;
  }

  ${completeName}(
    executor,
    runner,
    result,
    target,
    fieldTarget,
    nullTarget,
    deliveryGroupMap,
    fieldPath,
  );
}

function ${completeName}(
  executor,
  runner,
  result,
  target,
  fieldTarget,
  nullTarget,
  deliveryGroupMap,
  fieldPath,
) {
${generatedFieldAliasSource(
  fieldIndex,
  fieldPlan,
  completionAliasOptionsWithoutFieldPath(fieldPlan),
)}
${generatedCompletionSource(
  completeName,
  childSelectionSetName,
  fieldNameExpression,
  fieldPlan,
)}
}

${generatedCompletionHelperFunctions(
  completeName,
  childSelectionSetName,
  fieldPlan,
  fieldIndex,
)}`;
}

function canUseNullableObjectFieldWithoutSuccessTarget(
  fieldPlan: FieldPlan,
): boolean {
  return (
    fieldPlan.outputKind === 'object' &&
    !fieldPlan.completedNonNull &&
    fieldPlan.childrenCanNullParent !== true &&
    fieldPlan.objectTypeHasIsTypeOf !== true
  );
}

function canUseNullableObjectListFieldWithoutSuccessTarget(
  fieldPlan: FieldPlan,
): boolean {
  return (
    fieldPlan.outputKind === 'objectList' &&
    !fieldPlan.completedNonNull &&
    !fieldPlan.completedItemNonNull
  );
}

interface NullableObjectFieldFunctionSourceContext extends SpecializedResolveFieldSourceContext {
  childSelectionSetName: string | undefined;
  completeName: string;
  executeName: string;
  responseNameExpression: string;
  staticFieldPathName: string;
}

function generatedNullableObjectFieldFunctionSource({
  childSelectionSetName,
  completeName,
  executeName,
  fieldIndex,
  fieldNameExpression,
  fieldPath,
  fieldPathName,
  fieldPlan,
  responseNameExpression,
  returnType,
  sourceObjectName,
  staticFieldPathName,
}: NullableObjectFieldFunctionSourceContext): string {
  const executeChildFields = getGeneratedChildSelectionSetName(
    childSelectionSetName,
  );
  const fieldDetailsList = `fieldDetailsList${fieldIndex}`;
  const resultObjectSource = generatedResultObjectSource();
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  const createFieldTarget = `const fieldTarget = {
      container: target,
      key: ${responseNameExpression},
      path: ${fieldPathName},
    };`;
  return `function ${executeName}(
  executor,
  runner,
  source,
  sourceObject,
  target,
  parentNullTarget,
  deliveryGroupMap,
  fieldPath = ${staticFieldPathName},
) {
  let result;
  try {
${generatedSpecializedResolveFieldSource({
  fieldIndex,
  fieldNameExpression,
  fieldPath,
  fieldPathName,
  fieldPlan,
  returnType,
  sourceObjectName,
})}
  } catch (rawError) {
    ${createFieldTarget}
    executor.handleCompletionError(
      rawError,
      ${returnType},
      ${fieldDetailsList},
      ${fieldPathName},
      fieldTarget,
      fieldTarget,
    );
    return;
  }

  if (result != null && typeof result.then === 'function') {
    ${targetField} = undefined;
    runner._pending++;
    try {
      result.then(
        (resolved) => {
          if (runner._settled) {
            runner._pending--;
            return;
          }
          try {
        ${completeName}(
          executor,
          runner,
          resolved,
          target,
          parentNullTarget,
          deliveryGroupMap,
          fieldPath,
        );
            runner._pending--;
            runner._drainIfReady();
          } catch (error) {
            runner._pending--;
            runner._fail(error);
          }
        },
        (rawError) => {
          if (runner._settled) {
            runner._pending--;
            return;
          }
          try {
            ${createFieldTarget}
            executor.handleCompletionError(
              rawError,
              ${returnType},
              ${fieldDetailsList},
              ${fieldPathName},
              fieldTarget,
              fieldTarget,
            );
            runner._pending--;
            runner._drainIfReady();
          } catch (error) {
            runner._pending--;
            runner._fail(error);
          }
        },
      );
    } catch (rawError) {
      runner._pending--;
      ${createFieldTarget}
      executor.handleCompletionError(
        rawError,
        ${returnType},
        ${fieldDetailsList},
        ${fieldPathName},
        fieldTarget,
        fieldTarget,
      );
    }
    return;
  }

  if (result instanceof Error) {
    ${createFieldTarget}
    executor.handleCompletionError(
      result,
      ${returnType},
      ${fieldDetailsList},
      ${fieldPathName},
      fieldTarget,
      fieldTarget,
    );
    return;
  }

  if (result == null) {
    ${targetField} = null;
    return;
  }

  const data = ${resultObjectSource};
  ${targetField} = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    parentNullTarget,
    deliveryGroupMap,
    ${fieldPathName},
  );
}

function ${completeName}(
  executor,
  runner,
  result,
  target,
  parentNullTarget,
  deliveryGroupMap,
  fieldPath,
) {
  if (result instanceof Error) {
    ${createFieldTarget}
    executor.handleCompletionError(
      result,
      ${returnType},
      ${fieldDetailsList},
      ${fieldPathName},
      fieldTarget,
      fieldTarget,
    );
    return;
  }

  if (result == null) {
    ${targetField} = null;
    return;
  }

  const data = ${resultObjectSource};
  ${targetField} = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    parentNullTarget,
    deliveryGroupMap,
    ${fieldPathName},
  );
}`;
}

function generatedNullableObjectListFieldFunctionSource({
  childSelectionSetName,
  completeName,
  executeName,
  fieldIndex,
  fieldNameExpression,
  fieldPath,
  fieldPathName,
  fieldPlan,
  responseNameExpression,
  returnType,
  sourceObjectName,
  staticFieldPathName,
}: NullableObjectFieldFunctionSourceContext): string {
  const fieldDetailsList = `fieldDetailsList${fieldIndex}`;
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  const createFieldTarget = `const fieldTarget = {
      container: target,
      key: ${responseNameExpression},
      path: ${fieldPathName},
    };`;
  return `function ${executeName}(
  executor,
  runner,
  source,
  sourceObject,
  target,
  parentNullTarget,
  deliveryGroupMap,
  fieldPath = ${staticFieldPathName},
) {
  let result;
  try {
${generatedSpecializedResolveFieldSource({
  fieldIndex,
  fieldNameExpression,
  fieldPath,
  fieldPathName,
  fieldPlan,
  returnType,
  sourceObjectName,
})}
  } catch (rawError) {
    ${createFieldTarget}
    executor.handleCompletionError(
      rawError,
      ${returnType},
      ${fieldDetailsList},
      ${fieldPathName},
      fieldTarget,
      fieldTarget,
    );
    return;
  }

  if (result != null && typeof result.then === 'function') {
    ${targetField} = undefined;
    runner._pending++;
    try {
      result.then(
        (resolved) => {
          if (runner._settled) {
            runner._pending--;
            return;
          }
          try {
        ${completeName}(
          executor,
          runner,
          resolved,
          target,
          parentNullTarget,
          deliveryGroupMap,
          fieldPath,
        );
            runner._pending--;
            runner._drainIfReady();
          } catch (error) {
            runner._pending--;
            runner._fail(error);
          }
        },
        (rawError) => {
          if (runner._settled) {
            runner._pending--;
            return;
          }
          try {
            ${createFieldTarget}
            executor.handleCompletionError(
              rawError,
              ${returnType},
              ${fieldDetailsList},
              ${fieldPathName},
              fieldTarget,
              fieldTarget,
            );
            runner._pending--;
            runner._drainIfReady();
          } catch (error) {
            runner._pending--;
            runner._fail(error);
          }
        },
      );
    } catch (rawError) {
      runner._pending--;
      ${createFieldTarget}
      executor.handleCompletionError(
        rawError,
        ${returnType},
        ${fieldDetailsList},
        ${fieldPathName},
        fieldTarget,
        fieldTarget,
      );
    }
    return;
  }

  ${completeName}(
    executor,
    runner,
    result,
    target,
    parentNullTarget,
    deliveryGroupMap,
    fieldPath,
  );
}

function ${completeName}(
  executor,
  runner,
  result,
  target,
  parentNullTarget,
  deliveryGroupMap,
) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, completionAliasOptions(fieldPlan as NonLeafFieldPlan))}
${generatedNullableObjectListCompletionSource(completeName, fieldPlan)}
}

${generatedCompletionHelperFunctions(
  completeName,
  childSelectionSetName,
  fieldPlan,
  fieldIndex,
)}`;
}

function generatedNullFieldCompletionSource(fieldPlan: FieldPlan): string {
  if (!fieldPlan.completedNonNull || !fieldPlan.errorPropagation) {
    return `${generatedObjectAssignmentSource(
      'target',
      fieldPlan.responseName,
    )} = null;`;
  }
  return `executor.handleCompletionError(
    new Error(
      \`Cannot return null for non-nullable field ${fieldPlan.parentTypeName}.${fieldPlan.fieldName}.\`,
    ),
    returnType,
    fieldDetailsList,
    fieldPath,
    fieldTarget,
    nullTarget,
  );`;
}

function generatedListItemNullTargetSource(
  fieldPlan: FieldPlan,
  itemTargetName: string,
  parentNullTargetName: string,
): string {
  return fieldPlan.completedItemNonNull ? parentNullTargetName : itemTargetName;
}

interface NullListItemCompletionSourceContext {
  completedResultsName: string;
  fieldPlan: FieldPlan;
  fieldDetailsListName: string;
  indexName: string;
  itemNullTargetName: string;
  itemPathName: string;
  itemTargetName: string;
  itemTypeName: string;
}

function generatedNullListItemCompletionSource({
  completedResultsName,
  fieldPlan,
  fieldDetailsListName,
  indexName,
  itemNullTargetName,
  itemPathName,
  itemTargetName,
  itemTypeName,
}: NullListItemCompletionSourceContext): string {
  if (!fieldPlan.completedItemNonNull || !fieldPlan.errorPropagation) {
    return `${completedResultsName}[${indexName}] = null;`;
  }
  return `executor.handleCompletionError(
    new Error(
      \`Cannot return null for non-nullable field ${fieldPlan.parentTypeName}.${fieldPlan.fieldName}.\`,
    ),
    ${itemTypeName},
    ${fieldDetailsListName},
    ${itemPathName},
    ${itemTargetName},
    ${itemNullTargetName},
  );`;
}

function generatedStreamUsageSetupSource(
  fieldPlan: FieldPlan,
  createFieldTargetSource: string,
  nullTargetName = 'nullTarget',
): string {
  const streamPlan = fieldPlan.streamPlan;
  invariant(streamPlan !== undefined);
  const conditionSetup =
    streamPlan.condition === undefined
      ? ''
      : `  const coerced = validatedExecutionArgs.variableValues.coerced;\n`;
  const streamUsageAssignment = `streamUsage = {
      initialCount: ${String(streamPlan.initialCount)},
      label: ${toJavaScript(streamPlan.label)},
      fieldDetailsList,
    };`;
  const streamUsageSource =
    streamPlan.condition === undefined
      ? `    if (executor.mode !== 'ignore') {
      ${streamUsageAssignment}
    }`
      : `    if (executor.mode !== 'ignore' && ${streamPlan.condition}) {
      ${streamUsageAssignment}
    }`;

  return `  const validatedExecutionArgs = executor.validatedExecutionArgs;
${conditionSetup}  let streamUsage;
  try {
${streamUsageSource}
    if (streamUsage !== undefined && streamUsage.initialCount < 0) {
      throw new Error('initialCount must be a positive integer');
    }
  } catch (rawError) {
    ${createFieldTargetSource}
    executor.handleCompletionError(
      rawError,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      ${nullTargetName},
    );
    return;
  }
  const streamInfo =
    streamUsage === undefined
      ? undefined
      : ${generatedResolveInfoObjectSource({
        fieldName: toJavaScript(fieldPlan.fieldName),
        fieldNodes: 'fieldNodes',
        parentType: 'parentType',
        path: 'fieldPath',
        returnType: 'returnType',
      })};
	`;
}

function generatedStreamItemCompleterArgument(
  completeName: string,
  indentation: string,
): string {
  return `,
${indentation}${completeName}StreamItem`;
}

function generatedTypenameFieldSource(fieldPlan: FieldPlan): string {
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  return `  ${targetField} = ${toJavaScript(fieldPlan.parentTypeName)};`;
}

function isGeneratedSharedDefaultLeafField(fieldPlan: FieldPlan): boolean {
  return (
    fieldPlan.outputKind === 'leaf' &&
    fieldPlan.resolveMode === 'default' &&
    fieldPlan.builtinScalarName === 'Int' &&
    !isGeneratedTypenameField(fieldPlan) &&
    !hasGeneratedArgumentValues(fieldPlan.argumentPlan)
  );
}

interface SharedDefaultLeafFieldCallSourceContext {
  executeName: string;
  fieldIndex: number;
  fieldPlan: FieldPlan;
  sourceObjectName: string;
}

function generatedSharedDefaultLeafFieldCallSource({
  executeName,
  fieldIndex,
  fieldPlan,
  sourceObjectName,
}: SharedDefaultLeafFieldCallSourceContext): string {
  return `  ${executeName}(
    executor,
    runner,
    ${sourceObjectName},
    target,
    parentNullTarget,
    path${String(fieldIndex)},
    ${toJavaScript(fieldPlan.responseName)},
    ${toJavaScript(fieldPlan.fieldName)},
    fieldNodes${String(fieldIndex)},
    fieldDetailsList${String(fieldIndex)},
    returnType${String(fieldIndex)},
    leafType${String(fieldIndex)},
    coerceOutputValue${String(fieldIndex)},
    ${String(fieldPlan.completedNonNull)},
  );`;
}

function generatedSharedDefaultLeafFieldFunctionSource(
  executeName: string,
): string {
  return `function ${executeName}(
  executor,
  runner,
  sourceObject,
  target,
  parentNullTarget,
  fieldPath,
  responseName,
  fieldName,
  fieldNodes,
  fieldDetailsList,
  returnType,
  leafType,
  coerceOutputValue,
  completedNonNull,
) {
  let result;
  try {
    if (sourceObject === undefined) {
      result = undefined;
    } else {
      const property = sourceObject[fieldName];
      if (typeof property !== 'function') {
        result = property;
      } else {
        const validatedExecutionArgs = executor.validatedExecutionArgs;
        const info = ${generatedResolveInfoObjectSource({
          fieldName: 'fieldName',
          fieldNodes: 'fieldNodes',
          parentType: 'parentType',
          path: 'fieldPath',
          returnType: 'returnType',
        })};
        result = property.call(
          sourceObject,
          emptyGeneratedArgumentValues,
          validatedExecutionArgs.contextValue,
          info,
        );
      }
    }
  } catch (rawError) {
    executor.handleLeafFieldError(
      rawError,
      returnType,
      fieldDetailsList,
      fieldPath,
      target,
      responseName,
      parentNullTarget,
    );
    return;
  }

  if (result != null && typeof result.then === 'function') {
    target[responseName] = undefined;
    runner.awaitValue(
      result,
      (resolved) => {
        ${executeName}Complete(
          executor,
          resolved,
          target,
          parentNullTarget,
          fieldPath,
          responseName,
          fieldName,
          fieldDetailsList,
          returnType,
          leafType,
          coerceOutputValue,
          completedNonNull,
        );
      },
      (rawError) => {
        executor.handleLeafFieldError(
          rawError,
          returnType,
          fieldDetailsList,
          fieldPath,
          target,
          responseName,
          parentNullTarget,
        );
      },
      fieldPath,
    );
    return;
  }

  ${executeName}Complete(
    executor,
    result,
    target,
    parentNullTarget,
    fieldPath,
    responseName,
    fieldName,
    fieldDetailsList,
    returnType,
    leafType,
    coerceOutputValue,
    completedNonNull,
  );
}

function ${executeName}Complete(
  executor,
  result,
  target,
  parentNullTarget,
  fieldPath,
  responseName,
  fieldName,
  fieldDetailsList,
  returnType,
  leafType,
  coerceOutputValue,
  completedNonNull,
) {
  if (result == null) {
    if (completedNonNull && executor.validatedExecutionArgs.errorPropagation) {
      executor.handleLeafFieldError(
        new Error(
          \`Cannot return null for non-nullable field \${parentType.name}.\${fieldName}.\`,
        ),
        returnType,
        fieldDetailsList,
        fieldPath,
        target,
        responseName,
        parentNullTarget,
      );
    } else {
      target[responseName] = null;
    }
    return;
  }

  if (result instanceof Error) {
    executor.handleLeafFieldError(
      result,
      returnType,
      fieldDetailsList,
      fieldPath,
      target,
      responseName,
      parentNullTarget,
    );
    return;
  }

  try {
    const coerced = coerceOutputValue(result);
    if (coerced == null) {
      throw new Error(
        \`Expected \\\`\${inspect(leafType)}.coerceOutputValue(\${inspect(
          result,
        )})\\\` to return non-nullable value, returned: \${inspect(coerced)}\`,
      );
    }
    target[responseName] = coerced;
  } catch (rawError) {
    executor.handleLeafFieldError(
      rawError,
      returnType,
      fieldDetailsList,
      fieldPath,
      target,
      responseName,
      parentNullTarget,
    );
  }
}`;
}

interface LeafFieldFunctionSourceContext {
  completeName: string;
  executeName: string;
  fieldIndex: number;
  fieldPath: ReadonlyArray<number>;
  fieldPlan: FieldPlan;
  sourceObjectName?: string | undefined;
}

function generatedLeafFieldFunctionSource({
  completeName,
  executeName,
  fieldIndex,
  fieldPath,
  fieldPlan,
  sourceObjectName,
}: LeafFieldFunctionSourceContext): string {
  const fieldNameExpression = toJavaScript(fieldPlan.fieldName);
  const fieldDetailsList = `fieldDetailsList${fieldIndex}`;
  const returnType = `returnType${fieldIndex}`;
  const responseNameExpression = toJavaScript(fieldPlan.responseName);
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  return `function ${executeName}(
  executor,
  runner,
  source,
  sourceObject,
  target,
  parentNullTarget,
  fieldPath,
) {
  let result;
  try {
${generatedSpecializedResolveFieldSource({
  fieldIndex,
  fieldPlan,
  fieldNameExpression,
  fieldPath,
  fieldPathName: 'fieldPath',
  fieldPathSource: 'fieldPath',
  returnType,
  sourceObjectName,
})}
  } catch (rawError) {
    executor.handleLeafFieldError(
      rawError,
      ${returnType},
      ${fieldDetailsList},
      fieldPath,
      target,
      ${responseNameExpression},
      parentNullTarget,
    );
    return;
  }

  if (result != null && typeof result.then === 'function') {
    ${completeName}(
      executor,
      runner,
      result,
      target,
      parentNullTarget,
      fieldPath,
    );
    return;
  }

${generatedBuiltinScalarCompletionSource({
  assignmentSource: (coerced) => `${targetField} = ${coerced};`,
  exitStatement: 'return;',
  fieldPlan,
  valueName: 'result',
})}
  ${completeName}(
    executor,
    runner,
    result,
    target,
    parentNullTarget,
    fieldPath,
  );
}`;
}

function generatedLeafFieldCompletionFunctionSource(
  completeName: string,
  fieldPlan: FieldPlan,
  fieldIndex: number,
): string {
  const fieldDetailsList = `fieldDetailsList${fieldIndex}`;
  const returnType = `returnType${fieldIndex}`;
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  const responseNameExpression = toJavaScript(fieldPlan.responseName);
  return `function ${completeName}(
  executor,
  runner,
  result,
  target,
  parentNullTarget,
  fieldPath,
) {
  if (result != null && typeof result.then === 'function') {
    ${targetField} = undefined;
    runner.awaitValue(
      result,
      (resolved) => {
        const result = resolved;
${indentGeneratedSource(
  generatedInlineLeafCompletionSource({
    responseNameExpression,
    fieldPlan,
    fieldIndex,
    exitStatement: 'return;',
    fieldPath: 'fieldPath',
  }),
  '        ',
)}
      },
      (rawError) => {
        const fieldTarget = {
          container: target,
          key: ${responseNameExpression},
          path: fieldPath,
        };
        executor.handleCompletionError(
          rawError,
          ${returnType},
          ${fieldDetailsList},
          fieldPath,
          fieldTarget,
          ${fieldPlan.completedNonNull ? 'parentNullTarget' : 'fieldTarget'},
        );
      },
      fieldPath,
      );
    return;
  }

${indentGeneratedSource(
  generatedInlineLeafCompletionSource({
    responseNameExpression,
    fieldPlan,
    fieldIndex,
    includeBuiltinScalarShortcuts: false,
    fieldPath: 'fieldPath',
  }),
  '  ',
)}
}`;
}

interface SpecializedResolveFieldSourceContext {
  fieldIndex: number;
  fieldNameExpression: string;
  fieldPath: ReadonlyArray<number>;
  fieldPathName: string;
  fieldPathSource?: string;
  fieldPlan: FieldPlan;
  returnType: string;
  sourceObjectName?: string | undefined;
}

function generatedSpecializedResolveFieldSource({
  fieldIndex,
  fieldNameExpression,
  fieldPath,
  fieldPathName,
  fieldPathSource = fieldPathName,
  fieldPlan,
  returnType,
  sourceObjectName,
}: SpecializedResolveFieldSourceContext): string {
  const fieldNodes = `fieldNodes${fieldIndex}`;
  const resolveFn = `resolveFn${fieldIndex}`;
  const sourceField = generatedObjectAssignmentSource(
    sourceObjectName ?? 'object',
    fieldPlan.fieldName,
  );
  const argumentValues = generatedArgumentValuesSource(
    fieldPath,
    fieldPlan.argumentPlan,
    'validatedExecutionArgs.variableValues',
  );
  switch (fieldPlan.resolveMode) {
    case 'default':
      invariant(
        sourceObjectName !== undefined,
        'Expected default resolver fields to use a precomputed source object.',
      );
      return `    if (${sourceObjectName} === undefined) {
      result = undefined;
      } else {
        const property = ${sourceField};
        if (typeof property !== 'function') {
          result = property;
        } else {
          const validatedExecutionArgs = executor.validatedExecutionArgs;
${argumentValues.setup === '' ? '' : `${argumentValues.setup}\n`}
          const info = ${generatedResolveInfoObjectSource({
            fieldName: fieldNameExpression,
            fieldNodes,
            parentType: 'parentType',
            path: fieldPathSource,
            returnType,
          })};
        result = property.call(
          ${sourceObjectName},
          ${argumentValues.expression},
          validatedExecutionArgs.contextValue,
          info,
        );
      }
    }`;
    case 'field':
    case 'customDefault':
      return `    const validatedExecutionArgs = executor.validatedExecutionArgs;
${argumentValues.setup === '' ? '' : `${argumentValues.setup}\n`}
    const info = ${generatedResolveInfoObjectSource({
      fieldName: fieldNameExpression,
      fieldNodes,
      parentType: 'parentType',
      path: fieldPathSource,
      returnType,
    })};
    result = ${resolveFn}(
      source,
      ${argumentValues.expression},
      validatedExecutionArgs.contextValue,
      info,
    );`;
  }
}

interface InlineLeafCompletionSourceContext {
  responseNameExpression: string;
  fieldPlan: FieldPlan;
  fieldIndex: number;
  exitStatement?: string;
  fieldPath?: string;
  includeBuiltinScalarShortcuts?: boolean;
}

function generatedInlineLeafCompletionSource({
  responseNameExpression,
  fieldPlan,
  fieldIndex,
  exitStatement = 'return;',
  fieldPath = `path${fieldIndex}`,
  includeBuiltinScalarShortcuts = true,
}: InlineLeafCompletionSourceContext): string {
  const coerceOutputValue = `coerceOutputValue${fieldIndex}`;
  const fieldDetailsList = `fieldDetailsList${fieldIndex}`;
  const returnType = `returnType${fieldIndex}`;
  const leafType = `leafType${fieldIndex}`;
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  const nullCompletionSource =
    fieldPlan.completedNonNull && fieldPlan.errorPropagation
      ? `executor.handleLeafFieldError(
      new Error(
        \`Cannot return null for non-nullable field ${fieldPlan.parentTypeName}.${fieldPlan.fieldName}.\`,
      ),
      ${returnType},
      ${fieldDetailsList},
      ${fieldPath},
      target,
      ${responseNameExpression},
      parentNullTarget,
    );`
      : `${targetField} = null;`;
  const coercedNullCheckSource =
    fieldPlan.builtinScalarName === undefined
      ? `    if (coerced == null) {
      throw new Error(
        \`Expected \\\`\${inspect(${leafType})}.coerceOutputValue(\${inspect(
          result,
        )})\\\` to return non-nullable value, returned: \${inspect(coerced)}\`,
      );
    }
`
      : '';
  return `${
    includeBuiltinScalarShortcuts
      ? generatedBuiltinScalarCompletionSource({
          assignmentSource: (coerced) => `${targetField} = ${coerced};`,
          exitStatement,
          fieldPlan,
          valueName: 'result',
        })
      : ''
  }  if (result == null) {
${indentGeneratedSource(nullCompletionSource, '    ')}
    ${exitStatement}
  }

  if (result instanceof Error) {
    executor.handleLeafFieldError(
      result,
      ${returnType},
      ${fieldDetailsList},
      ${fieldPath},
      target,
      ${responseNameExpression},
      parentNullTarget,
    );
    ${exitStatement}
  }

  try {
    const coerced = ${coerceOutputValue}(result);
${coercedNullCheckSource}    ${targetField} = coerced;
  } catch (rawError) {
    executor.handleLeafFieldError(
      rawError,
      ${returnType},
      ${fieldDetailsList},
      ${fieldPath},
      target,
      ${responseNameExpression},
      parentNullTarget,
    );
	}`;
}

function getGeneratedChildSelectionSetName(
  childSelectionSetName: string | undefined,
): string {
  invariant(
    childSelectionSetName !== undefined,
    'Expected a non-leaf field plan to include a child selection set.',
  );
  return childSelectionSetName;
}

function generatedCompletionSource(
  completeName: string,
  childSelectionSetName: string | undefined,
  fieldNameExpression: string,
  fieldPlan: NonLeafFieldPlan,
): string {
  if (fieldPlan.outputKind === 'object') {
    const executeChildFields = getGeneratedChildSelectionSetName(
      childSelectionSetName,
    );
    const resultObjectSource = generatedResultObjectSource();
    const targetField = generatedObjectAssignmentSource(
      'target',
      fieldPlan.responseName,
    );
    const nullCompletionSource = generatedNullFieldCompletionSource(fieldPlan);
    const isTypeOfSource =
      fieldPlan.objectTypeHasIsTypeOf === true
        ? `  const validatedExecutionArgs = executor.validatedExecutionArgs;
  const info = ${generatedResolveInfoObjectSource({
    fieldName: fieldNameExpression,
    fieldNodes: 'fieldNodes',
    parentType: 'parentType',
    path: 'fieldPath',
    returnType: 'returnType',
  })};
  let isTypeOf;
  try {
    isTypeOf = objectType.isTypeOf(
      result,
      validatedExecutionArgs.contextValue,
      info,
    );
  } catch (rawError) {
    executor.handleCompletionError(
      rawError,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

	  if (isTypeOf != null && typeof isTypeOf.then === 'function') {
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'isTypeOf',
    resolvedName: 'resolvedIsTypeOf',
    onResolveSource: `if (resolvedIsTypeOf !== true) {
  executor.handleCompletionError(
    executor.invalidReturnTypeError(
      objectType,
      result,
      fieldDetailsList,
    ),
    returnType,
    fieldDetailsList,
    fieldPath,
    fieldTarget,
    nullTarget,
  );
} else {
  const data = ${resultObjectSource};
  ${targetField} = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    nullTarget,
    deliveryGroupMap,
    fieldPath,
  );
}`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  returnType,
  fieldDetailsList,
  fieldPath,
  fieldTarget,
  nullTarget,
);`,
  }),
  '    ',
)}
	    return;
	  }

  if (isTypeOf !== true) {
    executor.handleCompletionError(
      executor.invalidReturnTypeError(
        objectType,
        result,
        fieldDetailsList,
      ),
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

`
        : '';
    return `  if (result instanceof Error) {
    executor.handleCompletionError(
      result,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  if (result == null) {
${indentGeneratedSource(nullCompletionSource, '    ')}
    return;
  }

${isTypeOfSource}
  const data = ${resultObjectSource};
  ${targetField} = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    nullTarget,
    deliveryGroupMap,
    fieldPath,
  );`;
  }

  if (fieldPlan.outputKind === 'abstract') {
    return generatedAbstractCompletionSource(completeName, fieldPlan);
  }

  if (fieldPlan.outputKind === 'objectList') {
    return generatedObjectListCompletionSource(completeName, fieldPlan);
  }

  if (fieldPlan.outputKind === 'abstractList') {
    return generatedAbstractListCompletionSource(completeName, fieldPlan);
  }

  return generatedLeafListCompletionSource(completeName, fieldPlan);
}

function generatedCompletionHelperFunctions(
  completeName: string,
  childSelectionSetName: string | undefined,
  fieldPlan: FieldPlan,
  fieldIndex: number,
): string {
  if (fieldPlan.outputKind === 'abstract') {
    return generatedAbstractCompletionHelperFunctions(
      completeName,
      childSelectionSetName,
      fieldIndex,
      fieldPlan,
    );
  }
  if (fieldPlan.outputKind === 'leafList') {
    return `${generatedLeafListCompletionHelperFunctions(
      completeName,
      fieldPlan,
      fieldIndex,
    )}${generatedStreamItemCompletionHelperFunction(
      completeName,
      fieldPlan,
      fieldIndex,
    )}`;
  }
  if (fieldPlan.outputKind === 'objectList') {
    return `${generatedObjectListCompletionHelperFunctions(
      completeName,
      childSelectionSetName,
      fieldPlan,
      fieldIndex,
    )}${generatedStreamItemCompletionHelperFunction(
      completeName,
      fieldPlan,
      fieldIndex,
    )}`;
  }
  if (fieldPlan.outputKind === 'abstractList') {
    return `${generatedAbstractListCompletionHelperFunctions(
      completeName,
      childSelectionSetName,
      fieldPlan,
      fieldIndex,
    )}${generatedStreamItemCompletionHelperFunction(
      completeName,
      fieldPlan,
      fieldIndex,
    )}`;
  }
  return '';
}

function generatedStreamItemCompletionHelperFunction(
  completeName: string,
  fieldPlan: FieldPlan,
  fieldIndex: number,
): string {
  if (fieldPlan.streamPlan === undefined) {
    return '';
  }

  const itemTypeName = `itemType${fieldIndex}`;
  const completedResult = `completedResults[0]`;
  const buildResultSource = `const completed = runner.runUntilNulled(itemPath);
  if (completed !== undefined) {
    return completed.then(() =>
      executor.buildStreamItemResult(${completedResult}, itemPath, ${itemTypeName}),
    );
  }
  return executor.buildStreamItemResult(${completedResult}, itemPath, ${itemTypeName});`;

  if (fieldPlan.outputKind === 'leafList') {
    return `

function ${completeName}StreamItem(executor, itemPath, item, _index) {
  const completedResults = [];
  const runner = new CompiledExecutionRunner(executor);
  const itemTarget = {
    container: completedResults,
    key: 0,
    path: itemPath,
  };
  if (item != null && typeof item.then === 'function') {
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'item',
    onResolveSource: `${completeName}LeafListItem(
  executor,
  resolved,
  completedResults,
  0,
  itemTarget,
  itemPath,
);`,
    onRejectSource: `${completeName}LeafListItemError(
  executor,
  rawError,
  completedResults,
  0,
  itemTarget,
  itemPath,
);`,
  }),
  '    ',
)}
  } else {
    ${completeName}LeafListItem(
      executor,
      item,
      completedResults,
      0,
      itemTarget,
      itemPath,
    );
  }
  ${buildResultSource}
}`;
  }

  const itemFunction =
    fieldPlan.outputKind === 'objectList'
      ? `${completeName}ObjectListItem`
      : `${completeName}AbstractListItem`;
  return `

function ${completeName}StreamItem(executor, itemPath, item, _index) {
  const completedResults = [];
  const runner = new CompiledExecutionRunner(executor);
  const itemTarget = {
    container: completedResults,
    key: 0,
    path: itemPath,
  };
  ${itemFunction}(
    executor,
    runner,
    item,
    completedResults,
    0,
    itemTarget,
    itemPath,
  );
  ${buildResultSource}
}`;
}

function generatedAbstractCompletionSource(
  completeName: string,
  fieldPlan: FieldPlan,
): string {
  const nullCompletionSource = generatedNullFieldCompletionSource(fieldPlan);
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  return `  if (result instanceof Error) {
    executor.handleCompletionError(
      result,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  if (result == null) {
${indentGeneratedSource(nullCompletionSource, '    ')}
    return;
  }

  const validatedExecutionArgs = executor.validatedExecutionArgs;
  const info = ${generatedResolveInfoObjectSource({
    fieldName: toJavaScript(fieldPlan.fieldName),
    fieldNodes: 'fieldNodes',
    parentType: 'parentType',
    path: 'fieldPath',
    returnType: 'returnType',
  })};
  const resolveTypeFn =
    abstractType.resolveType ??
    validatedExecutionArgs.typeResolver;
  let runtimeTypeName;
  try {
    runtimeTypeName = resolveTypeFn(
      result,
      validatedExecutionArgs.contextValue,
      info,
      abstractType,
    );
  } catch (rawError) {
    executor.handleCompletionError(
      rawError,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  if (runtimeTypeName != null && typeof runtimeTypeName.then === 'function') {
    ${targetField} = undefined;
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'runtimeTypeName',
    resolvedName: 'resolvedRuntimeTypeName',
    onResolveSource: `${completeName}RuntimeType(
  executor,
  runner,
  result,
	  fieldTarget,
	  nullTarget,
	  deliveryGroupMap,
	  resolvedRuntimeTypeName,
	  info,
	);`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  returnType,
  fieldDetailsList,
  fieldPath,
  fieldTarget,
  nullTarget,
);`,
  }),
  '    ',
)}
    return;
  }

  ${completeName}RuntimeType(
    executor,
    runner,
    result,
	    fieldTarget,
	    nullTarget,
	    deliveryGroupMap,
	    runtimeTypeName,
	    info,
	  );`;
}

function generatedAbstractCompletionHelperFunctions(
  completeName: string,
  childSelectionSetName: string | undefined,
  fieldIndex: number,
  fieldPlan: FieldPlan,
): string {
  const executeChildFields = getGeneratedChildSelectionSetName(
    childSelectionSetName,
  );
  const resultObjectSource = generatedAbstractResultObjectSource();
  return `function ${completeName}RuntimeType(
  executor,
  runner,
	  result,
	  fieldTarget,
	  nullTarget,
	  deliveryGroupMap,
	  runtimeTypeName,
	  info,
	) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, {
  abstractType: true,
  fieldDetailsList: true,
  fieldPath: true,
  returnType: true,
})}
  let runtimeType;
  try {
    runtimeType = executor.ensureValidRuntimeType(
      runtimeTypeName,
      abstractType,
      fieldDetailsList,
      info,
      result,
    );
  } catch (rawError) {
    executor.handleCompletionError(
      rawError,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  ${completeName}RuntimeObject(
    executor,
    runner,
	    result,
	    fieldTarget,
	    nullTarget,
	    deliveryGroupMap,
	    runtimeType,
	    info,
	  );
}

function ${completeName}RuntimeObject(
  executor,
  runner,
	  result,
	  fieldTarget,
	  nullTarget,
	  deliveryGroupMap,
	  runtimeType,
	  info,
	) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, {
  fieldDetailsList: true,
  fieldPath: true,
  returnType: true,
})}
  if (runtimeType.isTypeOf !== undefined) {
    let isTypeOf;
    try {
      isTypeOf = runtimeType.isTypeOf(
        result,
        executor.validatedExecutionArgs.contextValue,
        info,
      );
    } catch (rawError) {
      executor.handleCompletionError(
        rawError,
        returnType,
        fieldDetailsList,
        fieldPath,
        fieldTarget,
        nullTarget,
      );
      return;
    }

	    if (isTypeOf != null && typeof isTypeOf.then === 'function') {
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'isTypeOf',
    resolvedName: 'resolvedIsTypeOf',
    onResolveSource: `if (resolvedIsTypeOf !== true) {
  executor.handleCompletionError(
    executor.invalidReturnTypeError(
      runtimeType,
      result,
      fieldDetailsList,
    ),
    returnType,
    fieldDetailsList,
    fieldPath,
    fieldTarget,
    nullTarget,
  );
} else {
  const data = ${resultObjectSource};
  fieldTarget.container[fieldTarget.key] = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    nullTarget,
    deliveryGroupMap,
    runtimeType,
  );
}`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  returnType,
  fieldDetailsList,
  fieldPath,
  fieldTarget,
  nullTarget,
);`,
  }),
  '      ',
)}
	      return;
	    }

    if (isTypeOf !== true) {
      executor.handleCompletionError(
        executor.invalidReturnTypeError(
          runtimeType,
          result,
          fieldDetailsList,
        ),
        returnType,
        fieldDetailsList,
        fieldPath,
        fieldTarget,
        nullTarget,
      );
      return;
    }
  }

  const data = ${resultObjectSource};
  fieldTarget.container[fieldTarget.key] = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    nullTarget,
    deliveryGroupMap,
    runtimeType,
  );
}`;
}

function generatedLeafListCompletionHelperFunctions(
  completeName: string,
  fieldPlan: FieldPlan,
  fieldIndex: number,
): string {
  const coerceOutputValueName = `coerceOutputValue${fieldIndex}`;
  const fieldDetailsListName = `fieldDetailsList${fieldIndex}`;
  const fieldPathName = `path${fieldIndex}`;
  const itemTypeName = `itemType${fieldIndex}`;
  const leafTypeName = `leafType${fieldIndex}`;
  return `async function ${completeName}AsyncLeafListItems(
  executor,
  runner,
  items,
  completedResults,
  nullTarget,
) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, { fieldPath: true })}
  const iterator = items[Symbol.asyncIterator]();
  let iteration;
  let index = 0;

  try {
    while (true) {
      iteration = await iterator.next();
      if (executor.aborted || iteration.done) {
        break;
      }

      ${completeName}LeafListItems(
        executor,
        runner,
        [iteration.value],
        completedResults,
        nullTarget,
        index,
      );
      runner.drain();
      if (executor.collectedErrors.hasNulledPosition(fieldPath)) {
        executor.sharedExecutionContext.asyncWorkTracker.add(
          returnIteratorCatchingErrors(iterator),
        );
        return;
      }

      index++;
    }
  } catch (error) {
    executor.sharedExecutionContext.asyncWorkTracker.add(
      returnIteratorCatchingErrors(iterator),
    );
    throw error;
  }

  if (executor.aborted) {
    if (iteration?.done !== true) {
      executor.sharedExecutionContext.asyncWorkTracker.add(
        returnIteratorCatchingErrors(iterator),
      );
    }
    throw new Error('Aborted!');
  }
}

function ${completeName}LeafListItems(
  executor,
  runner,
  values,
  completedResults,
  nullTarget,
  offset,
) {

  const end = offset + values.length;
  if (completedResults.length < end) {
    completedResults.length = end;
  }
  for (let index = 0; index < values.length; index++) {
    const completedIndex = offset + index;
    const value = values[index];
    if (value != null && typeof value.then === 'function') {
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'value',
    onResolveSource: `${completeName}LeafListItem(
  executor,
  resolved,
  completedResults,
  completedIndex,
  nullTarget,
);`,
    onRejectSource: `${completeName}LeafListItemError(
  executor,
  rawError,
  completedResults,
  completedIndex,
  nullTarget,
);`,
  }),
  '      ',
)}
      continue;
	    }

	${indentGeneratedSource(
    generatedBuiltinScalarCompletionSource({
      assignmentSource: (coerced) =>
        `completedResults[completedIndex] = ${coerced};`,
      exitStatement: 'continue;',
      fieldPlan,
      valueName: 'value',
    }),
    '    ',
  )}
	    ${completeName}LeafListItem(
	      executor,
	      value,
      completedResults,
      completedIndex,
      nullTarget,
    );
  }
}

function ${completeName}LeafListItemError(
  executor,
  rawError,
  completedResults,
  index,
  nullTarget,
  providedItemPath,
) {
  const itemPath =
    providedItemPath ?? { prev: ${fieldPathName}, key: index, typename: undefined };
  const itemTarget = {
    container: completedResults,
    key: index,
    path: itemPath,
  };
  executor.handleCompletionError(
    rawError,
    ${itemTypeName},
    ${fieldDetailsListName},
    itemPath,
    itemTarget,
    ${generatedListItemNullTargetSource(fieldPlan, 'itemTarget', 'nullTarget')},
  );
}

function ${completeName}LeafListItem(
  executor,
  value,
  completedResults,
  index,
  nullTarget,
  providedItemPath,
) {
${generatedBuiltinScalarCompletionSource({
  assignmentSource: (coerced) => `completedResults[index] = ${coerced};`,
  exitStatement: 'return;',
  fieldPlan,
  valueName: 'value',
})}  if (value instanceof Error) {
    ${completeName}LeafListItemError(
      executor,
      value,
      completedResults,
      index,
      nullTarget,
      providedItemPath,
    );
    return;
  }

  if (value == null) {
${indentGeneratedSource(
  fieldPlan.completedItemNonNull
    ? `const itemPath =
  providedItemPath ?? { prev: ${fieldPathName}, key: index, typename: undefined };
const itemTarget = {
  container: completedResults,
  key: index,
  path: itemPath,
};
${generatedNullListItemCompletionSource({
  completedResultsName: 'completedResults',
  fieldPlan,
  fieldDetailsListName,
  indexName: 'index',
  itemNullTargetName: 'nullTarget',
  itemPathName: 'itemPath',
  itemTargetName: 'itemTarget',
  itemTypeName,
})}`
    : generatedNullListItemCompletionSource({
        completedResultsName: 'completedResults',
        fieldPlan,
        fieldDetailsListName,
        indexName: 'index',
        itemNullTargetName: 'nullTarget',
        itemPathName: 'itemPath',
        itemTargetName: 'itemTarget',
        itemTypeName,
      }),
  '    ',
)}
    return;
  }

  try {
    const coerced = ${coerceOutputValueName}(value);
    if (coerced == null) {
      throw new Error(
        \`Expected \\\`\${inspect(${leafTypeName})}.coerceOutputValue(\${inspect(
          value,
        )})\\\` to return non-nullable value, returned: \${inspect(coerced)}\`,
      );
    }
    completedResults[index] = coerced;
  } catch (rawError) {
    ${completeName}LeafListItemError(
      executor,
      rawError,
      completedResults,
      index,
      nullTarget,
      providedItemPath,
    );
  }
}`;
}

interface BuiltinScalarCompletionSourceContext {
  assignmentSource: (coerced: string) => string;
  exitStatement: string;
  fieldPlan: FieldPlan;
  valueName: string;
}

function generatedBuiltinScalarCompletionSource({
  assignmentSource,
  exitStatement,
  fieldPlan,
  valueName,
}: BuiltinScalarCompletionSourceContext): string {
  const helperName = generatedBuiltinOutputCoerceFunctionName(
    fieldPlan.builtinScalarName,
  );
  if (helperName === undefined) {
    return '';
  }

  const assignment = (coerced: string) =>
    `${assignmentSource(coerced)}
      ${exitStatement}`;

  const scalarName =
    fieldPlan.builtinScalarName as BuiltInScalarVariablePlan['scalarName'];
  switch (scalarName) {
    case 'Boolean':
      return `  if (typeof ${valueName} === 'boolean') {
    ${assignment(valueName)}
  }
  if (typeof ${valueName} === 'number' && Number.isFinite(${valueName})) {
    ${assignment(`${valueName} !== 0`)}
  }
  if (typeof ${valueName} === 'bigint') {
    ${assignment(`${valueName} !== 0n`)}
  }

`;
    case 'Float':
      return `  if (typeof ${valueName} === 'number' && Number.isFinite(${valueName})) {
    ${assignment(valueName)}
  }
  if (typeof ${valueName} === 'boolean') {
    ${assignment(`${valueName} ? 1 : 0`)}
  }
  if (typeof ${valueName} === 'string' && ${valueName} !== '') {
    const coerced = Number(${valueName});
    if (Number.isFinite(coerced)) {
      ${assignment('coerced')}
    }
  }
  if (typeof ${valueName} === 'bigint') {
    const coerced = Number(${valueName});
    if (Number.isFinite(coerced) && BigInt(coerced) === ${valueName}) {
      ${assignment('coerced')}
    }
  }

`;
    case 'ID':
      return `  if (typeof ${valueName} === 'string') {
    ${assignment(valueName)}
  }
  if (typeof ${valueName} === 'number' && Number.isInteger(${valueName})) {
    ${assignment(`String(${valueName})`)}
  }
  if (typeof ${valueName} === 'bigint') {
    ${assignment(`String(${valueName})`)}
  }

`;
    case 'Int':
      return `  if (
    typeof ${valueName} === 'number' &&
    Number.isInteger(${valueName}) &&
    ${valueName} <= 2147483647 &&
    ${valueName} >= -2147483648
  ) {
    ${assignment(valueName)}
  }
  if (typeof ${valueName} === 'boolean') {
    ${assignment(`${valueName} ? 1 : 0`)}
  }
  if (typeof ${valueName} === 'string' && ${valueName} !== '') {
    const coerced = Number(${valueName});
    if (
      Number.isInteger(coerced) &&
      coerced <= 2147483647 &&
      coerced >= -2147483648
    ) {
      ${assignment('coerced')}
    }
  }
  if (
    typeof ${valueName} === 'bigint' &&
    ${valueName} <= 2147483647 &&
    ${valueName} >= -2147483648
  ) {
    ${assignment(`Number(${valueName})`)}
  }

`;
    case 'String':
      return `  if (typeof ${valueName} === 'string') {
    ${assignment(valueName)}
  }
  if (typeof ${valueName} === 'boolean') {
    ${assignment(`${valueName} ? 'true' : 'false'`)}
  }
  if (typeof ${valueName} === 'number' && Number.isFinite(${valueName})) {
    ${assignment(`String(${valueName})`)}
  }
  if (typeof ${valueName} === 'bigint') {
    ${assignment(`String(${valueName})`)}
  }

`;
  }
}

function generatedObjectListCompletionSource(
  completeName: string,
  fieldPlan: FieldPlan,
): string {
  const nullCompletionSource = generatedNullFieldCompletionSource(fieldPlan);
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  const streamSetupSource =
    fieldPlan.streamPlan === undefined
      ? ''
      : generatedStreamUsageSetupSource(fieldPlan, '');
  const arrayCondition =
    fieldPlan.streamPlan === undefined
      ? 'Array.isArray(result)'
      : 'streamUsage === undefined && Array.isArray(result)';
  const streamIteratorBreakSource =
    fieldPlan.streamPlan === undefined
      ? ''
      : `      if (
        streamUsage?.initialCount === index &&
        executor.handleStream(
          index,
          fieldPath,
          { handle: iterator },
	          streamUsage,
	          streamInfo,
	          itemType${generatedStreamItemCompleterArgument(completeName, '          ')},
	        )
	      ) {
        break;
      }
`;
  return `  if (result instanceof Error) {
    executor.handleCompletionError(
      result,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  if (result == null) {
${indentGeneratedSource(nullCompletionSource, '    ')}
    return;
  }

${streamSetupSource}
  if (${arrayCondition}) {
    const completedResults = new Array(result.length);
    ${targetField} = completedResults;
    ${completeName}ObjectListItems(
      executor,
      runner,
      result,
      completedResults,
      nullTarget,
      0,
    );
    return;
  }

  const completedResults = [];
  ${targetField} = completedResults;
  if (isAsyncIterable(result)) {
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression:
      fieldPlan.streamPlan === undefined
        ? `${completeName}AsyncObjectListItems(
  executor,
  runner,
  result,
  completedResults,
  nullTarget,
)`
        : `executor.readAsyncListInitial(
  result,
  streamUsage,
  fieldPath,
  fieldDetailsList,
)`,
    onResolveSource:
      fieldPlan.streamPlan === undefined
        ? ''
        : `${completeName}ObjectListItems(
  executor,
  runner,
  resolved.values,
  completedResults,
  nullTarget,
  0,
);
if (!resolved.done) {
  executor.handleStream(
    resolved.nextIndex,
    fieldPath,
    { handle: resolved.iterator, isAsync: true },
	    streamUsage,
	    streamInfo,
	    itemType${generatedStreamItemCompleterArgument(completeName, '    ')},
	  );
	}`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  returnType,
  fieldDetailsList,
  fieldPath,
  fieldTarget,
  nullTarget,
);`,
  }),
  '    ',
)}
    return;
  }

  if (!isIterableObject(result)) {
    executor.handleCompletionError(
      new Error(
        'Expected Iterable, but did not find one for field "${fieldPlan.parentTypeName}.${fieldPlan.fieldName}".',
      ),
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  const values = [];
  const iterator = result[Symbol.iterator]();
  let index = 0;
  try {
    while (true) {
${streamIteratorBreakSource}      const iteration = iterator.next();
      if (iteration.done) {
        break;
      }
      values.push(iteration.value);
      index++;
    }
  } catch (rawError) {
    executor.sharedExecutionContext.asyncWorkTracker.addValues(
      collectIteratorPromises(iterator),
    );
    executor.handleCompletionError(
      rawError,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  ${completeName}ObjectListItems(
    executor,
    runner,
    values,
    completedResults,
    nullTarget,
    0,
  );`;
}

function generatedNullableObjectListCompletionSource(
  completeName: string,
  fieldPlan: FieldPlan,
): string {
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  const createFieldTarget = `const fieldTarget = {
      container: target,
      key: ${toJavaScript(fieldPlan.responseName)},
      path: fieldPath,
    };`;
  const streamSetupSource =
    fieldPlan.streamPlan === undefined
      ? ''
      : generatedStreamUsageSetupSource(
          fieldPlan,
          createFieldTarget,
          'fieldTarget',
        );
  const arrayCondition =
    fieldPlan.streamPlan === undefined
      ? 'Array.isArray(result)'
      : 'streamUsage === undefined && Array.isArray(result)';
  const streamIteratorBreakSource =
    fieldPlan.streamPlan === undefined
      ? ''
      : `      if (
        streamUsage?.initialCount === index &&
        executor.handleStream(
          index,
          fieldPath,
          { handle: iterator },
	          streamUsage,
	          streamInfo,
	          itemType${generatedStreamItemCompleterArgument(completeName, '          ')},
	        )
	      ) {
        break;
      }
`;
  return `  if (result instanceof Error) {
    ${createFieldTarget}
    executor.handleCompletionError(
      result,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      fieldTarget,
    );
    return;
  }

  if (result == null) {
    ${targetField} = null;
    return;
  }

${streamSetupSource}
  if (${arrayCondition}) {
    const completedResults = new Array(result.length);
    ${targetField} = completedResults;
    ${completeName}ObjectListItems(
      executor,
      runner,
      result,
      completedResults,
      undefined,
      0,
    );
    return;
  }

  const completedResults = [];
  ${targetField} = completedResults;
  if (isAsyncIterable(result)) {
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression:
      fieldPlan.streamPlan === undefined
        ? `${completeName}AsyncObjectListItems(
  executor,
  runner,
  result,
  completedResults,
  undefined,
)`
        : `executor.readAsyncListInitial(
  result,
  streamUsage,
  fieldPath,
  fieldDetailsList,
)`,
    onResolveSource:
      fieldPlan.streamPlan === undefined
        ? ''
        : `${completeName}ObjectListItems(
  executor,
  runner,
  resolved.values,
  completedResults,
  undefined,
  0,
);
if (!resolved.done) {
  executor.handleStream(
    resolved.nextIndex,
    fieldPath,
    { handle: resolved.iterator, isAsync: true },
	    streamUsage,
	    streamInfo,
	    itemType${generatedStreamItemCompleterArgument(completeName, '    ')},
	  );
	}`,
    onRejectSource: `${createFieldTarget}
executor.handleCompletionError(
  rawError,
  returnType,
  fieldDetailsList,
  fieldPath,
  fieldTarget,
  fieldTarget,
);`,
  }),
  '    ',
)}
    return;
  }

  if (!isIterableObject(result)) {
    ${createFieldTarget}
    executor.handleCompletionError(
      new Error(
        'Expected Iterable, but did not find one for field "${fieldPlan.parentTypeName}.${fieldPlan.fieldName}".',
      ),
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      fieldTarget,
    );
    return;
  }

  const values = [];
  const iterator = result[Symbol.iterator]();
  let index = 0;
  try {
    while (true) {
${streamIteratorBreakSource}      const iteration = iterator.next();
      if (iteration.done) {
        break;
      }
      values.push(iteration.value);
      index++;
    }
  } catch (rawError) {
    executor.sharedExecutionContext.asyncWorkTracker.addValues(
      collectIteratorPromises(iterator),
    );
    ${createFieldTarget}
    executor.handleCompletionError(
      rawError,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      fieldTarget,
    );
    return;
  }

  ${completeName}ObjectListItems(
    executor,
    runner,
    values,
    completedResults,
    undefined,
    0,
  );`;
}

function generatedObjectListCompletionHelperFunctions(
  completeName: string,
  childSelectionSetName: string | undefined,
  fieldPlan: FieldPlan,
  fieldIndex: number,
): string {
  const executeChildFields = getGeneratedChildSelectionSetName(
    childSelectionSetName,
  );
  const resultObjectSource = generatedResultObjectSource();
  const isTypeOfSource =
    fieldPlan.objectTypeHasIsTypeOf === true
      ? `  const validatedExecutionArgs = executor.validatedExecutionArgs;
  const info = ${generatedResolveInfoObjectSource({
    fieldName: toJavaScript(fieldPlan.fieldName),
    fieldNodes: 'fieldNodes',
    parentType: 'parentType',
    path: 'fieldPath',
    returnType: 'returnType',
  })};
  let isTypeOf;
  try {
    isTypeOf = objectType.isTypeOf(
      result,
      validatedExecutionArgs.contextValue,
      info,
    );
  } catch (rawError) {
    executor.handleCompletionError(
      rawError,
      itemType,
      fieldDetailsList,
      itemPath,
      itemTarget,
      itemNullTarget,
    );
    return;
  }

	  if (isTypeOf != null && typeof isTypeOf.then === 'function') {
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'isTypeOf',
    resolvedName: 'resolvedIsTypeOf',
    onResolveSource: `if (resolvedIsTypeOf !== true) {
  executor.handleCompletionError(
    executor.invalidReturnTypeError(
      objectType,
      result,
      fieldDetailsList,
    ),
    itemType,
    fieldDetailsList,
    itemPath,
    itemTarget,
    itemNullTarget,
  );
} else {
  const data = ${resultObjectSource};
  completedResults[index] = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    itemNullTarget,
    undefined,
    itemPath,
  );
}`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  itemType,
  fieldDetailsList,
  itemPath,
  itemTarget,
  itemNullTarget,
);`,
  }),
  '    ',
)}
	    return;
	  }

  if (isTypeOf !== true) {
    executor.handleCompletionError(
      executor.invalidReturnTypeError(
        objectType,
        result,
        fieldDetailsList,
      ),
      itemType,
      fieldDetailsList,
      itemPath,
      itemTarget,
      itemNullTarget,
    );
    return;
  }

`
      : '';
  const objectListItemFunctions = generatedObjectListItemFunctionsSource({
    completeName,
    executeChildFields,
    fieldIndex,
    fieldPlan,
    isTypeOfSource,
  });
  const objectListItemFastPath = generatedObjectListItemFastPathSource({
    executeChildFields,
    fieldIndex,
    fieldPlan,
  });
  return `async function ${completeName}AsyncObjectListItems(
  executor,
  runner,
  items,
  completedResults,
  nullTarget,
) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, { fieldPath: true })}
  const iterator = items[Symbol.asyncIterator]();
  let iteration;
  let index = 0;
  try {
    while (true) {
      iteration = await iterator.next();
      if (executor.aborted || iteration.done) {
        break;
      }
      ${completeName}ObjectListItem(
        executor,
        runner,
        iteration.value,
        completedResults,
        index,
        nullTarget,
      );
      runner.drain();
      if (executor.collectedErrors.hasNulledPosition(fieldPath)) {
        executor.sharedExecutionContext.asyncWorkTracker.add(
          returnIteratorCatchingErrors(iterator),
        );
        return;
      }
      index++;
    }
  } catch (error) {
    executor.sharedExecutionContext.asyncWorkTracker.add(
      returnIteratorCatchingErrors(iterator),
    );
    throw error;
  }

  if (executor.aborted) {
    if (iteration?.done !== true) {
      executor.sharedExecutionContext.asyncWorkTracker.add(
        returnIteratorCatchingErrors(iterator),
      );
    }
    throw new Error('Aborted!');
  }
}

function ${completeName}ObjectListItems(
  executor,
  runner,
  values,
  completedResults,
  nullTarget,
  offset,
) {

  const end = offset + values.length;
  if (completedResults.length < end) {
    completedResults.length = end;
	  }
	  for (let index = 0; index < values.length; index++) {
	    const completedIndex = offset + index;
	    const result = values[index];
	${indentGeneratedSource(objectListItemFastPath, '    ')}
	    ${completeName}ObjectListItem(
	      executor,
	      runner,
	      result,
	      completedResults,
	      completedIndex,
	      nullTarget,
	    );
	  }
}

${objectListItemFunctions}`;
}

interface ObjectListItemFunctionsSourceContext {
  completeName: string;
  executeChildFields: string;
  fieldIndex: number;
  fieldPlan: FieldPlan;
  isTypeOfSource: string;
}

function generatedObjectListItemFastPathSource({
  executeChildFields,
  fieldIndex,
  fieldPlan,
}: Omit<
  ObjectListItemFunctionsSourceContext,
  'completeName' | 'isTypeOfSource'
>): string {
  if (
    fieldPlan.objectTypeHasIsTypeOf === true ||
    fieldPlan.fields?.some(hasImmediateDefaultResolvedLeafField) !== true
  ) {
    return '';
  }

  const resultObjectSource = generatedResultObjectSource();
  const fieldPathName = `path${fieldIndex}`;
  const itemTargetSource =
    fieldPlan.completedItemNonNull || fieldPlan.childrenCanNullParent === true
      ? `const itemTarget = {
  container: completedResults,
  key: completedIndex,
  path: itemPath,
};
const itemNullTarget = ${generatedListItemNullTargetSource(
          fieldPlan,
          'itemTarget',
          'nullTarget',
        )};`
      : 'const itemNullTarget = nullTarget;';

  return `if (
  result != null &&
  typeof result.then !== 'function' &&
  !(result instanceof Error)
) {
  const itemPath = { prev: ${fieldPathName}, key: completedIndex, typename: undefined };
  ${itemTargetSource}
  const data = ${resultObjectSource};
  completedResults[completedIndex] = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    itemNullTarget,
    undefined,
    itemPath,
  );
  continue;
}`;
}

const leafFieldOutputKinds = new Set<FieldPlan['outputKind']>([
  'leaf',
  'leafList',
]);

function hasImmediateDefaultResolvedLeafField(field: FieldPlan): boolean {
  return (
    field.resolveMode === 'default' &&
    !isGeneratedMetaFieldName(field.fieldName) &&
    leafFieldOutputKinds.has(field.outputKind)
  );
}

function generatedObjectListItemFunctionsSource({
  completeName,
  executeChildFields,
  fieldIndex,
  fieldPlan,
  isTypeOfSource,
}: ObjectListItemFunctionsSourceContext): string {
  if (
    fieldPlan.completedItemNonNull ||
    fieldPlan.childrenCanNullParent === true ||
    fieldPlan.objectTypeHasIsTypeOf === true
  ) {
    return generatedObjectListItemFunctionsWithTargetSource({
      completeName,
      executeChildFields,
      fieldIndex,
      fieldPlan,
      isTypeOfSource,
    });
  }

  return generatedNullableObjectListItemFunctionsSource({
    completeName,
    executeChildFields,
    fieldIndex,
    fieldPlan,
  });
}

function generatedObjectListItemFunctionsWithTargetSource({
  completeName,
  executeChildFields,
  fieldIndex,
  fieldPlan,
  isTypeOfSource,
}: ObjectListItemFunctionsSourceContext): string {
  if (fieldPlan.objectTypeHasIsTypeOf !== true) {
    return generatedObjectListItemFunctionsWithTargetWithoutIsTypeOfSource({
      completeName,
      executeChildFields,
      fieldIndex,
      fieldPlan,
    });
  }

  const resultObjectSource = generatedResultObjectSource();
  const syncCompletionSource = `${completeName}ResolvedObjectListItem(
    executor,
    runner,
    result,
    completedResults,
    index,
    itemPath,
    itemTarget,
    itemNullTarget,
  );`;
  return `function ${completeName}ObjectListItem(
  executor,
  runner,
  result,
	  completedResults,
	  index,
	  nullTarget,
	  providedItemPath,
	) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, {
  fieldDetailsList: true,
  fieldPath: true,
  itemType: true,
})}
  const itemPath =
    providedItemPath ?? { prev: fieldPath, key: index, typename: undefined };
  const itemTarget = {
    container: completedResults,
    key: index,
    path: itemPath,
  };
  const itemNullTarget = ${generatedListItemNullTargetSource(
    fieldPlan,
    'itemTarget',
    'nullTarget',
  )};
  if (result != null && typeof result.then === 'function') {
    completedResults[index] = undefined;
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'result',
    onResolveSource: `${completeName}ResolvedObjectListItem(
  executor,
  runner,
  resolved,
  completedResults,
  index,
  itemPath,
  itemTarget,
  itemNullTarget,
);`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  itemType,
  fieldDetailsList,
  itemPath,
  itemTarget,
  itemNullTarget,
);`,
  }),
  '    ',
)}
    return;
  }

${indentGeneratedSource(syncCompletionSource, '  ')}
}

function ${completeName}ResolvedObjectListItem(
  executor,
  runner,
  result,
  completedResults,
  index,
  itemPath,
  itemTarget,
  itemNullTarget,
) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, {
  fieldDetailsList: true,
  fieldNodes: true,
  fieldPath: true,
  itemType: true,
  objectType: true,
  returnType: true,
})}
  if (result instanceof Error) {
    executor.handleCompletionError(
      result,
      itemType,
      fieldDetailsList,
      itemPath,
      itemTarget,
      itemNullTarget,
    );
    return;
  }

  if (result == null) {
${indentGeneratedSource(
  generatedNullListItemCompletionSource({
    completedResultsName: 'completedResults',
    fieldPlan,
    fieldDetailsListName: 'fieldDetailsList',
    indexName: 'index',
    itemNullTargetName: 'itemNullTarget',
    itemPathName: 'itemPath',
    itemTargetName: 'itemTarget',
    itemTypeName: 'itemType',
  }),
  '    ',
)}
    return;
  }

${isTypeOfSource}
  const data = ${resultObjectSource};
  completedResults[index] = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    itemNullTarget,
    undefined,
    itemPath,
  );
}`;
}

function generatedObjectListItemFunctionsWithTargetWithoutIsTypeOfSource({
  completeName,
  executeChildFields,
  fieldIndex,
  fieldPlan,
}: Omit<ObjectListItemFunctionsSourceContext, 'isTypeOfSource'>): string {
  const resultObjectSource = generatedResultObjectSource();
  const fieldDetailsListName = `fieldDetailsList${fieldIndex}`;
  const fieldPathName = `path${fieldIndex}`;
  const itemTypeName = `itemType${fieldIndex}`;
  const nullListItemCompletionSource = generatedNullListItemCompletionSource({
    completedResultsName: 'completedResults',
    fieldPlan,
    fieldDetailsListName,
    indexName: 'index',
    itemNullTargetName: 'itemNullTarget',
    itemPathName: 'itemPath',
    itemTargetName: 'itemTarget',
    itemTypeName,
  });
  return `function ${completeName}ObjectListItem(
  executor,
  runner,
  result,
\t  completedResults,
\t  index,
\t  nullTarget,
\t  providedItemPath,
\t) {
  const itemPath =
    providedItemPath ?? { prev: ${fieldPathName}, key: index, typename: undefined };
  const itemTarget = {
    container: completedResults,
    key: index,
    path: itemPath,
  };
  const itemNullTarget = ${generatedListItemNullTargetSource(
    fieldPlan,
    'itemTarget',
    'nullTarget',
  )};
  if (result != null && typeof result.then === 'function') {
    completedResults[index] = undefined;
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'result',
    onResolveSource: `${completeName}ResolvedObjectListItem(
  executor,
  runner,
  resolved,
  completedResults,
  index,
  itemPath,
  itemTarget,
  itemNullTarget,
);`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  ${itemTypeName},
  ${fieldDetailsListName},
  itemPath,
  itemTarget,
  itemNullTarget,
);`,
  }),
  '    ',
)}
    return;
  }

  if (result instanceof Error) {
    executor.handleCompletionError(
      result,
      ${itemTypeName},
      ${fieldDetailsListName},
      itemPath,
      itemTarget,
      itemNullTarget,
    );
    return;
  }

  if (result == null) {
${indentGeneratedSource(nullListItemCompletionSource, '    ')}
    return;
  }

  const data = ${resultObjectSource};
  completedResults[index] = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    itemNullTarget,
    undefined,
    itemPath,
  );
}

function ${completeName}ResolvedObjectListItem(
  executor,
  runner,
  result,
  completedResults,
  index,
  itemPath,
  itemTarget,
  itemNullTarget,
) {
  if (result instanceof Error) {
    executor.handleCompletionError(
      result,
      ${itemTypeName},
      ${fieldDetailsListName},
      itemPath,
      itemTarget,
      itemNullTarget,
    );
    return;
  }

  if (result == null) {
${indentGeneratedSource(nullListItemCompletionSource, '    ')}
    return;
  }

  const data = ${resultObjectSource};
  completedResults[index] = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    itemNullTarget,
    undefined,
    itemPath,
  );
}`;
}

function generatedNullableObjectListItemFunctionsSource({
  completeName,
  executeChildFields,
  fieldIndex,
  fieldPlan,
}: Omit<ObjectListItemFunctionsSourceContext, 'isTypeOfSource'>): string {
  const resultObjectSource = generatedResultObjectSource();
  return `function ${completeName}ObjectListItem(
  executor,
  runner,
  result,
	  completedResults,
	  index,
	  nullTarget,
	  providedItemPath,
	) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, {
  fieldDetailsList: true,
  fieldPath: true,
  itemType: true,
})}
  const itemPath =
    providedItemPath ?? { prev: fieldPath, key: index, typename: undefined };
  if (result != null && typeof result.then === 'function') {
    completedResults[index] = undefined;
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'result',
    onResolveSource: `${completeName}ResolvedObjectListItem(
  executor,
  runner,
  resolved,
	  completedResults,
	  index,
	  nullTarget,
	  itemPath,
	);`,
    onRejectSource: `${completeName}ObjectListItemError(
  executor,
	  rawError,
	  completedResults,
	  index,
	  itemPath,
	  nullTarget,
	);`,
  }),
  '    ',
)}
    return;
  }

  if (result instanceof Error) {
    ${completeName}ObjectListItemError(
      executor,
	      result,
	      completedResults,
	      index,
	      itemPath,
	      nullTarget,
	    );
    return;
  }

  if (result == null) {
    completedResults[index] = null;
    return;
  }

  const data = ${resultObjectSource};
  completedResults[index] = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    nullTarget,
    undefined,
    itemPath,
  );
}

function ${completeName}ObjectListItemError(
  executor,
  rawError,
  completedResults,
  index,
  itemPath,
  nullTarget,
) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, {
  fieldDetailsList: true,
  itemType: true,
})}
  const itemTarget = {
    container: completedResults,
    key: index,
    path: itemPath,
  };
  executor.handleCompletionError(
    rawError,
    itemType,
    fieldDetailsList,
    itemPath,
    itemTarget,
    nullTarget,
  );
}

function ${completeName}ResolvedObjectListItem(
  executor,
  runner,
  result,
	  completedResults,
	  index,
	  nullTarget,
	  itemPath,
	) {
  if (result instanceof Error) {
    ${completeName}ObjectListItemError(
      executor,
	      result,
	      completedResults,
	      index,
	      itemPath,
	      nullTarget,
	    );
    return;
  }

  if (result == null) {
    completedResults[index] = null;
    return;
  }

  const data = ${resultObjectSource};
  completedResults[index] = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    nullTarget,
    undefined,
    itemPath,
  );
}`;
}

function generatedAbstractListCompletionSource(
  completeName: string,
  fieldPlan: FieldPlan,
): string {
  const nullCompletionSource = generatedNullFieldCompletionSource(fieldPlan);
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  const streamSetupSource =
    fieldPlan.streamPlan === undefined
      ? ''
      : generatedStreamUsageSetupSource(fieldPlan, '');
  const arrayCondition =
    fieldPlan.streamPlan === undefined
      ? 'Array.isArray(result)'
      : 'streamUsage === undefined && Array.isArray(result)';
  const streamIteratorBreakSource =
    fieldPlan.streamPlan === undefined
      ? ''
      : `      if (
        streamUsage?.initialCount === index &&
        executor.handleStream(
          index,
          fieldPath,
          { handle: iterator },
	          streamUsage,
	          streamInfo,
	          itemType${generatedStreamItemCompleterArgument(completeName, '          ')},
	        )
	      ) {
        break;
      }
`;
  return `  if (result instanceof Error) {
    executor.handleCompletionError(
      result,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  if (result == null) {
${indentGeneratedSource(nullCompletionSource, '    ')}
    return;
  }

${streamSetupSource}
  if (${arrayCondition}) {
    const completedResults = new Array(result.length);
    ${targetField} = completedResults;
    ${completeName}AbstractListItems(
      executor,
      runner,
      result,
      completedResults,
      nullTarget,
      0,
    );
    return;
  }

  const completedResults = [];
  ${targetField} = completedResults;
  if (isAsyncIterable(result)) {
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression:
      fieldPlan.streamPlan === undefined
        ? `${completeName}AsyncAbstractListItems(
  executor,
  runner,
  result,
  completedResults,
  nullTarget,
)`
        : `executor.readAsyncListInitial(
  result,
  streamUsage,
  fieldPath,
  fieldDetailsList,
)`,
    onResolveSource:
      fieldPlan.streamPlan === undefined
        ? ''
        : `${completeName}AbstractListItems(
  executor,
  runner,
  resolved.values,
  completedResults,
  nullTarget,
  0,
);
if (!resolved.done) {
  executor.handleStream(
    resolved.nextIndex,
    fieldPath,
    { handle: resolved.iterator, isAsync: true },
	    streamUsage,
	    streamInfo,
	    itemType${generatedStreamItemCompleterArgument(completeName, '    ')},
	  );
	}`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  returnType,
  fieldDetailsList,
  fieldPath,
  fieldTarget,
  nullTarget,
);`,
  }),
  '    ',
)}
    return;
  }

  if (!isIterableObject(result)) {
    executor.handleCompletionError(
      new Error(
        'Expected Iterable, but did not find one for field "${fieldPlan.parentTypeName}.${fieldPlan.fieldName}".',
      ),
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  const values = [];
  const iterator = result[Symbol.iterator]();
  let index = 0;
  try {
    while (true) {
${streamIteratorBreakSource}      const iteration = iterator.next();
      if (iteration.done) {
        break;
      }
      values.push(iteration.value);
      index++;
    }
  } catch (rawError) {
    executor.sharedExecutionContext.asyncWorkTracker.addValues(
      collectIteratorPromises(iterator),
    );
    executor.handleCompletionError(
      rawError,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  ${completeName}AbstractListItems(
    executor,
    runner,
    values,
    completedResults,
    nullTarget,
    0,
  );`;
}

function generatedAbstractListCompletionHelperFunctions(
  completeName: string,
  childSelectionSetName: string | undefined,
  fieldPlan: FieldPlan,
  fieldIndex: number,
): string {
  const executeChildFields = getGeneratedChildSelectionSetName(
    childSelectionSetName,
  );
  const resultObjectSource = generatedAbstractResultObjectSource();
  return `async function ${completeName}AsyncAbstractListItems(
  executor,
  runner,
  items,
  completedResults,
  nullTarget,
) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, { fieldPath: true })}
  const iterator = items[Symbol.asyncIterator]();
  let iteration;
  let index = 0;
  try {
    while (true) {
      iteration = await iterator.next();
      if (executor.aborted || iteration.done) {
        break;
      }
      ${completeName}AbstractListItem(
        executor,
        runner,
        iteration.value,
        completedResults,
        index,
        nullTarget,
      );
      runner.drain();
      if (executor.collectedErrors.hasNulledPosition(fieldPath)) {
        executor.sharedExecutionContext.asyncWorkTracker.add(
          returnIteratorCatchingErrors(iterator),
        );
        return;
      }
      index++;
    }
  } catch (error) {
    executor.sharedExecutionContext.asyncWorkTracker.add(
      returnIteratorCatchingErrors(iterator),
    );
    throw error;
  }

  if (executor.aborted) {
    if (iteration?.done !== true) {
      executor.sharedExecutionContext.asyncWorkTracker.add(
        returnIteratorCatchingErrors(iterator),
      );
    }
    throw new Error('Aborted!');
  }
}

function ${completeName}AbstractListItems(
  executor,
  runner,
  values,
  completedResults,
  nullTarget,
  offset,
) {

  const end = offset + values.length;
  if (completedResults.length < end) {
    completedResults.length = end;
  }
  for (let index = 0; index < values.length; index++) {
    ${completeName}AbstractListItem(
      executor,
      runner,
      values[index],
      completedResults,
      offset + index,
      nullTarget,
    );
  }
}

function ${completeName}AbstractListItem(
  executor,
  runner,
  result,
	  completedResults,
	  index,
	  nullTarget,
	  providedItemPath,
	) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, {
  fieldDetailsList: true,
  fieldPath: true,
  itemType: true,
})}
  const itemPath =
    providedItemPath ?? { prev: fieldPath, key: index, typename: undefined };
  const itemTarget = {
    container: completedResults,
    key: index,
    path: itemPath,
  };
  const itemNullTarget = ${generatedListItemNullTargetSource(
    fieldPlan,
    'itemTarget',
    'nullTarget',
  )};
  if (result != null && typeof result.then === 'function') {
    completedResults[index] = undefined;
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'result',
    onResolveSource: `${completeName}ResolvedAbstractListItem(
  executor,
  runner,
  resolved,
  completedResults,
  index,
  itemPath,
  itemTarget,
  itemNullTarget,
);`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  itemType,
  fieldDetailsList,
  itemPath,
  itemTarget,
  itemNullTarget,
);`,
  }),
  '    ',
)}
    return;
  }

  ${completeName}ResolvedAbstractListItem(
    executor,
    runner,
    result,
    completedResults,
    index,
    itemPath,
    itemTarget,
    itemNullTarget,
  );
}

function ${completeName}ResolvedAbstractListItem(
  executor,
  runner,
  result,
  completedResults,
  index,
  itemPath,
  itemTarget,
  itemNullTarget,
) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, {
  abstractType: true,
  fieldDetailsList: true,
  fieldNodes: true,
  fieldPath: true,
  itemType: true,
  returnType: true,
})}
  if (result instanceof Error) {
    executor.handleCompletionError(
      result,
      itemType,
      fieldDetailsList,
      itemPath,
      itemTarget,
      itemNullTarget,
    );
    return;
  }

  if (result == null) {
${indentGeneratedSource(
  generatedNullListItemCompletionSource({
    completedResultsName: 'completedResults',
    fieldPlan,
    fieldDetailsListName: 'fieldDetailsList',
    indexName: 'index',
    itemNullTargetName: 'itemNullTarget',
    itemPathName: 'itemPath',
    itemTargetName: 'itemTarget',
    itemTypeName: 'itemType',
  }),
  '    ',
)}
    return;
  }

  const validatedExecutionArgs = executor.validatedExecutionArgs;
  const info = ${generatedResolveInfoObjectSource({
    fieldName: toJavaScript(fieldPlan.fieldName),
    fieldNodes: 'fieldNodes',
    parentType: 'parentType',
    path: 'fieldPath',
    returnType: 'returnType',
  })};
  const resolveTypeFn =
    abstractType.resolveType ??
    validatedExecutionArgs.typeResolver;
  let runtimeTypeName;
  try {
    runtimeTypeName = resolveTypeFn(
      result,
      validatedExecutionArgs.contextValue,
      info,
      abstractType,
    );
  } catch (rawError) {
    executor.handleCompletionError(
      rawError,
      itemType,
      fieldDetailsList,
      itemPath,
      itemTarget,
      itemNullTarget,
    );
    return;
  }

  if (runtimeTypeName != null && typeof runtimeTypeName.then === 'function') {
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'runtimeTypeName',
    resolvedName: 'resolvedRuntimeTypeName',
    onResolveSource: `${completeName}AbstractListItemRuntimeType(
  executor,
  runner,
  result,
  itemPath,
  itemTarget,
  itemNullTarget,
  resolvedRuntimeTypeName,
  info,
);`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  itemType,
  fieldDetailsList,
  itemPath,
  itemTarget,
  itemNullTarget,
);`,
  }),
  '    ',
)}
    return;
  }

  ${completeName}AbstractListItemRuntimeType(
    executor,
    runner,
    result,
    itemPath,
    itemTarget,
    itemNullTarget,
    runtimeTypeName,
    info,
  );
}

function ${completeName}AbstractListItemRuntimeType(
  executor,
  runner,
  result,
  itemPath,
  itemTarget,
  itemNullTarget,
  runtimeTypeName,
  info,
) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, {
  abstractType: true,
  fieldDetailsList: true,
  itemType: true,
})}
  let runtimeType;
  try {
    runtimeType = executor.ensureValidRuntimeType(
      runtimeTypeName,
      abstractType,
      fieldDetailsList,
      info,
      result,
    );
  } catch (rawError) {
    executor.handleCompletionError(
      rawError,
      itemType,
      fieldDetailsList,
      itemPath,
      itemTarget,
      itemNullTarget,
    );
    return;
  }

  ${completeName}AbstractListItemRuntimeObject(
    executor,
    runner,
    result,
    itemPath,
    itemTarget,
    itemNullTarget,
    runtimeType,
    info,
  );
}

function ${completeName}AbstractListItemRuntimeObject(
  executor,
  runner,
  result,
  itemPath,
  itemTarget,
  itemNullTarget,
  runtimeType,
  info,
) {
${generatedFieldAliasSource(fieldIndex, fieldPlan, {
  fieldDetailsList: true,
  itemType: true,
})}
  if (runtimeType.isTypeOf !== undefined) {
    let isTypeOf;
    try {
      isTypeOf = runtimeType.isTypeOf(
        result,
        executor.validatedExecutionArgs.contextValue,
        info,
      );
    } catch (rawError) {
      executor.handleCompletionError(
        rawError,
        itemType,
        fieldDetailsList,
        itemPath,
        itemTarget,
        itemNullTarget,
      );
      return;
    }

	    if (isTypeOf != null && typeof isTypeOf.then === 'function') {
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression: 'isTypeOf',
    resolvedName: 'resolvedIsTypeOf',
    onResolveSource: `if (resolvedIsTypeOf !== true) {
  executor.handleCompletionError(
    executor.invalidReturnTypeError(
      runtimeType,
      result,
      fieldDetailsList,
    ),
    itemType,
    fieldDetailsList,
    itemPath,
    itemTarget,
    itemNullTarget,
  );
} else {
  const data = ${resultObjectSource};
  itemTarget.container[itemTarget.key] = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    itemNullTarget,
    undefined,
    runtimeType,
  );
}`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  itemType,
  fieldDetailsList,
  itemPath,
  itemTarget,
  itemNullTarget,
);`,
  }),
  '      ',
)}
	      return;
	    }

    if (isTypeOf !== true) {
      executor.handleCompletionError(
        executor.invalidReturnTypeError(
          runtimeType,
          result,
          fieldDetailsList,
        ),
        itemType,
        fieldDetailsList,
        itemPath,
        itemTarget,
        itemNullTarget,
      );
      return;
    }
  }

  const data = ${resultObjectSource};
  itemTarget.container[itemTarget.key] = data;
  ${executeChildFields}(
    executor,
    runner,
    result,
    data,
    itemNullTarget,
    undefined,
    runtimeType,
  );
}`;
}

function generatedLeafListCompletionSource(
  completeName: string,
  fieldPlan: FieldPlan,
): string {
  const nullCompletionSource = generatedNullFieldCompletionSource(fieldPlan);
  const targetField = generatedObjectAssignmentSource(
    'target',
    fieldPlan.responseName,
  );
  const streamSetupSource =
    fieldPlan.streamPlan === undefined
      ? ''
      : generatedStreamUsageSetupSource(fieldPlan, '');
  const arrayCondition =
    fieldPlan.streamPlan === undefined
      ? 'Array.isArray(result)'
      : 'streamUsage === undefined && Array.isArray(result)';
  const streamIteratorBreakSource =
    fieldPlan.streamPlan === undefined
      ? ''
      : `      if (
        streamUsage?.initialCount === index &&
        executor.handleStream(
          index,
          fieldPath,
          { handle: iterator },
	          streamUsage,
	          streamInfo,
	          itemType${generatedStreamItemCompleterArgument(completeName, '          ')},
	        )
	      ) {
        break;
      }
`;
  return `  if (result instanceof Error) {
    executor.handleCompletionError(
      result,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  if (result == null) {
${indentGeneratedSource(nullCompletionSource, '    ')}
    return;
  }

${streamSetupSource}
	  if (${arrayCondition}) {
	    const completedResults = new Array(result.length);
	    ${targetField} = completedResults;
	    ${completeName}LeafListItems(
	      executor,
	      runner,
      result,
      completedResults,
      nullTarget,
      0,
	    );
	    return;
	  }

  if (isAsyncIterable(result)) {
    const completedResults = [];
    ${targetField} = completedResults;
${indentGeneratedSource(
  generatedSimplePromiseSource({
    promiseExpression:
      fieldPlan.streamPlan === undefined
        ? `${completeName}AsyncLeafListItems(
  executor,
  runner,
  result,
  completedResults,
  nullTarget,
)`
        : `executor.readAsyncListInitial(
  result,
  streamUsage,
  fieldPath,
  fieldDetailsList,
)`,
    onResolveSource:
      fieldPlan.streamPlan === undefined
        ? ''
        : `${completeName}LeafListItems(
  executor,
  runner,
  resolved.values,
  completedResults,
  nullTarget,
  0,
);
if (!resolved.done) {
  executor.handleStream(
    resolved.nextIndex,
    fieldPath,
    { handle: resolved.iterator, isAsync: true },
	    streamUsage,
	    streamInfo,
	    itemType${generatedStreamItemCompleterArgument(completeName, '    ')},
	  );
	}`,
    onRejectSource: `executor.handleCompletionError(
  rawError,
  returnType,
  fieldDetailsList,
  fieldPath,
  fieldTarget,
  nullTarget,
);`,
  }),
  '    ',
)}
    return;
  }

  if (!isIterableObject(result)) {
    executor.handleCompletionError(
      new Error(
        'Expected Iterable, but did not find one for field "${fieldPlan.parentTypeName}.${fieldPlan.fieldName}".',
      ),
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  const completedResults = [];
  ${targetField} = completedResults;
  const values = [];
  const iterator = result[Symbol.iterator]();
  let index = 0;
  try {
    while (true) {
${streamIteratorBreakSource}      const iteration = iterator.next();
      if (iteration.done) {
        break;
      }
      values.push(iteration.value);
      index++;
    }
  } catch (rawError) {
    executor.sharedExecutionContext.asyncWorkTracker.addValues(
      collectIteratorPromises(iterator),
    );
    executor.handleCompletionError(
      rawError,
      returnType,
      fieldDetailsList,
      fieldPath,
      fieldTarget,
      nullTarget,
    );
    return;
  }

  ${completeName}LeafListItems(
    executor,
    runner,
    values,
    completedResults,
    nullTarget,
    0,
  );`;
}

function getVariableValuesFunction(
  variableDefinitionCount: number,
  requiredVariableDefinitions: ReadonlyArray<boolean>,
  variableValuesPlan: VariableValuesPlan | undefined,
): string {
  if (variableDefinitionCount === 0) {
    return '';
  }

  if (variableValuesPlan !== undefined) {
    return getPlannedVariableValuesFunction(variableValuesPlan);
  }

  const variableValuesObjectSource = generatedNullPrototypeObjectSource();

  return `  function getVariableValues(args) {
    const rawVariableValues = args.variableValues ?? EMPTY_VARIABLE_VALUES;
    const maxCoercionErrors = args.options?.maxCoercionErrors ?? 50;
    return getGeneratedVariableValues(rawVariableValues, maxCoercionErrors);
  }

  function getGeneratedVariableValues(inputs, maxErrors) {
    const errors = [];
    const onError = (error) => {
      if (errors.length >= maxErrors) {
        throw new GraphQLError(
          'Too many errors processing variables, error limit reached. Execution aborted.',
        );
      }
      errors.push(error);
    };
    const sources = ${variableValuesObjectSource};
    const coerced = ${variableValuesObjectSource};
    const compiledVariableValues = getCompiledVariableValues();

    try {
${Array.from({ length: variableDefinitionCount }, (_value, index) =>
  generatedVariableValueSource(index, requiredVariableDefinitions[index]),
).join('\n')}
      if (errors.length === 0) {
        return { sources, coerced };
      }
    } catch (error) {
      errors.push(ensureGraphQLError(error));
    }

    return errors;
  }

  function useGeneratedVariableDefaultValue(
    entry,
    coerced,
    onError,
    hideSuggestions,
  ) {
    if (entry.defaultError === undefined) {
      coerced[entry.signature.name] = entry.defaultValue;
      return;
    }

    const defaultInput = entry.signature.default;
    if (defaultInput === undefined) {
      throw entry.defaultError;
    }

    let reportedValidationError = false;
    validateDefaultInput(
      defaultInput,
      entry.signature.type,
      (defaultError, path) => {
        reportedValidationError = true;
        onError(
          new GraphQLError(
            \`Variable "$\${entry.signature.name}" has invalid default value\${printPathArray(
              path,
            )}: \${defaultError.message}\`,
            { nodes: entry.node },
          ),
        );
      },
      hideSuggestions,
    );

    if (!reportedValidationError) {
      onError(
        new GraphQLError(
          \`Variable "$\${entry.signature.name}" has invalid default value: \${entry.defaultError.message}\`,
          { nodes: entry.node },
        ),
      );
    }
  }

  function reportGeneratedInvalidVariableValue(
    entry,
    value,
    onError,
    hideSuggestions,
  ) {
    validateInputValue(
      value,
      entry.signature.type,
      (error, path) => {
        onError(
          new GraphQLError(
            \`Variable "$\${entry.signature.name}" has invalid value\${printPathArray(
              path,
            )}: \${error.message}\`,
            { nodes: entry.node, originalError: error },
          ),
        );
      },
      hideSuggestions,
    );
  }`;
}

function getPlannedVariableValuesFunction(
  variableValuesPlan: VariableValuesPlan,
): string {
  const variableValuesObjectSource = generatedNullPrototypeObjectSource();
  return `  function getVariableValues(args) {
    const inputs = args.variableValues ?? EMPTY_VARIABLE_VALUES;
${generatedProvidedVariableValuesWithoutErrorReportingSource(variableValuesPlan)}
    return getVariableValuesGeneral(args, inputs);
  }

  function getVariableValuesGeneral(args, inputs) {
    validateWithoutErrorReporting: {
      const coerced = ${variableValuesObjectSource};
${variableValuesPlan.variables
  .map((variable) =>
    generatedVariableShortcutValueSource(
      variable,
      'break validateWithoutErrorReporting;',
    ),
  )
  .join('\n')}
      const sources = ${variableValuesObjectSource};
${variableValuesPlan.variables
  .map(generatedVariableSourceValueSource)
  .join('\n')}
      return { sources, coerced };
    }

    const maxErrors = args.options?.maxCoercionErrors ?? 50;
    const errors = [];
    const onError = (error) => {
      if (errors.length >= maxErrors) {
        throw new GraphQLError(
          'Too many errors processing variables, error limit reached. Execution aborted.',
        );
      }
      errors.push(error);
    };
    const coerced = ${variableValuesObjectSource};

    try {
${variableValuesPlan.variables
  .map(generatedVariableValueSourceFromPlan)
  .join('\n')}
      if (errors.length === 0) {
        const sources = ${variableValuesObjectSource};
${variableValuesPlan.variables
  .map(generatedVariableSourceValueSource)
  .join('\n')}
        return { sources, coerced };
      }
    } catch (error) {
      errors.push(ensureGraphQLError(error));
    }

    return errors;
  }

${generatedVariableEntriesFunction(variableValuesPlan)}

  function reportGeneratedInvalidVariableValue(entry, value, onError) {
    validateInputValue(
      value,
      entry.signature.type,
      (error, path) => {
        onError(
          new GraphQLError(
            \`Variable "$\${entry.signature.name}" has invalid value\${printPathArray(
              path,
            )}: \${error.message}\`,
            { nodes: entry.node, originalError: error },
          ),
        );
      },
      staticHideSuggestions,
    );
  }`;
}

function generatedVariableEntriesFunction(
  variableValuesPlan: VariableValuesPlan,
): string {
  const typeDeclarations = variableValuesPlan.variables
    .map((variable) => {
      const typeName = `type${variable.entryIndex}`;
      const namedTypeName = getVariableNamedTypeName(variable);
      const signatureType = variable.required
        ? `new GraphQLNonNull(${typeName})`
        : typeName;
      const builtinCoerceGuard =
        variable.kind === 'builtinScalar'
          ? ` || ${typeName}.coerceInputValue !== GraphQL${variable.scalarName}.coerceInputValue`
          : '';
      const valueCoercer =
        variable.kind === 'compiledCoercer'
          ? `,
      valueCoercer(inputValue) {
        try {
          return ${typeName}.coerceInputValue(inputValue);
        } catch (_error) {
          return undefined;
        }
      }`
          : '';
      return `    const ${typeName} = compiledExecution.schema.getType(${toJavaScript(
        namedTypeName,
      )});
    if (${typeName} == null || ${typeName}.name !== ${toJavaScript(
      namedTypeName,
    )} || typeof ${typeName}.coerceInputValue !== 'function'${builtinCoerceGuard}) {
      return undefined;
    }
    const entry${variable.entryIndex} = {
      node: staticVariableDefinitions[${String(variable.entryIndex)}],
      signature: {
        name: ${toJavaScript(variable.name)},
        type: ${signatureType},
        default:
          staticVariableDefinitions[${String(variable.entryIndex)}]
            .defaultValue === undefined
            ? undefined
            : {
                literal:
                  staticVariableDefinitions[${String(variable.entryIndex)}]
                    .defaultValue,
              },
      }${valueCoercer},
    };`;
    })
    .join('\n');
  const entries = variableValuesPlan.variables
    .map((variable) => `entry${variable.entryIndex}`)
    .join(', ');

  return `  function createGeneratedVariableEntries(compiledExecution) {
${typeDeclarations}
    return [${entries}];
  }`;
}

function getVariableNamedTypeName(variable: VariablePlan): string {
  return variable.typeName;
}

function generatedProvidedVariableValuesWithoutErrorReportingSource(
  variableValuesPlan: VariableValuesPlan,
): string {
  const variables = variableValuesPlan.variables;
  if (!variables.every(isBuiltInScalarVariablePlan)) {
    return '';
  }
  const variableValuesObjectSource = generatedNullPrototypeObjectSource();

  const valueDeclarations = variables
    .map((variable) => {
      const valueName = `providedValue${variable.entryIndex}`;
      return `    let ${valueName};`;
    })
    .join('\n');
  const conditions = variables
    .map((variable) =>
      generatedProvidedVariableValueCondition(
        variable,
        `providedValue${variable.entryIndex}`,
        'inputs',
      ),
    )
    .join(' &&\n      ');
  const coercedAssignments = variables
    .map((variable) => {
      const valueName = `providedValue${variable.entryIndex}`;
      return `      ${generatedObjectAssignmentSource(
        'coerced',
        variable.name,
      )} = ${generatedProvidedVariableCoercedExpression(variable, valueName)};`;
    })
    .join('\n');
  const sourceProperties = variables
    .map((variable) => {
      const valueName = `providedValue${variable.entryIndex}`;
      return `      ${generatedObjectAssignmentSource('sources', variable.name)} = {
                signature: ${generatedVariableSignatureName(variable)},
                value: ${valueName},
              };`;
    })
    .join('\n');

  return `${valueDeclarations}
    if (
      ${conditions}
    ) {
      const coerced = ${variableValuesObjectSource};
${coercedAssignments}
      const sources = ${variableValuesObjectSource};
${sourceProperties}
      return { sources, coerced };
    }
`;
}

function isBuiltInScalarVariablePlan(
  variable: VariablePlan,
): variable is BuiltInScalarVariablePlan {
  return variable.kind === 'builtinScalar';
}

function generatedProvidedVariableValueCondition(
  variable: BuiltInScalarVariablePlan,
  valueName: string,
  inputsName: string,
): string {
  const name = toJavaScript(variable.name);
  const inputValueSource = generatedObjectAssignmentSource(
    inputsName,
    variable.name,
  );
  const providedCondition = `Object.hasOwn(${inputsName}, ${name}) && (${valueName} = ${inputValueSource}) !== undefined`;
  const validCondition = generatedProvidedVariableNonNullCondition(
    variable,
    valueName,
  );
  if (variable.required) {
    return `${providedCondition} && ${valueName} !== null && (${validCondition})`;
  }
  return `${providedCondition} && (${valueName} === null || ${validCondition})`;
}

function generatedProvidedVariableNonNullCondition(
  variable: BuiltInScalarVariablePlan,
  valueName: string,
): string {
  switch (variable.scalarName) {
    case 'Boolean':
      return `typeof ${valueName} === 'boolean'`;
    case 'Float':
      return `typeof ${valueName} === 'number' && Number.isFinite(${valueName})`;
    case 'ID':
      return `typeof ${valueName} === 'string' ||
        (typeof ${valueName} === 'number' && Number.isInteger(${valueName}))`;
    case 'Int':
      return `typeof ${valueName} === 'number' &&
        Number.isInteger(${valueName}) &&
        ${valueName} <= 2147483647 &&
        ${valueName} >= -2147483648`;
    case 'String':
      return `typeof ${valueName} === 'string'`;
  }
}

function generatedProvidedVariableCoercedExpression(
  variable: BuiltInScalarVariablePlan,
  valueName: string,
): string {
  if (variable.scalarName !== 'ID') {
    return valueName;
  }
  return `${valueName} === null ? null : String(${valueName})`;
}

function generatedVariableValueSource(
  index: number,
  isRequired: boolean,
): string {
  const entryName = `entry${index}`;
  const signatureName = `signature${index}`;
  const valueName = `value${index}`;
  const coercedName = `coercedValue${index}`;
  const missingRequiredSource = isRequired
    ? `          } else {
            reportGeneratedInvalidVariableValue(
              ${entryName},
              ${valueName},
              onError,
              compiledVariableValues.hideSuggestions,
            );`
    : '';
  return `      const ${entryName} = compiledVariableValues.entries[${String(index)}];
      if (${entryName}.kind === 'invalid') {
        onError(${entryName}.error);
      } else {
        const ${signatureName} = ${entryName}.signature;
        const ${valueName} = Object.hasOwn(inputs, ${signatureName}.name)
          ? inputs[${signatureName}.name]
          : undefined;
        if (${valueName} === undefined) {
          sources[${signatureName}.name] = { signature: ${signatureName} };
          if (${signatureName}.default !== undefined) {
            useGeneratedVariableDefaultValue(
              ${entryName},
              coerced,
              onError,
              compiledVariableValues.hideSuggestions,
            );
${missingRequiredSource}
          }
        } else {
          sources[${signatureName}.name] = {
            signature: ${signatureName},
            value: ${valueName},
          };
          const ${coercedName} = ${entryName}.valueCoercer(${valueName});
          if (${coercedName} !== undefined) {
            coerced[${signatureName}.name] = ${coercedName};
          } else {
            reportGeneratedInvalidVariableValue(
              ${entryName},
              ${valueName},
              onError,
              compiledVariableValues.hideSuggestions,
            );
          }
        }
      }`;
}

function generatedVariableShortcutValueSource(
  variable: VariablePlan,
  invalidValueStatement = 'return undefined;',
): string {
  const entryName = `generatedVariableEntries[${String(variable.entryIndex)}]`;
  const name = toJavaScript(variable.name);
  const coercedProperty = generatedObjectAssignmentSource(
    'coerced',
    variable.name,
  );
  const inputProperty = generatedObjectAssignmentSource(
    'inputs',
    variable.name,
  );
  const hasValueName = `hasValue${variable.entryIndex}`;
  const valueName = `value${variable.entryIndex}`;
  const missingValueSource =
    variable.defaultValueSource === undefined
      ? variable.required
        ? `      ${invalidValueStatement}`
        : ''
      : `      ${coercedProperty} = ${variable.defaultValueSource};`;
  const nullValueSource = variable.required
    ? `      ${invalidValueStatement}`
    : `      ${coercedProperty} = null;`;

  if (variable.kind === 'compiledCoercer') {
    const coercedValueName = `coercedValue${variable.entryIndex}`;
    return `    const ${hasValueName} = Object.hasOwn(inputs, ${name});
    const ${valueName} = ${hasValueName} ? ${inputProperty} : undefined;
    if (${valueName} === undefined) {
${missingValueSource}
    } else if (${valueName} === null) {
${nullValueSource}
    } else {
      const ${coercedValueName} = ${entryName}.valueCoercer(${valueName});
      if (${coercedValueName} === undefined) {
        ${invalidValueStatement}
      }
      ${coercedProperty} = ${coercedValueName};
    }`;
  }

  return `    const ${hasValueName} = Object.hasOwn(inputs, ${name});
    const ${valueName} = ${hasValueName} ? ${inputProperty} : undefined;
    if (${valueName} === undefined) {
${missingValueSource}
    } else if (${valueName} === null) {
${nullValueSource}
    } else if (${generatedVariableInvalidCondition(variable, valueName)}) {
	      ${invalidValueStatement}
	    } else {
      ${coercedProperty} = ${generatedVariableCoercedExpression(
        variable,
        valueName,
      )};
    }`;
}

function generatedVariableValueSourceFromPlan(variable: VariablePlan): string {
  const entryName = `generatedVariableEntries[${String(variable.entryIndex)}]`;
  const name = toJavaScript(variable.name);
  const coercedProperty = generatedObjectAssignmentSource(
    'coerced',
    variable.name,
  );
  const inputProperty = generatedObjectAssignmentSource(
    'inputs',
    variable.name,
  );
  const hasValueName = `hasValue${variable.entryIndex}`;
  const valueName = `value${variable.entryIndex}`;
  const missingValueSource =
    variable.defaultValueSource === undefined
      ? variable.required
        ? `        reportGeneratedInvalidVariableValue(
          ${entryName},
          ${valueName},
          onError,
        );`
        : ''
      : `        ${coercedProperty} = ${variable.defaultValueSource};`;
  const nullValueSource = variable.required
    ? `        reportGeneratedInvalidVariableValue(
          ${entryName},
          ${valueName},
          onError,
        );`
    : `        ${coercedProperty} = null;`;

  if (variable.kind === 'compiledCoercer') {
    const coercedValueName = `coercedValue${variable.entryIndex}`;
    return `      const ${hasValueName} = Object.hasOwn(inputs, ${name});
      const ${valueName} = ${hasValueName} ? ${inputProperty} : undefined;
      if (${valueName} === undefined) {
${missingValueSource}
      } else if (${valueName} === null) {
${nullValueSource}
      } else {
        const ${coercedValueName} = ${entryName}.valueCoercer(${valueName});
        if (${coercedValueName} === undefined) {
          reportGeneratedInvalidVariableValue(
            ${entryName},
            ${valueName},
            onError,
          );
        } else {
          ${coercedProperty} = ${coercedValueName};
        }
      }`;
  }

  const invalidCondition = generatedVariableInvalidCondition(
    variable,
    valueName,
  );
  return `      const ${hasValueName} = Object.hasOwn(inputs, ${name});
      const ${valueName} = ${hasValueName} ? ${inputProperty} : undefined;
      if (${valueName} === undefined) {
${missingValueSource}
      } else if (${valueName} === null) {
${nullValueSource}
      } else if (${invalidCondition}) {
        reportGeneratedInvalidVariableValue(
          ${entryName},
          ${valueName},
          onError,
        );
      } else {
        ${coercedProperty} = ${generatedVariableCoercedExpression(
          variable,
          valueName,
        )};
      }`;
}

function generatedVariableSourceValueSource(variable: VariablePlan): string {
  const hasValueName = `hasValue${variable.entryIndex}`;
  const valueName = `value${variable.entryIndex}`;
  return `        ${generatedObjectAssignmentSource('sources', variable.name)} =
                ${hasValueName} && ${valueName} !== undefined
                  ? { signature: ${generatedVariableSignatureName(
                    variable,
                  )}, value: ${valueName} }
                  : { signature: ${generatedVariableSignatureName(variable)} };`;
}

function generatedVariableSignatureName(variable: VariablePlan): string {
  return `generatedVariableSignature${variable.entryIndex}`;
}

function generatedVariableInvalidCondition(
  variable: BuiltInScalarVariablePlan,
  valueName: string,
): string {
  switch (variable.scalarName) {
    case 'Boolean':
      return `typeof ${valueName} !== 'boolean'`;
    case 'Float':
      return `typeof ${valueName} !== 'number' || !Number.isFinite(${valueName})`;
    case 'ID':
      return `typeof ${valueName} !== 'string' &&
          (typeof ${valueName} !== 'number' ||
            !Number.isInteger(${valueName}))`;
    case 'Int':
      return `typeof ${valueName} !== 'number' ||
          !Number.isInteger(${valueName}) ||
          ${valueName} > 2147483647 ||
          ${valueName} < -2147483648`;
    case 'String':
      return `typeof ${valueName} !== 'string'`;
  }
}

function generatedVariableCoercedExpression(
  variable: BuiltInScalarVariablePlan,
  valueName: string,
): string {
  return variable.scalarName === 'ID' ? `String(${valueName})` : valueName;
}

function staticDocumentSource(args: CompileExecutionArgs): string {
  const documentSource = args.document.loc?.source.body ?? print(args.document);
  return `const documentSource = ${toJavaScript(documentSource)};
const document = parse(documentSource, ${parseOptions(args)});
const staticExecutionArgs = { document };
${optionalStaticArg('operationName', args.operationName)}
${optionalStaticArg('hideSuggestions', args.hideSuggestions)}
${optionalStaticArg('enableEarlyExecution', args.enableEarlyExecution)}
${optionalStaticArg('enableBatchResolvers', args.enableBatchResolvers)}`;
}

function staticCompiledExecutionSource(
  args: CompileExecutionArgs,
  compiledExecution: Exclude<
    ReturnType<typeof compileExecutionState>,
    ReadonlyArray<GraphQLError>
  >,
): string {
  const operationIndex = args.document.definitions.indexOf(
    compiledExecution.operation,
  );
  const fragmentEntries = Object.entries(
    compiledExecution.fragmentDefinitions,
  ).map(([fragmentName, fragment]) => {
    const fragmentIndex = args.document.definitions.indexOf(fragment);
    invariant(fragmentIndex !== -1);
    return { fragmentIndex, fragmentName };
  });
  invariant(operationIndex !== -1);
  const fragmentDefinitionsSource = generatedNullPrototypeObjectSource();

  return `const staticOperation = document.definitions[${String(operationIndex)}];
const staticVariableDefinitions = staticOperation.variableDefinitions ?? [];
const staticFragmentDefinitions = (() => {
  const definitions = ${fragmentDefinitionsSource};
${fragmentEntries
  .map(
    ({ fragmentIndex, fragmentName }) =>
      `  definitions[${toJavaScript(fragmentName)}] = document.definitions[${String(
        fragmentIndex,
      )}];`,
  )
  .join('\n')}
  return definitions;
})();

function createGeneratedCompiledExecution(args) {
  const executionArgs = {
    ...args,
    ...staticExecutionArgs,
  };
  const hideSuggestions = executionArgs.hideSuggestions ?? false;
  return {
    schema: executionArgs.schema,
    document: executionArgs.document,
    fragmentDefinitions: staticFragmentDefinitions,
    operation: staticOperation,
    variableDefinitions: staticVariableDefinitions,
    hideSuggestions,
    errorPropagation: ${String(compiledExecution.errorPropagation)},
    fieldResolver: executionArgs.fieldResolver,
    typeResolver: executionArgs.typeResolver,
    subscribeFieldResolver: executionArgs.subscribeFieldResolver,
    enableEarlyExecution: executionArgs.enableEarlyExecution === true,
    enableBatchResolvers: executionArgs.enableBatchResolvers === true,
    hooks: executionArgs.hooks ?? undefined,
  };
}`;
}

function parseOptions(args: CompileExecutionArgs): string {
  const options = [
    args.document.loc == null ? 'noLocation: true' : undefined,
    'experimentalFragmentArguments: true',
    'experimentalDirectivesOnDirectiveDefinitions: true',
  ].filter((option): option is string => option !== undefined);

  return `{ ${options.join(', ')} }`;
}

function optionalStaticArg(name: string, value: unknown): string {
  return value === undefined
    ? ''
    : `staticExecutionArgs.${name} = ${toJavaScript(value)};`;
}

function toIdentifierPart(value: string): string {
  return value.replaceAll(/[^0-9A-Z_a-z]/g, '_');
}

type SerializableJavaScriptValue =
  | null
  | string
  | boolean
  | number
  | ReadonlyArray<SerializableJavaScriptValue>
  | { readonly [key: string]: SerializableJavaScriptValue };

type JavaScriptType =
  | 'undefined'
  | 'object'
  | 'boolean'
  | 'number'
  | 'bigint'
  | 'string'
  | 'symbol'
  | 'function';

function toSerializableJavaScript(value: unknown): string | undefined {
  return isSerializableJavaScriptValue(value)
    ? serializableJavaScriptValueSource(value)
    : undefined;
}

function isSerializableJavaScriptValue(
  value: unknown,
  seen = new Set<object>(),
): value is SerializableJavaScriptValue {
  if (value === null) {
    return true;
  }

  const valueType: JavaScriptType = typeof value;
  switch (valueType) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object': {
      const objectValue = value as object;
      if (seen.has(objectValue)) {
        return false;
      }
      seen.add(objectValue);
      if (Array.isArray(value)) {
        const isSerializable = value.every((item) =>
          isSerializableJavaScriptValue(item, seen),
        );
        seen.delete(objectValue);
        return isSerializable;
      }
      const prototype = Object.getPrototypeOf(objectValue);
      if (prototype !== null && prototype !== Object.prototype) {
        seen.delete(objectValue);
        return false;
      }
      for (const item of Object.values(objectValue)) {
        if (item === undefined || !isSerializableJavaScriptValue(item, seen)) {
          seen.delete(objectValue);
          return false;
        }
      }
      seen.delete(objectValue);
      return true;
    }
    case 'undefined':
    case 'bigint':
    case 'function':
    case 'symbol':
      return false;
  }
}

function serializableJavaScriptValueSource(
  value: SerializableJavaScriptValue,
  seen = new Set<object>(),
): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value !== 'object') {
    return toJavaScript(value);
  }

  seen.add(value);
  if (Array.isArray(value)) {
    const items = value.map((item) =>
      serializableJavaScriptValueSource(item, seen),
    );
    seen.delete(value);
    return `[${items.join(', ')}]`;
  }

  const properties = Object.entries(value).map(([key, item]) => ({
    name: key,
    value: serializableJavaScriptValueSource(item, seen),
  }));
  seen.delete(value);
  return generatedNullPrototypeObjectSource(properties);
}

function toJavaScript(value: unknown): string {
  return JSON.stringify(value) ?? 'undefined';
}
