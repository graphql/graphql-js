import type {
  ASTNode,
  DefinitionNode,
  ExecutableDefinitionNode,
  SelectionNode,
  ValueNode,
  TypeNode,
  TypeSystemDefinitionNode,
  TypeDefinitionNode,
  TypeSystemExtensionNode,
  TypeExtensionNode,
} from './ast';
import { Kind } from './kinds';

export function isDefinitionNode(node: ASTNode): node is DefinitionNode {
  return (
    isExecutableDefinitionNode(node) ||
    isTypeSystemDefinitionNode(node) ||
    isTypeSystemExtensionNode(node)
  );
}

export function isExecutableDefinitionNode(
  node: ASTNode,
): node is ExecutableDefinitionNode {
  return (
    node.kind === Kind.OPERATION_DEFINITION ||
    node.kind === Kind.FRAGMENT_DEFINITION
  );
}

export function isSelectionNode(node: ASTNode): node is SelectionNode {
  return (
    node.kind === Kind.FIELD ||
    node.kind === Kind.FRAGMENT_SPREAD ||
    node.kind === Kind.INLINE_FRAGMENT
  );
}

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

export function isTypeNode(node: ASTNode): node is TypeNode {
  return (
    node.kind === Kind.NAMED_TYPE ||
    node.kind === Kind.LIST_TYPE ||
    node.kind === Kind.NON_NULL_TYPE
  );
}

export function isTypeSystemDefinitionNode(
  node: ASTNode,
): node is TypeSystemDefinitionNode {
  return (
    node.kind === Kind.SCHEMA_DEFINITION ||
    isTypeDefinitionNode(node) ||
    node.kind === Kind.DIRECTIVE_DEFINITION
  );
}

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

export function isTypeSystemExtensionNode(
  node: ASTNode,
): node is TypeSystemExtensionNode {
  return node.kind === Kind.SCHEMA_EXTENSION || isTypeExtensionNode(node);
}

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
