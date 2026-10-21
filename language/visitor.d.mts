/** @category Visiting */
import type { ASTNode } from "./ast.mjs";
import { Kind } from "./kinds.mjs";
/** A visitor defines the callbacks called during AST traversal. */
export type ASTVisitor = EnterLeaveVisitor<ASTNode> | KindVisitor;
type KindVisitor = {
    readonly [NodeT in ASTNode as NodeT['kind']]?: ASTVisitFn<NodeT> | EnterLeaveVisitor<NodeT>;
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
ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>) => any;
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
node: {
    [K in keyof TReducedNode]: ReducedField<TReducedNode[K], R>;
}, 
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
ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>) => R;
type ReducedField<T, R> = T extends ASTNode ? R : T extends ReadonlyArray<ASTNode> ? ReadonlyArray<R> : T;
/** A visitor key map describes the traversable child properties for each node kind. */
export type ASTVisitorKeyMap = {
    [NodeT in ASTNode as NodeT['kind']]?: ReadonlyArray<keyof NodeT>;
};
/** A value that can be returned from a visitor function to stop traversal. */
export declare const BREAK: unknown;
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
export declare function visit<N extends ASTNode>(root: N, visitor: ASTVisitor, visitorKeys?: ASTVisitorKeyMap): N;
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
 * }); // => 'hero { name }'
 * ```
 */
export declare function visit<R>(root: ASTNode, visitor: ASTReducer<R>, visitorKeys?: ASTVisitorKeyMap): R;
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
export declare function visitInParallel(visitors: ReadonlyArray<ASTVisitor>): ASTVisitor;
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
export declare function getEnterLeaveForKind(visitor: ASTVisitor, kind: Kind): EnterLeaveVisitor<ASTNode>;
export {};
