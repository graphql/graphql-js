/** @category Source */
import type { Location } from "./ast.js";
import type { SourceLocation } from "./location.js";
import type { Source } from "./source.js";
/**
 * Render a helpful description of the location in the GraphQL Source document.
 * @param location - The AST location to print.
 * @returns A formatted source excerpt with line and column information.
 * @example
 * ```ts
 * import { parse, printLocation } from 'graphql/language';
 *
 * const document = parse('type Query { hello: String }');
 * const location = document.definitions[0].loc;
 *
 * if (location) {
 *   const printed = printLocation(location); // => 'GraphQL request:1:1\n1 | type Query { hello: String }\n  | ^'
 * }
 * ```
 */
export declare function printLocation(location: Location): string;
/**
 * Render a helpful description of the location in the GraphQL Source document.
 * @param source - The source document that contains the location.
 * @param sourceLocation - The 1-indexed line and column to print.
 * @returns A formatted source excerpt with line and column information.
 * @example
 * ```ts
 * import { Source, printSourceLocation } from 'graphql/language';
 *
 * const source = new Source('type Query { hello: String }');
 * const printed = printSourceLocation(source, { line: 1, column: 14 }); // => 'GraphQL request:1:14\n1 | type Query { hello: String }\n  |              ^'
 * ```
 */
export declare function printSourceLocation(source: Source, sourceLocation: SourceLocation): string;
