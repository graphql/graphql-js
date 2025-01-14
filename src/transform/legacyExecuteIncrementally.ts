import { isPromise } from '../jsutils/isPromise.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

import { collectSubfields as _collectSubfields } from '../execution/collectFields.js';
import type { ExecutionArgs } from '../execution/execute.js';
import {
  experimentalExecuteQueryOrMutationOrSubscriptionEvent,
  validateExecutionArgs,
} from '../execution/execute.js';
import type { ExecutionResult } from '../execution/types.js';

import { buildTransformationContext } from './buildTransformationContext.js';
import type { LegacyExperimentalIncrementalExecutionResults } from './transformResult.js';
import { transformResult } from './transformResult.js';

export function legacyExecuteIncrementally(
  args: ExecutionArgs,
  prefix = '__legacyExecuteIncrementally__',
): PromiseOrValue<
  ExecutionResult | LegacyExperimentalIncrementalExecutionResults
> {
  const originalArgs = validateExecutionArgs(args);

  if (!('schema' in originalArgs)) {
    return { errors: originalArgs };
  }

  const context = buildTransformationContext(originalArgs, prefix);

  const originalResult = experimentalExecuteQueryOrMutationOrSubscriptionEvent(
    context.transformedArgs,
  );

  return isPromise(originalResult)
    ? originalResult.then((resolved) => transformResult(context, resolved))
    : transformResult(context, originalResult);
}
