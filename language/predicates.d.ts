/** @category AST Predicates */
import type { ASTNode, ConstValueNode, DefinitionNode, ExecutableDefinitionNode, OperationDefinitionNode, SchemaCoordinateNode, SelectionNode, SubscriptionOperationDefinitionNode, TypeDefinitionNode, TypeExtensionNode, TypeNode, TypeSystemDefinitionNode, TypeSystemExtensionNode, ValueNode } from "./ast.js";
/**
 * Returns true when the AST node is a definition node.
 * @param node - The AST node to test.
 * @returns True when the AST node is a definition node.
 * @example
 * ```ts
 * import { parse, isDefinitionNode } from 'graphql/language';
 *
 * const document = parse('{ hello }');
 *
 * isDefinitionNode(document.definitions[0]); // => true
 * isDefinitionNode(document); // => false
 * ```
 */
export declare function isDefinitionNode(node: ASTNode): node is DefinitionNode;
/**
 * Returns true when the AST node is an executable definition node.
 * @param node - The AST node to test.
 * @returns True when the AST node is an executable definition node.
 * @example
 * ```ts
 * import { parse, isExecutableDefinitionNode } from 'graphql/language';
 *
 * const query = parse('{ hello }');
 * const schema = parse('type Query { hello: String }');
 *
 * isExecutableDefinitionNode(query.definitions[0]); // => true
 * isExecutableDefinitionNode(schema.definitions[0]); // => false
 * ```
 */
export declare function isExecutableDefinitionNode(node: ASTNode): node is ExecutableDefinitionNode;
/**
 * A type predicate for SubscriptionOperationDefinitionNode.
 * Useful anywhere that must distinguish subscription operations from
 * queries and mutations, such as the subscription execution pipeline
 * which routes events through a different code path.
 * @param node - Operation definition node to test.
 * @returns True when the operation definition is a subscription.
 * @example
 * ```ts
 * import assert from 'node:assert/strict';
 * import {
 *   parse,
 *   isSubscriptionOperationDefinitionNode,
 *   Kind,
 * } from 'graphql/language';
 *
 * const subscription = parse('subscription { greeting }').definitions[0];
 * const query = parse('{ greeting }').definitions[0];
 * assert(subscription.kind === Kind.OPERATION_DEFINITION);
 * assert(query.kind === Kind.OPERATION_DEFINITION);
 *
 * isSubscriptionOperationDefinitionNode(subscription); // => true
 * isSubscriptionOperationDefinitionNode(query); // => false
 * ```
 */
export declare function isSubscriptionOperationDefinitionNode(node: OperationDefinitionNode): node is SubscriptionOperationDefinitionNode;
/**
 * Returns true when the AST node is a selection node.
 * @param node - The AST node to test.
 * @returns True when the AST node is a selection node.
 * @example
 * ```ts
 * import { Kind, isSelectionNode } from 'graphql/language';
 *
 * const field = {
 *   kind: Kind.FIELD,
 *   name: { kind: Kind.NAME, value: 'hello' },
 * } as const;
 * const document = { kind: Kind.DOCUMENT, definitions: [] } as const;
 *
 * isSelectionNode(field); // => true
 * isSelectionNode(document); // => false
 * ```
 */
export declare function isSelectionNode(node: ASTNode): node is SelectionNode;
/**
 * Returns true when the AST node is a value node.
 * @param node - The AST node to test.
 * @returns True when the AST node is a value node.
 * @example
 * ```ts
 * import { parseType, parseValue, isValueNode } from 'graphql/language';
 *
 * const value = parseValue('[42]');
 * const type = parseType('[String!]');
 *
 * isValueNode(value); // => true
 * isValueNode(type); // => false
 * ```
 */
export declare function isValueNode(node: ASTNode): node is ValueNode;
/**
 * Returns true when the AST node is a constant value node.
 * @param node - The AST node to test.
 * @returns True when the AST node is a constant value node.
 * @example
 * ```ts
 * import {
 *   parseConstValue,
 *   parseValue,
 *   isConstValueNode,
 * } from 'graphql/language';
 *
 * const value = parseConstValue('[42]');
 * const variable = parseValue('$id');
 *
 * isConstValueNode(value); // => true
 * isConstValueNode(variable); // => false
 * ```
 */
