import type { PromiseOrValue } from './jsutils/PromiseOrValue.ts';

import { parse } from './language/parser.ts';

import { validate } from './validation/validate.ts';

import { execute, subscribe } from './execution/execute.ts';

export type GraphQLParseFn = (
  ...args: Parameters<typeof parse>
) => PromiseOrValue<ReturnType<typeof parse>>;

export type GraphQLValidateFn = (
  ...args: Parameters<typeof validate>
) => PromiseOrValue<ReturnType<typeof validate>>;

export type GraphQLExecuteFn = (
  ...args: Parameters<typeof execute>
) => ReturnType<typeof execute>;

export type GraphQLSubscribeFn = (
  ...args: Parameters<typeof subscribe>
) => ReturnType<typeof subscribe>;

export interface GraphQLHarness {
  parse: GraphQLParseFn;
  validate: GraphQLValidateFn;
  execute: GraphQLExecuteFn;
  subscribe: GraphQLSubscribeFn;
}

export const defaultHarness: GraphQLHarness = {
  parse,
  validate,
  execute,
  subscribe,
};
