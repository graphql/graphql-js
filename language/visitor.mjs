import { devAssert } from "../jsutils/devAssert.mjs";
import { inspect } from "../jsutils/inspect.mjs";
import { isNode, QueryDocumentKeys } from "./ast.mjs";
import { Kind } from "./kinds.mjs";
const allKinds = Object.values(Kind);
export const BREAK = Object.freeze({});
export function visit(root, visitor, visitorKeys = QueryDocumentKeys) {
    const enterLeaveMap = new Map();
    for (const kind of allKinds) {
        enterLeaveMap.set(kind, getEnterLeaveForKind(visitor, kind));
    }
    let stack = undefined;
    let inArray = Array.isArray(root);
    let keys = [root];
    let index = -1;
    let edits;
    let node = root;
    let key = undefined;
    let parent = undefined;
    const path = [];
    const ancestors = [];
    do {
        index++;
        const isLeaving = index === keys.length;
        const isEdited = isLeaving && edits !== undefined;
        if (isLeaving) {
            key = ancestors.length === 0 ? undefined : path[path.length - 1];
            node = parent;
            parent = ancestors.pop();
            if (edits !== undefined) {
                if (inArray) {
                    node = node.slice();
                    let editOffset = 0;
                    for (let editIndex = 0; editIndex < edits.length; editIndex += 2) {
                        const editKey = edits[editIndex];
                        const editValue = edits[editIndex + 1];
                        const arrayKey = editKey - editOffset;
                        if (editValue === null) {
                            node.splice(arrayKey, 1);
                            editOffset++;
                        }
                        else {
                            node[arrayKey] = editValue;
                        }
                    }
                }
                else {
                    node = { ...node };
                    for (let editIndex = 0; editIndex < edits.length; editIndex += 2) {
                        node[edits[editIndex]] = edits[editIndex + 1];
                    }
                }
            }
            index = stack.index;
            keys = stack.keys;
            edits = stack.edits;
            inArray = stack.inArray;
            stack = stack.prev;
        }
        else if (parent != null) {
            key = inArray ? index : keys[index];
            node = parent[key];
            if (node === null || node === undefined) {
                continue;
            }
            path.push(key);
        }
        let result;
        if (!Array.isArray(node)) {
            if (!(isNode(node)))
                devAssert(false, `Invalid AST Node: ${inspect(node)}.`);
            const visitFn = isLeaving
                ? enterLeaveMap.get(node.kind)?.leave
                : enterLeaveMap.get(node.kind)?.enter;
            result = visitFn?.call(visitor, node, key, parent, path, ancestors);
            if (result === BREAK) {
                break;
            }
            if (result === false) {
                if (!isLeaving) {
                    path.pop();
                    continue;
                }
            }
            else if (result !== undefined) {
                (edits ??= []).push(key, result);
                if (!isLeaving) {
                    if (isNode(result)) {
                        node = result;
                    }
                    else {
                        path.pop();
                        continue;
                    }
                }
            }
        }
        if (result === undefined && isEdited) {
            (edits ??= []).push(key, node);
        }
        if (isLeaving) {
            path.pop();
        }
        else {
            stack = { inArray, index, keys, edits, prev: stack };
            inArray = Array.isArray(node);
            keys = inArray ? node : (visitorKeys[node.kind] ?? []);
            index = -1;
            edits = undefined;
            if (parent != null) {
                ancestors.push(parent);
            }
            parent = node;
        }
    } while (stack !== undefined);
    if (edits !== undefined) {
        return edits.at(-1);
    }
    return root;
}
export function visitInParallel(visitors) {
    const skipping = new Array(visitors.length).fill(null);
    const mergedVisitor = Object.create(null);
    for (const kind of allKinds) {
        let hasVisitor = false;
        const enterList = new Array(visitors.length).fill(undefined);
        const leaveList = new Array(visitors.length).fill(undefined);
        for (let i = 0; i < visitors.length; ++i) {
            const { enter, leave } = getEnterLeaveForKind(visitors[i], kind);
            hasVisitor ||= enter != null || leave != null;
            enterList[i] = enter;
            leaveList[i] = leave;
        }
        if (!hasVisitor) {
            continue;
        }
        const mergedEnterLeave = {
            enter(...args) {
                const node = args[0];
                for (let i = 0; i < visitors.length; i++) {
                    if (skipping[i] === null) {
                        const result = enterList[i]?.apply(visitors[i], args);
                        if (result === false) {
                            skipping[i] = node;
                        }
                        else if (result === BREAK) {
                            skipping[i] = BREAK;
                        }
                        else if (result !== undefined) {
                            return result;
                        }
                    }
                }
            },
            leave(...args) {
                const node = args[0];
                for (let i = 0; i < visitors.length; i++) {
                    if (skipping[i] === null) {
                        const result = leaveList[i]?.apply(visitors[i], args);
                        if (result === BREAK) {
                            skipping[i] = BREAK;
                        }
                        else if (result !== undefined && result !== false) {
                            return result;
                        }
                    }
                    else if (skipping[i] === node) {
                        skipping[i] = null;
                    }
                }
            },
        };
        mergedVisitor[kind] = mergedEnterLeave;
    }
    return mergedVisitor;
}
export function getEnterLeaveForKind(visitor, kind) {
    const kindVisitor = visitor[kind];
    if (typeof kindVisitor === 'object') {
        return kindVisitor;
    }
    else if (typeof kindVisitor === 'function') {
        return { enter: kindVisitor, leave: undefined };
    }
    return { enter: visitor.enter, leave: visitor.leave };
}
//# sourceMappingURL=visitor.js.map