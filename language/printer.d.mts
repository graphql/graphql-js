/** @category Printing */
import type { ASTNode } from "./ast.mjs";
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
