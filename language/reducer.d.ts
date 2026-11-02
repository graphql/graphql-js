/** @category Visiting */
import type { ASTNode } from "./ast.js";
/** @internal */
export type ASTReducer<R> = {
    readonly [NodeT in ASTNode as NodeT['kind']]?: (node: {
        [K in keyof NodeT]: ReducedField<NodeT[K], R>;
    }) => R;
};
type ReducedField<T, R> = T extends ASTNode ? R : T extends ReadonlyArray<ASTNode> ? ReadonlyArray<R> : T;
/** @internal */
export declare function reduce<R>(root: ASTNode, reducer: Required<ASTReducer<R>>): R;
/**
 * Reduces children before their parents without changing the input AST.
 * Missing callbacks produce undefined; returned values are not revisited.
 * @param root - The AST node to reduce.
 * @param reducer - Callbacks receiving nodes with their children reduced.
 * @returns The reduced root value, or undefined if it has no callback.
 * @typeParam R - The result produced for each node.
 * @internal
 */
export declare function reduce<R>(root: ASTNode, reducer: ASTReducer<R | undefined>): R | undefined;
export {};
