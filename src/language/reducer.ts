/** @category Visiting */

import { inspect } from '../jsutils/inspect';

import type { ASTNode } from './ast';
import { QueryDocumentKeys } from './ast';
import type { Kind } from './kinds';

/** @internal */
export type ASTReducer<R> = {
  readonly [NodeT in ASTNode as NodeT['kind']]?: (node: {
    [K in keyof NodeT]: ReducedField<NodeT[K], R>;
  }) => R;
};

type ReducedField<T, R> = T extends ASTNode
  ? R
  : T extends ReadonlyArray<ASTNode>
  ? ReadonlyArray<R>
  : T;

type Frame =
  | {
      parent: ReadonlyArray<unknown>;
      keys: undefined;
      results: Array<unknown>;
      index: number;
    }
  | {
      parent: ASTNode;
      keys: ReadonlyArray<string>;
      results: { [key: string]: unknown; kind: ASTNode['kind'] };
      index: number;
    };

/** @internal */
export function reduce<R>(root: ASTNode, reducer: Required<ASTReducer<R>>): R;
/**
 * Reduces children before their parents without changing the input AST.
 * Missing callbacks produce undefined; returned values are not revisited.
 * @param root - The AST node to reduce.
 * @param reducer - Callbacks receiving nodes with their children reduced.
 * @returns The reduced root value, or undefined if it has no callback.
 * @typeParam R - The result produced for each node.
 * @internal
 */
export function reduce<R>(
  root: ASTNode,
  reducer: ASTReducer<R | undefined>,
): R | undefined;
/** @internal */
export function reduce<R>(
  root: ASTNode,
  reducer: ASTReducer<R>,
): R | undefined {
  const stack: Array<Frame> = [];
  let frame: Frame = {
    parent: [root],
    keys: undefined,
    results: [],
    index: -1,
  };
  let node: unknown;

  do {
    let kind: Kind | undefined;
    frame.index++;
    const length =
      frame.keys === undefined ? frame.parent.length : frame.keys.length;
    if (frame.index === length) {
      node = frame.results;
      kind = frame.keys === undefined ? undefined : frame.results.kind;
      frame = stack.pop() as Frame;
    } else {
      node =
        frame.keys === undefined
          ? frame.parent[frame.index]
          : frame.parent[frame.keys[frame.index] as keyof ASTNode];
      if (node == null && stack.length !== 0) {
        continue;
      }
      if (Array.isArray(node)) {
        if (node.length !== 0) {
          stack.push(frame);
          frame = { parent: node, keys: undefined, results: [], index: -1 };
          continue;
        }
      } else {
        const parent = node as ASTNode;
        kind = parent?.kind;
        const keys =
          typeof kind === 'string' ? QueryDocumentKeys[kind] : undefined;
        if (!Array.isArray(keys)) {
          throw new Error(`Invalid AST Node: ${inspect(node)}.`);
        }
        if (keys.length !== 0) {
          stack.push(frame);
          frame = { parent, keys, results: { ...parent }, index: -1 };
          continue;
        }
      }
    }
    if (kind !== undefined) {
      const reduceNode = reducer[kind] as ((node: unknown) => R) | undefined;
      node = reduceNode?.(node);
    }
    if (frame.keys === undefined) {
      frame.results.push(node);
    } else {
      frame.results[frame.keys[frame.index]] = node;
    }
  } while (stack.length !== 0);

  return node as R | undefined;
}