export declare function isConstValueNode(node: ASTNode): node is ConstValueNode;
/**
 * Returns true when the AST node is a type node.
 * @param node - The AST node to test.
 * @returns True when the AST node is a type node.
 * @example
 * ```ts
 * import { parseType, parseValue, isTypeNode } from 'graphql/language';
 *
 * const type = parseType('[String!]');
 * const value = parseValue('[42]');
 *
 * isTypeNode(type); // => true
 * isTypeNode(value); // => false
 * ```
 */
export declare function isTypeNode(node: ASTNode): node is TypeNode;
/**
 * Returns true when the AST node is a type system definition node.
 * @param node - The AST node to test.
 * @returns True when the AST node is a type system definition node.
 * @example
 * ```ts
 * import { parse, isTypeSystemDefinitionNode } from 'graphql/language';
 *
 * const schema = parse('type Query { hello: String }');
 * const query = parse('{ hello }');
 *
 * isTypeSystemDefinitionNode(schema.definitions[0]); // => true
 * isTypeSystemDefinitionNode(query.definitions[0]); // => false
 * ```
 */
export declare function isTypeSystemDefinitionNode(node: ASTNode): node is TypeSystemDefinitionNode;
/**
 * Returns true when the AST node is a type definition node.
 * @param node - The AST node to test.
 * @returns True when the AST node is a type definition node.
 * @example
 * ```ts
 * import { parse, isTypeDefinitionNode } from 'graphql/language';
 *
 * const typeDefinition = parse('type Query { hello: String }');
 * const directiveDefinition = parse('directive @cache on FIELD');
 *
 * isTypeDefinitionNode(typeDefinition.definitions[0]); // => true
 * isTypeDefinitionNode(directiveDefinition.definitions[0]); // => false
 * ```
 */
export declare function isTypeDefinitionNode(node: ASTNode): node is TypeDefinitionNode;
/**
 * Returns true when the AST node is a type system extension node.
 * @param node - The AST node to test.
 * @returns True when the AST node is a type system extension node.
 * @example
 * ```ts
 * import { parse, isTypeSystemExtensionNode } from 'graphql/language';
 *
 * const extension = parse('extend type Query { hello: String }');
 * const definition = parse('type Query { hello: String }');
 *
 * isTypeSystemExtensionNode(extension.definitions[0]); // => true
 * isTypeSystemExtensionNode(definition.definitions[0]); // => false
 * ```
 */
export declare function isTypeSystemExtensionNode(node: ASTNode): node is TypeSystemExtensionNode;
/**
 * Returns true when the AST node is a type extension node.
 * @param node - The AST node to test.
 * @returns True when the AST node is a type extension node.
 * @example
 * ```ts
 * import { parse, isTypeExtensionNode } from 'graphql/language';
 *
 * const extension = parse('extend type Query { hello: String }');
 * const schemaExtension = parse('extend schema { query: Query }');
 *
 * isTypeExtensionNode(extension.definitions[0]); // => true
 * isTypeExtensionNode(schemaExtension.definitions[0]); // => false
 * ```
 */
export declare function isTypeExtensionNode(node: ASTNode): node is TypeExtensionNode;
/**
 * Returns true when the AST node is a schema coordinate node.
 * @param node - The AST node to test.
 * @returns True when the AST node is a schema coordinate node.
 * @example
 * ```ts
 * import {
 *   parse,
 *   parseSchemaCoordinate,
 *   isSchemaCoordinateNode,
 * } from 'graphql/language';
 *
 * const coordinate = parseSchemaCoordinate('Query.hero');
 * const document = parse('{ hero }');
 *
 * isSchemaCoordinateNode(coordinate); // => true
 * isSchemaCoordinateNode(document); // => false
 * ```
 */
export declare function isSchemaCoordinateNode(node: ASTNode): node is SchemaCoordinateNode;
