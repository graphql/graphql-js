import { inspect } from "../jsutils/inspect.mjs";
import { QueryDocumentKeys } from "./ast.mjs";
export function reduce(root, reducer) {
    const stack = [];
    let frame = {
        parent: [root],
        keys: undefined,
        results: [],
        index: -1,
    };
    let node;
    do {
        let kind;
        frame.index++;
        const length = frame.keys === undefined ? frame.parent.length : frame.keys.length;
        if (frame.index === length) {
            node = frame.results;
            kind = frame.keys === undefined ? undefined : frame.results.kind;
            frame = stack.pop();
        }
        else {
            node =
                frame.keys === undefined
                    ? frame.parent[frame.index]
                    : frame.parent[frame.keys[frame.index]];
            if (node == null && stack.length !== 0) {
                continue;
            }
            if (Array.isArray(node)) {
                if (node.length !== 0) {
                    stack.push(frame);
                    frame = { parent: node, keys: undefined, results: [], index: -1 };
                    continue;
                }
            }
            else {
                const parent = node;
                kind = parent?.kind;
                const keys = typeof kind === 'string' ? QueryDocumentKeys[kind] : undefined;
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
            const reduceNode = reducer[kind];
            node = reduceNode?.(node);
        }
        if (frame.keys === undefined) {
            frame.results.push(node);
        }
        else {
            frame.results[frame.keys[frame.index]] = node;
        }
    } while (stack.length !== 0);
    return node;
}
//# sourceMappingURL=reducer.js.map