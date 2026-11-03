import inspect from '../jsutils/inspect';

import type { ASTNode } from './ast';
import { QueryDocumentKeys } from './visitor';

// Internal reduction frames hold either an AST node or an array of its children.
type Frame = {
  parent: any,
  keys: ?$ReadOnlyArray<string>,
  results: any,
  index: number,
  ...
};

/**
 * Reduces children before their parents without changing the input AST.
 * Returned values are not revisited.
 * @internal
 */
export function reduce(
  root: ASTNode,
  reducer: { [key: string]: ?(node: any, key: string | number) => any, ... },
): any {
  const stack: Array<Frame> = [];
  let frame: Frame = {
    parent: [root],
    keys: undefined,
    results: [],
    index: -1,
  };
  let node;
  do {
    let kind;
    frame.index++;
    const keys = frame.keys;
    const length = keys == null ? frame.parent.length : keys.length;
    if (frame.index === length) {
      node = frame.results;
      kind = keys == null ? undefined : node.kind;
      frame = stack.pop();
    } else {
      node =
        keys == null
          ? frame.parent[frame.index]
          : frame.parent[keys[frame.index]];
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
        const parent = node;
        kind = parent?.kind;
        const childKeys =
          typeof kind === 'string' ? QueryDocumentKeys[kind] : undefined;
        if (!Array.isArray(childKeys)) {
          throw new Error(`Invalid AST Node: ${inspect(node)}.`);
        }
        if (childKeys.length !== 0) {
          stack.push(frame);
          frame = {
            parent,
            keys: childKeys,
            results: { ...parent },
            index: -1,
          };
          continue;
        }
      }
    }
    if (kind !== undefined) {
      node = reducer[kind]?.(
        node,
        frame.keys == null ? frame.index : frame.keys[frame.index],
      );
    }
    if (frame.keys == null) {
      frame.results.push(node);
    } else {
      frame.results[frame.keys[frame.index]] = node;
    }
  } while (stack.length !== 0);
  return node;
}
