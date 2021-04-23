import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { ASTNode } from '../ast';
import { Kind } from '../kinds';
import {
  isDefinitionNode,
  isExecutableDefinitionNode,
  isSelectionNode,
  isValueNode,
  isTypeNode,
  isTypeSystemDefinitionNode,
  isTypeDefinitionNode,
  isTypeSystemExtensionNode,
  isTypeExtensionNode,
} from '../predicates';

const allASTNodes: Array<ASTNode> = Object.values(Kind).map(
  (kind) => ({ kind }: any),
);

function filterNodes(predicate: (ASTNode) => boolean): Array<string> {
  return allASTNodes.filter(predicate).map(({ kind }) => kind);
}

describe('AST node predicates', () => {
  it('isDefinitionNode', () => {
    expect(filterNodes(isDefinitionNode)).to.deep.equal([
      'OperationDefinition',
      'FragmentDefinition',
      'SchemaDefinition',
      'ScalarTypeDefinition',
      'ObjectTypeDefinition',
      'InterfaceTypeDefinition',
      'UnionTypeDefinition',
      'EnumTypeDefinition',
      'InputObjectTypeDefinition',
      'DirectiveDefinition',
      'SchemaExtension',
      'ScalarTypeExtension',
      'ObjectTypeExtension',
      'InterfaceTypeExtension',
      'UnionTypeExtension',
      'EnumTypeExtension',
      'InputObjectTypeExtension',
    ]);
  });

  it('isExecutableDefinitionNode', () => {
    expect(filterNodes(isExecutableDefinitionNode)).to.deep.equal([
      'OperationDefinition',
      'FragmentDefinition',
    ]);
  });

  it('isSelectionNode', () => {
    expect(filterNodes(isSelectionNode)).to.deep.equal([
      'Field',
      'FragmentSpread',
      'InlineFragment',
    ]);
  });

  it('isValueNode', () => {
    expect(filterNodes(isValueNode)).to.deep.equal([
      'Variable',
      'IntValue',
      'FloatValue',
      'StringValue',
      'BooleanValue',
      'NullValue',
      'EnumValue',
      'ListValue',
      'ObjectValue',
    ]);
  });

  it('isTypeNode', () => {
    expect(filterNodes(isTypeNode)).to.deep.equal([
      'NamedType',
      'ListType',
      'NonNullType',
    ]);
  });

  it('isTypeSystemDefinitionNode', () => {
    expect(filterNodes(isTypeSystemDefinitionNode)).to.deep.equal([
      'SchemaDefinition',
      'ScalarTypeDefinition',
      'ObjectTypeDefinition',
      'InterfaceTypeDefinition',
      'UnionTypeDefinition',
      'EnumTypeDefinition',
      'InputObjectTypeDefinition',
      'DirectiveDefinition',
    ]);
  });

  it('isTypeDefinitionNode', () => {
    expect(filterNodes(isTypeDefinitionNode)).to.deep.equal([
      'ScalarTypeDefinition',
      'ObjectTypeDefinition',
      'InterfaceTypeDefinition',
      'UnionTypeDefinition',
      'EnumTypeDefinition',
      'InputObjectTypeDefinition',
    ]);
  });

  it('isTypeSystemExtensionNode', () => {
    expect(filterNodes(isTypeSystemExtensionNode)).to.deep.equal([
      'SchemaExtension',
      'ScalarTypeExtension',
      'ObjectTypeExtension',
      'InterfaceTypeExtension',
      'UnionTypeExtension',
      'EnumTypeExtension',
      'InputObjectTypeExtension',
    ]);
  });

  it('isTypeExtensionNode', () => {
    expect(filterNodes(isTypeExtensionNode)).to.deep.equal([
      'ScalarTypeExtension',
      'ObjectTypeExtension',
      'InterfaceTypeExtension',
      'UnionTypeExtension',
      'EnumTypeExtension',
      'InputObjectTypeExtension',
    ]);
  });
});
