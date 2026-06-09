/** @category Visiting */

import { devAssert } from '../jsutils/devAssert.ts';
import { inspect } from '../jsutils/inspect.ts';

import type { ASTNode } from './ast.ts';
import { isNode, QueryDocumentKeys } from './ast.ts';
import { Kind } from './kinds.ts';

/** A visitor defines the callbacks called during AST traversal. */
export type ASTVisitor = EnterLeaveVisitor<ASTNode> | KindVisitor;

type KindVisitor = {
  readonly [NodeT in ASTNode as NodeT['kind']]?:
    | ASTVisitFn<NodeT>
    | EnterLeaveVisitor<NodeT>;
};

interface EnterLeaveVisitor<TVisitedNode extends ASTNode> {
  readonly enter?: ASTVisitFn<TVisitedNode> | undefined;
  readonly leave?: ASTVisitFn<TVisitedNode> | undefined;
}

/**
 * A visitor is composed of visit functions called for each node during traversal.
 * @typeParam TVisitedNode - AST node type handled by this visitor function.
 */
export type ASTVisitFn<TVisitedNode extends ASTNode> = (
  /** Current node being visited. */
  node: TVisitedNode,
  /** Index or key for this node within the parent node or array. */
  key: string | number | undefined,
  /** Parent immediately above this node, which may be an array. */
  parent: ASTNode | ReadonlyArray<ASTNode> | undefined,
  /** Key path from the root node to this node. */
  path: ReadonlyArray<string | number>,
  /**
   * All nodes and arrays visited before reaching this node's parent.
   * These correspond to array indices in `path`.
   * Note: ancestors includes arrays that contain the visited node's parent.
   */
  ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
) => any;

/**
 * A reducer is composed of reducer functions that convert AST nodes into another form.
 *
 * @internal
 */
export type ASTReducer<R> = {
  readonly [NodeT in ASTNode as NodeT['kind']]?: {
    readonly enter?: ASTVisitFn<NodeT>;
    readonly leave: ASTReducerFn<NodeT, R>;
  };
};

type ASTReducerFn<TReducedNode extends ASTNode, R> = (
  /**
   * Current node being visited.
   * @internal
   */
  node: { [K in keyof TReducedNode]: ReducedField<TReducedNode[K], R> },
  /**
   * Index or key for this node within the parent node or array.
   * @internal
   */
  key: string | number | undefined,
  /**
   * Parent immediately above this node, which may be an array.
   * @internal
   */
  parent: ASTNode | ReadonlyArray<ASTNode> | undefined,
  /**
   * Key path from the root node to this node.
   * @internal
   */
  path: ReadonlyArray<string | number>,
  /**
   * All nodes and arrays visited before reaching this node's parent.
   * These correspond to array indices in `path`.
   * Note: ancestors includes arrays that contain the visited node's parent.
   * @internal
   */
  ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
) => R;

type ReducedField<T, R> = T extends ASTNode
  ? R
  : T extends ReadonlyArray<ASTNode>
    ? ReadonlyArray<R>
    : T;

/** A visitor key map describes the traversable child properties for each node kind. */
export type ASTVisitorKeyMap = {
  [NodeT in ASTNode as NodeT['kind']]?: ReadonlyArray<keyof NodeT>;
};

/** A value that can be returned from a visitor function to stop traversal. */
export const BREAK: unknown = Object.freeze({});

