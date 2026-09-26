import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../../type/definition.ts';

import type {
  CompiledExecutionArgs,
  ValidatedExecutionArgs,
} from '../ExecutionArgs.ts';
import type { VariableValues } from '../values.ts';

import type { CompiledExecutionState } from './compileExecutionState.ts';

/** @internal */
interface ExecutionArgDefaults {
  /** Resolver used when a field does not define its own resolver. */
  fieldResolver: GraphQLFieldResolver<any, any>;
  /** Resolver used when an abstract type does not define its own resolver. */
  typeResolver: GraphQLTypeResolver<any, any>;
  /** Resolver used for the root subscription field. */
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;
}

/** @internal */
export function buildValidatedExecutionArgs(
  compiledExecution: CompiledExecutionState,
  args: CompiledExecutionArgs,
  variableValues: VariableValues,
  defaultResolvers: ExecutionArgDefaults,
): ValidatedExecutionArgs {
  return {
    schema: compiledExecution.schema,
    document: compiledExecution.document,
    fragmentDefinitions: compiledExecution.fragmentDefinitions,
    fragments: compiledExecution.fragments,
    rootValue: args.rootValue,
    contextValue: args.contextValue,
    operation: compiledExecution.operation,
    variableValues,
    rawVariableValues: args.variableValues,
    fieldResolver:
      compiledExecution.fieldResolver ?? defaultResolvers.fieldResolver,
    typeResolver:
      compiledExecution.typeResolver ?? defaultResolvers.typeResolver,
    subscribeFieldResolver:
      compiledExecution.subscribeFieldResolver ??
      defaultResolvers.subscribeFieldResolver,
    hideSuggestions: compiledExecution.hideSuggestions,
    errorPropagation: compiledExecution.errorPropagation,
    externalAbortSignal: args.abortSignal ?? undefined,
    enableEarlyExecution: compiledExecution.enableEarlyExecution,
    enableBatchResolvers: compiledExecution.enableBatchResolvers,
    hooks: compiledExecution.hooks,
    fieldCollectors: compiledExecution,
  };
}
