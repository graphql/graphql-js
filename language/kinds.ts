/* eslint-disable import/no-namespace */
import type * as Kind_ from './kinds_.ts';
export * as Kind from './kinds_.ts';
export type Kind = (typeof Kind_)[keyof typeof Kind_];
