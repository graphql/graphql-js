/* eslint-disable import/no-namespace */
import type * as Kind_ from './kinds_.js';

// Keep the kind literal map available as a type-only import for `ast.ts`.
// This avoids depending on the `Kind` runtime namespace in type positions,
// which Deno's publish type-output validation rejects for this package shape.
export type KindTypeMap = typeof Kind_;
