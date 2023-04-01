'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getEnterLeaveForKind =
  exports.visitInParallel =
  exports.visit =
  exports.BREAK =
    void 0;
const devAssert_js_1 = require('../jsutils/devAssert.js');
const inspect_js_1 = require('../jsutils/inspect.js');
const ast_js_1 = require('./ast.js');
const kinds_js_1 = require('./kinds.js');
exports.BREAK = Object.freeze({});
function visit(root, visitor, visitorKeys = ast_js_1.QueryDocumentKeys) {
  const enterLeaveMap = new Map();
  for (const kind of Object.values(kinds_js_1.Kind)) {
    enterLeaveMap.set(kind, getEnterLeaveForKind(visitor, kind));
  }
  /* eslint-disable no-undef-init */
  let stack = undefined;
  let inArray = Array.isArray(root);
  let keys = [root];
  let index = -1;
  let edits = [];
  let node = root;
  let key = undefined;
  let parent = undefined;
  const path = [];
  const ancestors = [];
  /* eslint-enable no-undef-init */
  do {
    index++;
    const isLeaving = index === keys.length;
    const isEdited = isLeaving && edits.length !== 0;
    if (isLeaving) {
      key = ancestors.length === 0 ? undefined : path[path.length - 1];
      node = parent;
      parent = ancestors.pop();
      if (isEdited) {
        if (inArray) {
          node = node.slice();
          let editOffset = 0;
          for (const [editKey, editValue] of edits) {
            const arrayKey = editKey - editOffset;
            if (editValue === null) {
              node.splice(arrayKey, 1);
              editOffset++;
            } else {
              node[arrayKey] = editValue;
            }
          }
        } else {
          node = Object.defineProperties(
            {},
            Object.getOwnPropertyDescriptors(node),
          );
          for (const [editKey, editValue] of edits) {
            node[editKey] = editValue;
          }
        }
      }
      index = stack.index;
      keys = stack.keys;
      edits = stack.edits;
      inArray = stack.inArray;
      stack = stack.prev;
    } else if (parent != null) {
      key = inArray ? index : keys[index];
      node = parent[key];
      if (node === null || node === undefined) {
        continue;
      }
      path.push(key);
    }
    let result;
    if (!Array.isArray(node)) {
      (0, ast_js_1.isNode)(node) ||
        (0, devAssert_js_1.devAssert)(
          false,
          `Invalid AST Node: ${(0, inspect_js_1.inspect)(node)}.`,
        );
      const visitFn = isLeaving
        ? enterLeaveMap.get(node.kind)?.leave
        : enterLeaveMap.get(node.kind)?.enter;
      result = visitFn?.call(visitor, node, key, parent, path, ancestors);
      if (result === exports.BREAK) {
        break;
      }
      if (result === false) {
        if (!isLeaving) {
          path.pop();
          continue;
        }
      } else if (result !== undefined) {
        edits.push([key, result]);
        if (!isLeaving) {
          if ((0, ast_js_1.isNode)(result)) {
            node = result;
          } else {
            path.pop();
            continue;
          }
        }
      }
    }
    if (result === undefined && isEdited) {
      edits.push([key, node]);
    }
    if (isLeaving) {
      path.pop();
    } else {
      stack = { inArray, index, keys, edits, prev: stack };
      inArray = Array.isArray(node);
      keys = inArray ? node : visitorKeys[node.kind] ?? [];
      index = -1;
      edits = [];
      if (parent != null) {
        ancestors.push(parent);
      }
      parent = node;
    }
  } while (stack !== undefined);
  if (edits.length !== 0) {
    // New root
    return edits.at(-1)[1];
  }
  return root;
}
exports.visit = visit;
/**
 * Creates a new visitor instance which delegates to many visitors to run in
 * parallel. Each visitor will be visited for each node before moving on.
 *
 * If a prior visitor edits a node, no following visitors will see that node.
 */
function visitInParallel(visitors) {
  const skipping = new Array(visitors.length).fill(null);
  const mergedVisitor = Object.create(null);
  for (const kind of Object.values(kinds_js_1.Kind)) {
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
            } else if (result === exports.BREAK) {
              skipping[i] = exports.BREAK;
            } else if (result !== undefined) {
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
            if (result === exports.BREAK) {
              skipping[i] = exports.BREAK;
            } else if (result !== undefined && result !== false) {
              return result;
            }
          } else if (skipping[i] === node) {
            skipping[i] = null;
          }
        }
      },
    };
    mergedVisitor[kind] = mergedEnterLeave;
  }
  return mergedVisitor;
}
exports.visitInParallel = visitInParallel;
/**
 * Given a visitor instance and a node kind, return EnterLeaveVisitor for that kind.
 */
function getEnterLeaveForKind(visitor, kind) {
  const kindVisitor = visitor[kind];
  if (typeof kindVisitor === 'object') {
    // { Kind: { enter() {}, leave() {} } }
    return kindVisitor;
  } else if (typeof kindVisitor === 'function') {
    // { Kind() {} }
    return { enter: kindVisitor, leave: undefined };
  }
  // { enter() {}, leave() {} }
  return { enter: visitor.enter, leave: visitor.leave };
}
exports.getEnterLeaveForKind = getEnterLeaveForKind;
