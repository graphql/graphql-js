/* eslint-disable import/no-namespace */
import type * as DirectiveLocation_ from './directiveLocation_.ts';

/**
 * The set of allowed directive location values.
 */
export * as DirectiveLocation from './directiveLocation_.ts';

export type DirectiveLocation =
  (typeof DirectiveLocation_)[keyof typeof DirectiveLocation_];
