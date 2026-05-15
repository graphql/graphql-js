/** @category Kinds */

/* eslint-disable import/no-namespace */
import type * as Kind_ from './kinds_.ts';

/** The namespace containing all AST node kind constants. */
export * as Kind from './kinds_.ts';

/** The set of allowed kind values for AST nodes. */
export type Kind = (typeof Kind_)[keyof typeof Kind_];
