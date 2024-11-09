import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { ASTNode } from '../ast.js';
import { Kind } from '../kinds.js';
import { parseValue } from '../parser.js';
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
} from '../predicates.js';

function filterNodes(predicate: (node: ASTNode) => boolean): Array<string> {
  return Object.values(Kind).filter(
    // @ts-expect-error create node only with kind
    (kind) => predicate({ kind }),
  );
}

describe('AST node predicates', () => {
  it('isDefinitionNode', () => {
    expect(filterNodes(isDefinitionNode)).to.deep.equal([
      'DirectiveDefinition',
      'EnumTypeDefinition',
      'EnumTypeExtension',
      'FragmentDefinition',
      'InputObjectTypeDefinition',
      'InputObjectTypeExtension',
      'InterfaceTypeDefinition',
      'InterfaceTypeExtension',
      'ObjectTypeDefinition',
      'ObjectTypeExtension',
      'OperationDefinition',
      'ScalarTypeDefinition',
      'ScalarTypeExtension',
      'SchemaDefinition',
      'SchemaExtension',
      'UnionTypeDefinition',
      'UnionTypeExtension',
    ]);
  });

  it('isExecutableDefinitionNode', () => {
    expect(filterNodes(isExecutableDefinitionNode)).to.deep.equal([
      'FragmentDefinition',
      'OperationDefinition',
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
      'BooleanValue',
      'EnumValue',
      'FloatValue',
      'IntValue',
      'ListValue',
      'NullValue',
      'ObjectValue',
      'StringValue',
      'Variable',
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
      'ListType',
      'NamedType',
      'NonNullType',
    ]);
  });

  it('isTypeSystemDefinitionNode', () => {
    expect(filterNodes(isTypeSystemDefinitionNode)).to.deep.equal([
      'DirectiveDefinition',
      'EnumTypeDefinition',
      'InputObjectTypeDefinition',
      'InterfaceTypeDefinition',
      'ObjectTypeDefinition',
      'ScalarTypeDefinition',
      'SchemaDefinition',
      'UnionTypeDefinition',
    ]);
  });

  it('isTypeDefinitionNode', () => {
    expect(filterNodes(isTypeDefinitionNode)).to.deep.equal([
      'EnumTypeDefinition',
      'InputObjectTypeDefinition',
      'InterfaceTypeDefinition',
      'ObjectTypeDefinition',
      'ScalarTypeDefinition',
      'UnionTypeDefinition',
    ]);
  });

  it('isTypeSystemExtensionNode', () => {
    expect(filterNodes(isTypeSystemExtensionNode)).to.deep.equal([
      'EnumTypeExtension',
      'InputObjectTypeExtension',
      'InterfaceTypeExtension',
      'ObjectTypeExtension',
      'ScalarTypeExtension',
      'SchemaExtension',
      'UnionTypeExtension',
    ]);
  });

  it('isTypeExtensionNode', () => {
    expect(filterNodes(isTypeExtensionNode)).to.deep.equal([
      'EnumTypeExtension',
      'InputObjectTypeExtension',
      'InterfaceTypeExtension',
      'ObjectTypeExtension',
      'ScalarTypeExtension',
      'UnionTypeExtension',
    ]);
  });
});
