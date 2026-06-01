/**
 * Execute GraphQL operations and produce GraphQL execution results.
 *
 * These exports are also available from the root `graphql` package.
 * @packageDocumentation
 */

export { pathToArray as responsePathAsArray } from '../jsutils/Path.ts';

export {
  createSourceEventStream,
  execute,
  executeRootSelectionSet,
  executeSubscriptionEvent,
  executeSync,
  experimentalExecuteIncrementally,
  experimentalExecuteRootSelectionSet,
  defaultFieldResolver,
  defaultTypeResolver,
  mapSourceToResponseEvent,
  subscribe,
  validateExecutionArgs,
  validateSubscriptionArgs,
} from './execute.ts';
export {
  legacyExecuteIncrementally,
  legacyExecuteRootSelectionSet,
} from './legacyIncremental/legacyExecuteIncrementally.ts';
export type {
  AsyncWorkFinishedInfo,
  ExecutionArgs,
  ExecutionHooks,
  ValidatedExecutionArgs,
  ValidatedSubscriptionArgs,
} from './ExecutionArgs.ts';
export type { RootSelectionSetExecutor } from './execute.ts';

export type { ExecutionResult, FormattedExecutionResult } from './Executor.ts';

export type {
  ExperimentalIncrementalExecutionResults,
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
  IncrementalDeferResult,
  IncrementalStreamResult,
  IncrementalResult,
  FormattedExperimentalIncrementalExecutionResults,
  FormattedInitialIncrementalExecutionResult,
  FormattedSubsequentIncrementalExecutionResult,
  FormattedIncrementalDeferResult,
  FormattedIncrementalStreamResult,
  FormattedIncrementalResult,
} from './incremental/IncrementalExecutor.ts';

export type {
  LegacyExperimentalIncrementalExecutionResults,
  LegacyInitialIncrementalExecutionResult,
  LegacySubsequentIncrementalExecutionResult,
  LegacyIncrementalDeferResult,
  LegacyIncrementalStreamResult,
  LegacyIncrementalResult,
  FormattedLegacyExperimentalIncrementalExecutionResults,
  FormattedLegacyInitialIncrementalExecutionResult,
  FormattedLegacySubsequentIncrementalExecutionResult,
  FormattedLegacyIncrementalDeferResult,
  FormattedLegacyIncrementalStreamResult,
  FormattedLegacyIncrementalResult,
} from './legacyIncremental/BranchingIncrementalExecutor.ts';

export { AbortedGraphQLExecutionError } from './AbortedGraphQLExecutionError.ts';

export {
  getArgumentValues,
  getVariableValues,
  getDirectiveValues,
} from './values.ts';
export type { VariableValues } from './values.ts';
