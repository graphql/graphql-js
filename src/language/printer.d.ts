import { ASTNode } from './ast';

/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 */
export function print(
  ast: ASTNode,
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  options: { maxIndentDepth?: number },
): string;
export function print(ast: ASTNode): string;
/** @internal */
export function printForError(ast: ASTNode): string;
