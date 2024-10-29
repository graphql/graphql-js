import * as kinds_ from './kinds_.js'; // eslint-disable-line

export * as Kind from './kinds_.js';

/**
 * The set of allowed kind values for AST nodes.
 */
export type Kind = (typeof kinds_)[keyof typeof kinds_];
