/** @category Printing */
import type { ASTNode } from "./ast.mjs";
/**
 * Prints an AST with indentation and inserted newlines disabled at the given depth.
 * @param ast - The GraphQL AST node to print.
 * @param options - Output configuration.
 * @param options.maxIndentDepth - Maximum indentation depth. Defaults to `Infinity`.
 * @returns A string representation of the AST.
 * @example
 * ```ts
 * import { parse, print } from 'graphql/language';
 *
 * print(parse('{ a { b } }'), { maxIndentDepth: 0 }); // => '{ a { b } }'
 * ```
 */
export declare function print(ast: ASTNode, options: {
    maxIndentDepth?: number;
}): string;
/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 * @param ast - The GraphQL AST node to print.
 * @returns A stable string representation of the AST.
 * @example
 * ```ts
 * import { parse, print } from 'graphql';
 *
 * const ast = parse('{ hero { name } }');
 * const text = print(ast); // => '{\n  hero {\n    name\n  }\n}'
 * ```
 */
export declare function print(ast: ASTNode): string;
/** @internal */
export declare function printForError(ast: ASTNode): string;