/**
 * visit() will walk through an AST using a depth-first traversal, calling
 * the visitor's enter function at each node in the traversal, and calling the
 * leave function after visiting that node and all of its child nodes.
 *
 * By returning different values from the enter and leave functions, the
 * behavior of the visitor can be altered, including skipping over a sub-tree of
 * the AST (by returning false), editing the AST by returning a value or null
 * to remove the value, or to stop the whole traversal by returning BREAK.
 *
 * When using visit() to edit an AST, the original AST will not be modified, and
 * a new version of the AST with the changes applied will be returned from the
 * visit function.
 * @param root - The AST node at which to start traversal.
 * @param visitor - The visitor or reducer functions to call while traversing.
 * @param visitorKeys - Optional map of child keys to visit for each AST node kind.
 * @returns The original AST, an edited AST, or a reduced value depending on the visitor.
 * @typeParam N - The root AST node type returned when visiting without reducing.
 * @example
 * ```ts
 * // Return values control traversal: undefined makes no change, false skips
 * // a subtree, BREAK stops traversal, null removes a node, and any other
 * // value replaces the current node.
 * import { Kind, parse, print, visit } from 'graphql/language';
 *
 * const document = parse('{ hero { name } }');
 * const editedAST = visit(document, {
 *   Field: (node) => {
 *     if (node.name.value === 'hero') {
 *       return {
 *         ...node,
 *         name: { kind: Kind.NAME, value: 'human' },
 *       };
 *     }
 *   },
 * });
 *
 * print(editedAST); // => '{\n  human {\n    name\n  }\n}'
 * ```
 * @example
 * ```ts
 * // A named visitor function runs when entering nodes of that kind.
 * import { parse, visit } from 'graphql/language';
 *
 * const document = parse('{ hero { name } }');
 * const fieldNames = [];
 *
 * visit(document, {
 *   Field: (node) => {
 *     fieldNames.push(node.name.value);
 *   },
 * });
 *
 * fieldNames; // => ['hero', 'name']
 * ```
 * @example
 * ```ts
 * // A named visitor object can provide separate enter and leave handlers for
 * // nodes of that kind.
 * import { parse, visit } from 'graphql/language';
 *
 * const document = parse('{ hero { name } }');
 * const events = [];
 *
 * visit(document, {
 *   Field: {
 *     enter: (node) => {
 *       events.push(`enter:${node.name.value}`);
 *     },
 *     leave: (node) => {
 *       events.push(`leave:${node.name.value}`);
 *     },
 *   },
 * });
 *
 * events; // => ['enter:hero', 'enter:name', 'leave:name', 'leave:hero']
 * ```
 * @example
 * ```ts
 * // Generic enter and leave handlers run for every node.
 * import { parse, visit } from 'graphql/language';
 *
 * const document = parse('{ hero { name } }');
 * let enterCount = 0;
 * let leaveCount = 0;
 *
 * visit(document, {
 *   enter: (node) => {
 *     enterCount += 1;
 *   },
 *   leave: (node) => {
 *     leaveCount += 1;
 *   },
 * });
 *
 * enterCount; // => leaveCount
 * enterCount > 0; // => true
 * ```
 */
export function visit<N extends ASTNode>(
  root: N,
  visitor: ASTVisitor,
  visitorKeys?: ASTVisitorKeyMap,
): N;
/**
 * Traverses an AST with reducer callbacks and returns the reduced value.
 * @param root - The AST node where traversal starts.
 * @param visitor - Reducer callbacks to invoke during traversal.
 * @param visitorKeys - Optional mapping of child keys for each AST node kind.
 * @returns The value produced by the reducer visitor.
 * @typeParam R - The value produced by reducer visitor callbacks.
 * @example
 * ```ts
 * // A reducer visitor returns values from leave handlers to build a reduced
 * // result instead of returning an edited AST.
 * import { parse, visit } from 'graphql/language';
 *
 * const document = parse('{ hero { name } }');
 * const printed = visit(document, {
 *   Name: {
 *     leave: (node) => {
 *       return node.value;
 *     },
 *   },
 *   Field: {
 *     leave: (node) => {
 *       return node.selectionSet == null
 *         ? node.name
 *         : `${node.name} { ${node.selectionSet} }`;
 *     },
 *   },
 *   SelectionSet: {
 *     leave: (node) => {
 *       return node.selections.join(' ');
 *     },
 *   },
 *   OperationDefinition: {
 *     leave: (node) => {
 *       return node.selectionSet;
 *     },
 *   },
 *   Document: {
 *     leave: (node) => {
 *       return node.definitions.join('\n');
 *     },
 *   },
 * });
 *
 * printed; // => 'hero { name }'
 * ```
 */
export function visit<R>(
  root: ASTNode,
  visitor: ASTReducer<R>,
  visitorKeys?: ASTVisitorKeyMap,
): R;
/**
 * Traverses an AST with visitor or reducer callbacks.
 * @internal
 */
