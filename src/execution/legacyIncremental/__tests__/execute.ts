import type { PromiseOrValue } from '../../../jsutils/PromiseOrValue.ts';

import type { ExecutionArgs } from '../../execute.ts';
import type { ExecutionResult } from '../../Executor.ts';

import type {
  LegacyExperimentalIncrementalExecutionResults,
  LegacyInitialIncrementalExecutionResult,
  LegacySubsequentIncrementalExecutionResult,
} from '../BranchingIncrementalExecutor.ts';
import { legacyExecuteIncrementally } from '../legacyExecuteIncrementally.ts';

type IncrementalExecutionResult =
  | ExecutionResult
  | LegacyExperimentalIncrementalExecutionResults;

export type IncrementalExecutionPayload =
  | LegacyInitialIncrementalExecutionResult
  | LegacySubsequentIncrementalExecutionResult;

export function execute(
  args: ExecutionArgs,
): PromiseOrValue<IncrementalExecutionResult> {
  return legacyExecuteIncrementally(args);
}

export async function complete(
  args: ExecutionArgs,
): Promise<ExecutionResult | ReadonlyArray<IncrementalExecutionPayload>> {
  return collectIncrementalResults(await execute(args));
}

async function collectIncrementalResults(
  result: IncrementalExecutionResult,
): Promise<ExecutionResult | ReadonlyArray<IncrementalExecutionPayload>> {
  if (!isIncrementalExecutionResult(result)) {
    return result;
  }

  const results: Array<IncrementalExecutionPayload> = [result.initialResult];
  for await (const patch of result.subsequentResults) {
    results.push(patch);
  }
  return results;
}

function isIncrementalExecutionResult(
  result: IncrementalExecutionResult,
): result is LegacyExperimentalIncrementalExecutionResults {
  return 'initialResult' in result;
}
