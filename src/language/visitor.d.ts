import { Maybe } from '../jsutils/Maybe';

import {
  ASTNode,
  NameNode,
  DocumentNode,
  OperationDefinitionNode,
  VariableDefinitionNode,
  VariableNode,
  SelectionSetNode,
  FieldNode,
  ArgumentNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
  IntValueNode,
  FloatValueNode,
  StringValueNode,
  BooleanValueNode,
  NullValueNode,
  EnumValueNode,
  ListValueNode,
  ObjectValueNode,
  ObjectFieldNode,
  DirectiveNode,
  NamedTypeNode,
  ListTypeNode,
  NonNullTypeNode,
  SchemaDefinitionNode,
  OperationTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  InputObjectTypeDefinitionNode,
  DirectiveDefinitionNode,
  SchemaExtensionNode,
  ScalarTypeExtensionNode,
  ObjectTypeExtensionNode,
  InterfaceTypeExtensionNode,
  UnionTypeExtensionNode,
  EnumTypeExtensionNode,
  InputObjectTypeExtensionNode,
} from './ast';

/**
 * A visitor is provided to visit, it contains the collection of
 * relevant functions to be called during the visitor's traversal.
 */
export type ASTVisitor = Readonly<{
  enter?: ASTVisitFn<ASTNode>;
  leave?: ASTVisitFn<ASTNode>;

  Name?: KindVisitor<NameNode>;
  Document?: KindVisitor<DocumentNode>;
  OperationDefinition?: KindVisitor<OperationDefinitionNode>;
  VariableDefinition?: KindVisitor<VariableDefinitionNode>;
  Variable?: KindVisitor<VariableNode>;
  SelectionSet?: KindVisitor<SelectionSetNode>;
  Field?: KindVisitor<FieldNode>;
  Argument?: KindVisitor<ArgumentNode>;
  FragmentSpread?: KindVisitor<FragmentSpreadNode>;
  InlineFragment?: KindVisitor<InlineFragmentNode>;
  FragmentDefinition?: KindVisitor<FragmentDefinitionNode>;
  IntValue?: KindVisitor<IntValueNode>;
  FloatValue?: KindVisitor<FloatValueNode>;
  StringValue?: KindVisitor<StringValueNode>;
  BooleanValue?: KindVisitor<BooleanValueNode>;
  NullValue?: KindVisitor<NullValueNode>;
  EnumValue?: KindVisitor<EnumValueNode>;
  ListValue?: KindVisitor<ListValueNode>;
  ObjectValue?: KindVisitor<ObjectValueNode>;
  ObjectField?: KindVisitor<ObjectFieldNode>;
  Directive?: KindVisitor<DirectiveNode>;
  NamedType?: KindVisitor<NamedTypeNode>;
  ListType?: KindVisitor<ListTypeNode>;
  NonNullType?: KindVisitor<NonNullTypeNode>;
  SchemaDefinition?: KindVisitor<SchemaDefinitionNode>;
  OperationTypeDefinition?: KindVisitor<OperationTypeDefinitionNode>;
  ScalarTypeDefinition?: KindVisitor<ScalarTypeDefinitionNode>;
  ObjectTypeDefinition?: KindVisitor<ObjectTypeDefinitionNode>;
  FieldDefinition?: KindVisitor<FieldDefinitionNode>;
  InputValueDefinition?: KindVisitor<InputValueDefinitionNode>;
  InterfaceTypeDefinition?: KindVisitor<InterfaceTypeDefinitionNode>;
  UnionTypeDefinition?: KindVisitor<UnionTypeDefinitionNode>;
  EnumTypeDefinition?: KindVisitor<EnumTypeDefinitionNode>;
  EnumValueDefinition?: KindVisitor<EnumValueDefinitionNode>;
  InputObjectTypeDefinition?: KindVisitor<InputObjectTypeDefinitionNode>;
  DirectiveDefinition?: KindVisitor<DirectiveDefinitionNode>;
  SchemaExtension?: KindVisitor<SchemaExtensionNode>;
  ScalarTypeExtension?: KindVisitor<ScalarTypeExtensionNode>;
  ObjectTypeExtension?: KindVisitor<ObjectTypeExtensionNode>;
  InterfaceTypeExtension?: KindVisitor<InterfaceTypeExtensionNode>;
  UnionTypeExtension?: KindVisitor<UnionTypeExtensionNode>;
  EnumTypeExtension?: KindVisitor<EnumTypeExtensionNode>;
  InputObjectTypeExtension?: KindVisitor<InputObjectTypeExtensionNode>;
}>;