export function visit(
  root: ASTNode,
  visitor: ASTVisitor | ASTReducer<any>,
  visitorKeys: ASTVisitorKeyMap = QueryDocumentKeys,
): any {
  const enterLeaveMap = new Map<Kind, EnterLeaveVisitor<ASTNode>>();
  for (const kind of Object.values(Kind)) {
    enterLeaveMap.set(kind, getEnterLeaveForKind(visitor, kind));
  }

  /* eslint-disable no-undef-init */
  let stack: any = undefined;
  let inArray = Array.isArray(root);
  let keys: any = [root];
  let index = -1;
  let edits = [];
  let node: any = root;
  let key: any = undefined;
  let parent: any = undefined;
  const path: any = [];
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
          node = { ...node };
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
      devAssert(isNode(node), `Invalid AST Node: ${inspect(node)}.`);

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
      } else if (result !== undefined) {
        edits.push([key, result]);
        if (!isLeaving) {
          if (isNode(result)) {
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
      keys = inArray ? node : ((visitorKeys as any)[node.kind] ?? []);
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

/**
 * Creates a new visitor instance which delegates to many visitors to run in
 * parallel. Each visitor will be visited for each node before moving on.
 *
 * If a prior visitor edits a node, no following visitors will see that node.
 * @param visitors - The visitors to merge into one parallel visitor.
 * @returns A visitor that delegates traversal to each provided visitor.
 * @example
 * ```ts
 * import { parse, visit, visitInParallel } from 'graphql/language';
 *
 * const document = parse('{ hero { name } }');
 * const events = [];
 *
 * visit(
 *   document,
 *   visitInParallel([
 *     {
 *       Field: (node) => {
 *         events.push(`field:${node.name.value}`);
 *       },
 *     },
 *     {
 *       Name: (node) => {
 *         events.push(`name:${node.value}`);
 *       },
 *     },
 *   ]),
 * );
 *
 * events; // => ['field:hero', 'name:hero', 'field:name', 'name:name']
 * ```
 */
export function visitInParallel(
  visitors: ReadonlyArray<ASTVisitor>,
): ASTVisitor {
  const skipping = new Array(visitors.length).fill(null);
  const mergedVisitor = Object.create(null);

  for (const kind of Object.values(Kind)) {
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

    const mergedEnterLeave: EnterLeaveVisitor<ASTNode> = {
      enter(...args) {
        const node = args[0];
        for (let i = 0; i < visitors.length; i++) {
          if (skipping[i] === null) {
            const result = enterList[i]?.apply(visitors[i], args);
            if (result === false) {
              skipping[i] = node;
            } else if (result === BREAK) {
              skipping[i] = BREAK;
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
            if (result === BREAK) {
              skipping[i] = BREAK;
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

/**
 * Given a visitor instance and a node kind, return EnterLeaveVisitor for that kind.
 * @param visitor - The visitor object to inspect.
 * @param kind - The AST node kind to resolve handlers for.
 * @returns The enter and leave handlers that apply for the given node kind.
 * @example
 * ```ts
 * import { Kind, getEnterLeaveForKind } from 'graphql/language';
 *
 * const handlers = getEnterLeaveForKind({ Field: () => {} }, Kind.FIELD);
 *
 * typeof handlers.enter; // => 'function'
 * handlers.leave; // => undefined
 * ```
 */
export function getEnterLeaveForKind(
  visitor: ASTVisitor,
  kind: Kind,
): EnterLeaveVisitor<ASTNode> {
  const kindVisitor:
    | ASTVisitFn<ASTNode>
    | EnterLeaveVisitor<ASTNode>
    | undefined = (visitor as any)[kind];

  if (typeof kindVisitor === 'object') {
    // { Kind: { enter() {}, leave() {} } }
    return kindVisitor;
  } else if (typeof kindVisitor === 'function') {
    // { Kind() {} }
    return { enter: kindVisitor, leave: undefined };
  }

  // { enter() {}, leave() {} }
  return { enter: (visitor as any).enter, leave: (visitor as any).leave };
}
