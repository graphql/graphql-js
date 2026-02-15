import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.js';

import type { ExecutionArgs } from '../execute.js';
import { validateExecutionArgs } from '../execute.js';
import type { ExecutionResult, ValidatedExecutionArgs } from '../Executor.js';

import type { LegacyExperimentalIncrementalExecutionResults } from './BranchingIncrementalExecutor.js';
import { BranchingIncrementalExecutor } from './BranchingIncrementalExecutor.js';

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

  return legacyExecuteQueryOrMutationOrSubscriptionEvent(
    validatedExecutionArgs,
  );
}

export function legacyExecuteQueryOrMutationOrSubscriptionEvent(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<
  ExecutionResult | LegacyExperimentalIncrementalExecutionResults
> {
  return new BranchingIncrementalExecutor(
    validatedExecutionArgs,
  ).executeQueryOrMutationOrSubscriptionEvent();
}
