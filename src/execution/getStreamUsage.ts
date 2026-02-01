import { invariant } from '../jsutils/invariant.js';

import { OperationTypeNode } from '../language/ast.js';

import { GraphQLStreamDirective } from '../type/directives.js';

import type { FieldDetailsList } from './collectFields.js';
import type { ValidatedExecutionArgs } from './Executor.js';
import { getDirectiveValues } from './values.js';

export interface StreamUsage {
  label: string | undefined;
  initialCount: number;
  fieldDetailsList: FieldDetailsList;
}

/**
 * Returns an object containing info for streaming if a field should be
 * streamed based on the experimental flag, stream directive present and
 * not disabled by the "if" argument.
 */
export function getStreamUsage(
  validatedExecutionArgs: ValidatedExecutionArgs,
  fieldDetailsList: FieldDetailsList,
): StreamUsage | undefined {
  const { operation, variableValues } = validatedExecutionArgs;
  // validation only allows equivalent streams on multiple fields, so it is
  // safe to only check the first fieldNode for the stream directive
  const stream = getDirectiveValues(
    GraphQLStreamDirective,
    fieldDetailsList[0].node,
    variableValues,
    fieldDetailsList[0].fragmentVariableValues,
  );

  if (!stream) {
    return;
  }

  if (stream.if === false) {
    return;
  }

  invariant(
    typeof stream.initialCount === 'number',
    'initialCount must be a number',
  );

  invariant(
    stream.initialCount >= 0,
    'initialCount must be a positive integer',
  );

  invariant(
    operation.operation !== OperationTypeNode.SUBSCRIPTION,
    '`@stream` directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
  );

  const streamedFieldDetailsList: FieldDetailsList = fieldDetailsList.map(
    (fieldDetails) => ({
      node: fieldDetails.node,
      deferUsage: undefined,
      fragmentVariableValues: fieldDetails.fragmentVariableValues,
    }),
  );

  return {
    initialCount: stream.initialCount,
    label: typeof stream.label === 'string' ? stream.label : undefined,
    fieldDetailsList: streamedFieldDetailsList,
  };
}