type KindVisitor<T extends ASTNode> =
  | ASTVisitFn<T>
  | { readonly enter?: ASTVisitFn<T>; readonly leave?: ASTVisitFn<T> };

/**
 * A visitor is comprised of visit functions, which are called on each node
 * during the visitor's traversal.
 */
export type ASTVisitFn<TVisitedNode extends ASTNode> = (
  /** The current node being visiting. */
  node: TVisitedNode,
  /** The index or key to this node from the parent node or Array. */
  key: string | number | undefined,
  /** The parent immediately above this node, which may be an Array. */
  parent: ASTNode | ReadonlyArray<ASTNode> | undefined,
  /** The key path to get to this node from the root node. */
  path: ReadonlyArray<string | number>,
  /**
   * All nodes and Arrays visited before reaching parent of this node.
   * These correspond to array indices in `path`.
   * Note: ancestors includes arrays which contain the parent of visited node.
   */
  ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
) => any;

export const BREAK: any;

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
 *
 *     const editedAST = visit(ast, {
 *       enter(node, key, parent, path, ancestors) {
 *         // @return
 *         //   undefined: no action
 *         //   false: skip visiting this node
 *         //   visitor.BREAK: stop visiting altogether
 *         //   null: delete this node
 *         //   any value: replace this node with the returned value
 *       },
 *       leave(node, key, parent, path, ancestors) {
 *         // @return
 *         //   undefined: no action
 *         //   false: no action
 *         //   visitor.BREAK: stop visiting altogether
 *         //   null: delete this node
 *         //   any value: replace this node with the returned value
 *       }
 *     });
 *
 * Alternatively to providing enter() and leave() functions, a visitor can
 * instead provide functions named the same as the kinds of AST nodes, or
 * enter/leave visitors at a named key, leading to three permutations of the
 * visitor API:
 *
 * 1) Named visitors triggered when entering a node of a specific kind.
 *
 *     visit(ast, {
 *       Kind(node) {
 *         // enter the "Kind" node
 *       }
 *     })
 *
 * 2) Named visitors that trigger upon entering and leaving a node of
 *    a specific kind.
 *
 *     visit(ast, {
 *       Kind: {
 *         enter(node) {
 *           // enter the "Kind" node
 *         }
 *         leave(node) {
 *           // leave the "Kind" node
 *         }
 *       }
 *     })
 *
 * 3) Generic visitors that trigger upon entering and leaving any node.
 *
 *     visit(ast, {
 *       enter(node) {
 *         // enter any node
 *       },
 *       leave(node) {
 *         // leave any node
 *       }
 *     })
 */
export function visit(root: ASTNode, visitor: ASTVisitor): any;

/**
 * Creates a new visitor instance which delegates to many visitors to run in
 * parallel. Each visitor will be visited for each node before moving on.
 *
 * If a prior visitor edits a node, no following visitors will see that node.
 */
export function visitInParallel(
  visitors: ReadonlyArray<ASTVisitor>,
): ASTVisitor;

/**
 * Given a visitor instance, if it is leaving or not, and a node kind, return
 * the function the visitor runtime should call.
 */
export function getVisitFn(
  visitor: ASTVisitor,
  kind: string,
  isLeaving: boolean,
): Maybe<ASTVisitFn<ASTNode>>;
