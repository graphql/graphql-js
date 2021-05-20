import type { Location } from './ast';
import type { Source } from './source';
import type { SourceLocation } from './location';
/**
 * Render a helpful description of the location in the GraphQL Source document.
 */
export function printLocation(location: Location): string;
/**
 * Render a helpful description of the location in the GraphQL Source document.
 */
export function printSourceLocation(
  source: Source,
  sourceLocation: SourceLocation,
): string;
