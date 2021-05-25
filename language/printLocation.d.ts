import type { Source } from './source';
import type { Location } from './ast';
import type { SourceLocation } from './location';
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
