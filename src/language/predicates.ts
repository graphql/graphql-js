/** @category AST Predicates */

import type {
  ASTNode,
  ConstValueNode,
  DefinitionNode,
  ExecutableDefinitionNode,
  OperationDefinitionNode,
  SchemaCoordinateNode,
  SelectionNode,
  SubscriptionOperationDefinitionNode,
  TypeDefinitionNode,
  TypeExtensionNode,
  TypeNode,
  TypeSystemDefinitionNode,
  TypeSystemExtensionNode,
  ValueNode,
} from './ast.ts';
import { OperationTypeNode } from './ast.ts';
import { Kind } from './kinds.ts';

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
export function isDefinitionNode(node: ASTNode): node is DefinitionNode {
  return (
    isExecutableDefinitionNode(node) ||
    isTypeSystemDefinitionNode(node) ||
    isTypeSystemExtensionNode(node)
  );
}

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
export function isExecutableDefinitionNode(
  node: ASTNode,
): node is ExecutableDefinitionNode {
  return (
    node.kind === Kind.OPERATION_DEFINITION ||
    node.kind === Kind.FRAGMENT_DEFINITION
  );
}

/**
 * A type predicate for SubscriptionOperationDefinitionNode.
 * Useful anywhere that must distinguish subscription operations from
 * queries and mutations, such as the subscription execution pipeline
 * which routes events through a different code path.
 * @param node - Operation definition node to test.
 * @returns True when the operation definition is a subscription.
 * @example
 * ```ts
 * import { parse, isSubscriptionOperationDefinitionNode } from 'graphql/language';
 *
 * const subscription = parse('subscription { greeting }').definitions[0];
 * const query = parse('{ greeting }').definitions[0];
 *
 * isSubscriptionOperationDefinitionNode(subscription); // => true
 * isSubscriptionOperationDefinitionNode(query); // => false
 * ```
 */
export function isSubscriptionOperationDefinitionNode(
  node: OperationDefinitionNode,
): node is SubscriptionOperationDefinitionNode {
  return node.operation === OperationTypeNode.SUBSCRIPTION;
}

/**
 * Returns true when the AST node is a selection node.
 * @param node - The AST node to test.
 * @returns True when the AST node is a selection node.
 * @example
 * ```ts
 * import { Kind, isSelectionNode } from 'graphql/language';
 *
 * const field = { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'hello' } };
 * const document = { kind: Kind.DOCUMENT, definitions: [] };
 *
 * isSelectionNode(field); // => true
 * isSelectionNode(document); // => false
 * ```
 */
export function isSelectionNode(node: ASTNode): node is SelectionNode {
  return (
    node.kind === Kind.FIELD ||
    node.kind === Kind.FRAGMENT_SPREAD ||
    node.kind === Kind.INLINE_FRAGMENT
  );
}

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
export function isValueNode(node: ASTNode): node is ValueNode {
  return (
    node.kind === Kind.VARIABLE ||
    node.kind === Kind.INT ||
    node.kind === Kind.FLOAT ||
    node.kind === Kind.STRING ||
    node.kind === Kind.BOOLEAN ||
    node.kind === Kind.NULL ||
    node.kind === Kind.ENUM ||
    node.kind === Kind.LIST ||
    node.kind === Kind.OBJECT
  );
}

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
export function isConstValueNode(node: ASTNode): node is ConstValueNode {
  return (
    isValueNode(node) &&
    (node.kind === Kind.LIST
      ? node.values.some(isConstValueNode)
      : node.kind === Kind.OBJECT
        ? node.fields.some((field) => isConstValueNode(field.value))
        : node.kind !== Kind.VARIABLE)
  );
}

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
export function isTypeNode(node: ASTNode): node is TypeNode {
  return (
    node.kind === Kind.NAMED_TYPE ||
    node.kind === Kind.LIST_TYPE ||
    node.kind === Kind.NON_NULL_TYPE
  );
}

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
export function isTypeSystemDefinitionNode(
  node: ASTNode,
): node is TypeSystemDefinitionNode {
  return (
    node.kind === Kind.SCHEMA_DEFINITION ||
    isTypeDefinitionNode(node) ||
    node.kind === Kind.DIRECTIVE_DEFINITION
  );
}

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
export function isTypeDefinitionNode(
  node: ASTNode,
): node is TypeDefinitionNode {
  return (
    node.kind === Kind.SCALAR_TYPE_DEFINITION ||
    node.kind === Kind.OBJECT_TYPE_DEFINITION ||
    node.kind === Kind.INTERFACE_TYPE_DEFINITION ||
    node.kind === Kind.UNION_TYPE_DEFINITION ||
    node.kind === Kind.ENUM_TYPE_DEFINITION ||
    node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
  );
}

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
export function isTypeSystemExtensionNode(
  node: ASTNode,
): node is TypeSystemExtensionNode {
  return (
    node.kind === Kind.SCHEMA_EXTENSION ||
    node.kind === Kind.DIRECTIVE_EXTENSION ||
    isTypeExtensionNode(node)
  );
}

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
export function isTypeExtensionNode(node: ASTNode): node is TypeExtensionNode {
  return (
    node.kind === Kind.SCALAR_TYPE_EXTENSION ||
    node.kind === Kind.OBJECT_TYPE_EXTENSION ||
    node.kind === Kind.INTERFACE_TYPE_EXTENSION ||
    node.kind === Kind.UNION_TYPE_EXTENSION ||
    node.kind === Kind.ENUM_TYPE_EXTENSION ||
    node.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION
  );
}

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
export function isSchemaCoordinateNode(
  node: ASTNode,
): node is SchemaCoordinateNode {
  return (
    node.kind === Kind.TYPE_COORDINATE ||
    node.kind === Kind.MEMBER_COORDINATE ||
    node.kind === Kind.ARGUMENT_COORDINATE ||
    node.kind === Kind.DIRECTIVE_COORDINATE ||
    node.kind === Kind.DIRECTIVE_ARGUMENT_COORDINATE
  );
}
