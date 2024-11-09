/* eslint-disable import/no-namespace */
import type * as Kind_ from './kinds_.js';

export * as Kind from './kinds_.js';

export type Kind = (typeof Kind_)[keyof typeof Kind_];
