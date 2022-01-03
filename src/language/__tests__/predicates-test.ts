import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { ASTNode } from '../ast';
import { Kind } from '../kinds';
import { parseValue } from '../parser';
import {
  isConstValueNode,
  isDefinitionNode,
  isExecutableDefinitionNode,
  isSelectionNode,
  isTypeDefinitionNode,
  isTypeExtensionNode,
  isTypeNode,
  isTypeSystemDefinitionNode,
  isTypeSystemExtensionNode,
  isValueNode,
} from '../predicates';

function filterNodes(predicate: (node: ASTNode) => boolean): Array<string> {
  return Object.values(Kind).filter(
    // @ts-expect-error create node only with kind
    (kind) => predicate({ kind }),
  );
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

  it('isConstValueNode', () => {
    expect(isConstValueNode(parseValue('"value"'))).to.equal(true);
    expect(isConstValueNode(parseValue('$var'))).to.equal(false);

    expect(isConstValueNode(parseValue('{ field: "value" }'))).to.equal(true);
    expect(isConstValueNode(parseValue('{ field: $var }'))).to.equal(false);

    expect(isConstValueNode(parseValue('[ "value" ]'))).to.equal(true);
    expect(isConstValueNode(parseValue('[ $var ]'))).to.equal(false);
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
