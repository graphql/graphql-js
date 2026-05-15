/** @category Legacy Incremental Execution */

import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import type { ExecutionArgs } from '../execute.ts';
import { validateExecutionArgs } from '../execute.ts';
import type { ExecutionResult, ValidatedExecutionArgs } from '../Executor.ts';

import type { LegacyExperimentalIncrementalExecutionResults } from './BranchingIncrementalExecutor.ts';
import { BranchingIncrementalExecutor } from './BranchingIncrementalExecutor.ts';

/**
 * Executes a GraphQL operation with support for `@defer` and `@stream` using
 * the legacy incremental delivery payload format.
 *
 * Prefer `experimentalExecuteIncrementally` for the current incremental
 * delivery format. In the legacy format, each subsequent incremental payload
 * identifies its location with `path` and optional `label` fields. The current
 * format instead tracks pending work by `id` and reports completion through
 * `completed` entries.
 * @param args - Execution arguments for the GraphQL operation.
 * @returns A single execution result or legacy incremental execution results.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { legacyExecuteIncrementally } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     hero: Hero
 *   }
 *
 *   type Hero {
 *     id: ID!
 *     name: String!
 *   }
 * `);
 *
 * const result = await legacyExecuteIncrementally({
 *   schema,
 *   document: parse('{ hero { id ... @defer(label: "HeroName") { name } } }'),
 *   rootValue: { hero: { id: '1', name: 'Luke' } },
 * });
 *
 * assert('initialResult' in result);
 *
 * result.initialResult; // => { data: { hero: { id: '1' } }, hasNext: true }
 *
 * const deferred = await result.subsequentResults.next();
 * deferred.value; // => { incremental: [ { data: { name: 'Luke' }, path: ['hero'], label: 'HeroName' } ], hasNext: false }
 * ```
 * @example
 * Compare the legacy payload format with the current incremental delivery
 * format returned by `experimentalExecuteIncrementally`.
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   experimentalExecuteIncrementally,
 *   legacyExecuteIncrementally,
 * } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     hero: Hero
 *   }
 *
 *   type Hero {
 *     id: ID!
 *     name: String!
 *   }
 * `);
 * const document = parse('{ hero { id ... @defer { name } } }');
 * const rootValue = { hero: { id: '1', name: 'Luke' } };
 *
 * const experimental = await experimentalExecuteIncrementally({
 *   schema,
 *   document,
 *   rootValue,
 * });
 * const legacy = await legacyExecuteIncrementally({
 *   schema,
 *   document,
 *   rootValue,
 * });
 *
 * assert('initialResult' in experimental);
 * assert('initialResult' in legacy);
 *
 * experimental.initialResult; // => { data: { hero: { id: '1' } }, pending: [ { id: '0', path: ['hero'] } ], hasNext: true }
 * legacy.initialResult; // => { data: { hero: { id: '1' } }, hasNext: true }
 *
 * const experimentalDeferred = await experimental.subsequentResults.next();
 * experimentalDeferred.value; // => { incremental: [{ data: { name: 'Luke' }, id: '0' }], completed: [{ id: '0' }], hasNext: false }
 *
 * const legacyDeferred = await legacy.subsequentResults.next();
 * legacyDeferred.value; // => { incremental: [ { data: { name: 'Luke' }, path: ['hero'] } ], hasNext: false }
 * ```
 * @example
 * Compare streamed list payloads in the legacy and current incremental
 * delivery formats.
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   experimentalExecuteIncrementally,
 *   legacyExecuteIncrementally,
 * } from 'graphql/execution';
 *
 * const schema = buildSchema('type Query { colors: [String] }');
 * const document = parse('{ colors @stream(initialCount: 1) }');
 * const rootValue = { colors: ['red', 'green', 'blue'] };
 *
 * const experimental = await experimentalExecuteIncrementally({
 *   schema,
 *   document,
 *   rootValue,
 * });
 * const legacy = await legacyExecuteIncrementally({
 *   schema,
 *   document,
 *   rootValue,
 * });
 *
 * assert('initialResult' in experimental);
 * assert('initialResult' in legacy);
 *
 * experimental.initialResult; // => { data: { colors: ['red'] }, pending: [ { id: '0', path: ['colors'] } ], hasNext: true }
 * legacy.initialResult; // => { data: { colors: ['red'] }, hasNext: true }
 *
 * const experimentalStream = await experimental.subsequentResults.next();
 * experimentalStream.value; // => { incremental: [ { items: ['green', 'blue'], id: '0' } ], completed: [{ id: '0' }], hasNext: false }
 *
 * const legacyStream = await legacy.subsequentResults.next();
 * legacyStream.value; // => { incremental: [ { items: ['green', 'blue'], path: ['colors', 1] } ], hasNext: false }
 * ```
 */
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

/**
 * Executes a validated operation root selection set with support for `@defer`
 * and `@stream` using the legacy incremental delivery payload format.
 * @param validatedExecutionArgs - Validated execution arguments.
 * @returns A single execution result or legacy incremental execution results.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   legacyExecuteRootSelectionSet,
 *   validateExecutionArgs,
 * } from 'graphql/execution';
 *
 * const schema = buildSchema('type Query { greeting: String }');
 * const validatedArgs = validateExecutionArgs({
 *   schema,
 *   document: parse('{ greeting }'),
 *   rootValue: { greeting: 'Hello' },
 * });
 *
 * assert('schema' in validatedArgs);
 *
 * const result = await legacyExecuteRootSelectionSet(validatedArgs);
 * result; // => { data: { greeting: 'Hello' } }
 * ```
 */
export function legacyExecuteRootSelectionSet(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<
  ExecutionResult | LegacyExperimentalIncrementalExecutionResults
> {
  return new BranchingIncrementalExecutor(
    validatedExecutionArgs,
  ).executeRootSelectionSet();
}
