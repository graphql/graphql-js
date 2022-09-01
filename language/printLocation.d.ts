import type { Location } from './ast.js';
import type { SourceLocation } from './location.js';
import type { Source } from './source.js';
/**
 * Render a helpful description of the location in the GraphQL Source document.
 */
export declare function printLocation(location: Location): string;
/**
 * Render a helpful description of the location in the GraphQL Source document.
 */
export declare function printSourceLocation(
  source: Source,
  sourceLocation: SourceLocation,
): string;
