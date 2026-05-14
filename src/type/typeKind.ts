/* eslint-disable import/no-namespace */
import type * as TypeKind_ from './typeKind_.ts';

/**
 * The set of allowed introspection type kind values.
 */
export * as TypeKind from './typeKind_.ts';

export type TypeKind = (typeof TypeKind_)[keyof typeof TypeKind_];
