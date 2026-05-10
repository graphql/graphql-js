import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import type { ExecutionArgs } from '../execute.ts';
import { validateExecutionArgs } from '../execute.ts';
import type { ExecutionResult, ValidatedExecutionArgs } from '../Executor.ts';

import type { LegacyExperimentalIncrementalExecutionResults } from './BranchingIncrementalExecutor.ts';
import { BranchingIncrementalExecutor } from './BranchingIncrementalExecutor.ts';

export function legacyExecuteIncrementally(
  args: ExecutionArgs,
): PromiseOrValue<
  ExecutionResult | LegacyExperimentalIncrementalExecutionResults
> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const validatedExecutionArgs = validateExecutionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  return legacyExecuteRootSelectionSet(validatedExecutionArgs);
}

export function legacyExecuteRootSelectionSet(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<
  ExecutionResult | LegacyExperimentalIncrementalExecutionResults
> {
  return new BranchingIncrementalExecutor(
    validatedExecutionArgs,
  ).executeRootSelectionSet();
}
