/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parse } from '../parser';
import { print } from '../printer';
import { readFileSync } from 'fs';
import { visit, visitInParallel, visitWithTypeInfo, BREAK } from '../visitor';
import { join } from 'path';
import { TypeInfo } from '../../utilities/TypeInfo';
import { testSchema } from '../../validation/__tests__/harness';
import { getNamedType, isCompositeType } from '../../type';


describe('Visitor', () => {

  it('allows editing a node both on enter and on leave', () => {

    const ast = parse('{ a, b, c { a, b, c } }', { noLocation: true });

    let selectionSet;

    const editedAst = visit(ast, {
      OperationDefinition: {
        enter(node) {
          selectionSet = node.selectionSet;
          return {
            ...node,
            selectionSet: {
              kind: 'SelectionSet',
              selections: []
            },
            didEnter: true,
          };
        },
        leave(node) {
          return {
            ...node,
            selectionSet,
            didLeave: true,
          };
        }
      }
    });

    expect(editedAst).to.deep.equal({
      ...ast,
      definitions: [
        {
          ...ast.definitions[0],
          didEnter: true,
          didLeave: true
        }
      ]
    });
  });

  it('allows editing the root node on enter and on leave', () => {

    const ast = parse('{ a, b, c { a, b, c } }', { noLocation: true });

    const { definitions } = ast;

    const editedAst = visit(ast, {
      Document: {
        enter(node) {
          return {
            ...node,
            definitions: [],
            didEnter: true,
          };
        },
        leave(node) {
          return {
            ...node,
            definitions,
            didLeave: true,
          };
        }
      }
    });

    expect(editedAst).to.deep.equal({
      ...ast,
      didEnter: true,
      didLeave: true
    });
  });

  it('allows for editing on enter', () => {

    const ast = parse('{ a, b, c { a, b, c } }', { noLocation: true });
    const editedAst = visit(ast, {
      enter(node) {
        if (node.kind === 'Field' && node.name.value === 'b') {
          return null;
        }
      }
    });

    expect(ast).to.deep.equal(
      parse('{ a, b, c { a, b, c } }', { noLocation: true })
    );

    expect(editedAst).to.deep.equal(
      parse('{ a,    c { a,    c } }', { noLocation: true })
    );
  });

  it('allows for editing on leave', () => {

    const ast = parse('{ a, b, c { a, b, c } }', { noLocation: true });
    const editedAst = visit(ast, {
      leave(node) {
        if (node.kind === 'Field' && node.name.value === 'b') {
          return null;
        }
      }
    });

    expect(ast).to.deep.equal(
      parse('{ a, b, c { a, b, c } }', { noLocation: true })
    );

    expect(editedAst).to.deep.equal(
      parse('{ a,    c { a,    c } }', { noLocation: true })
    );
  });

  it('visits edited node', () => {

    const addedField =
      { kind: 'Field',
        name:
         { kind: 'Name',
           value: '__typename' } };

    let didVisitAddedField;

    const ast = parse('{ a { x } }');
    visit(ast, {
      enter(node) {
        if (node.kind === 'Field' && node.name.value === 'a') {
          return {
            kind: 'Field',
            selectionSet: [ addedField ].concat(node.selectionSet)
          };
        }
        if (node === addedField) {
          didVisitAddedField = true;
        }
      }
    });

    expect(didVisitAddedField).to.equal(true);
  });

  it('allows skipping a sub-tree', () => {

    const visited = [];

    const ast = parse('{ a, b { x }, c }');
    visit(ast, {
      enter(node) {
        visited.push([ 'enter', node.kind, node.value ]);
        if (node.kind === 'Field' && node.name.value === 'b') {
          return false;
        }
      },

      leave(node) {
        visited.push([ 'leave', node.kind, node.value ]);
      }
    });

    expect(visited).to.deep.equal([
      [ 'enter', 'Document', undefined ],
      [ 'enter', 'OperationDefinition', undefined ],
      [ 'enter', 'SelectionSet', undefined ],
      [ 'enter', 'Field', undefined ],
      [ 'enter', 'Name', 'a' ],
      [ 'leave', 'Name', 'a' ],
      [ 'leave', 'Field', undefined ],
      [ 'enter', 'Field', undefined ],
      [ 'enter', 'Field', undefined ],
      [ 'enter', 'Name', 'c' ],
      [ 'leave', 'Name', 'c' ],
      [ 'leave', 'Field', undefined ],
      [ 'leave', 'SelectionSet', undefined ],
      [ 'leave', 'OperationDefinition', undefined ],
      [ 'leave', 'Document', undefined ],
    ]);
  });

  it('allows early exit while visiting', () => {

    const visited = [];

    const ast = parse('{ a, b { x }, c }');
    visit(ast, {
      enter(node) {
        visited.push([ 'enter', node.kind, node.value ]);
        if (node.kind === 'Name' && node.value === 'x') {
          return BREAK;
        }
      },

      leave(node) {
        visited.push([ 'leave', node.kind, node.value ]);
      }
    });

    expect(visited).to.deep.equal([
      [ 'enter', 'Document', undefined ],
      [ 'enter', 'OperationDefinition', undefined ],
      [ 'enter', 'SelectionSet', undefined ],
      [ 'enter', 'Field', undefined ],
      [ 'enter', 'Name', 'a' ],
      [ 'leave', 'Name', 'a' ],
      [ 'leave', 'Field', undefined ],
      [ 'enter', 'Field', undefined ],
      [ 'enter', 'Name', 'b' ],
      [ 'leave', 'Name', 'b' ],
      [ 'enter', 'SelectionSet', undefined ],
      [ 'enter', 'Field', undefined ],
      [ 'enter', 'Name', 'x' ]
    ]);
  });

  it('allows early exit while leaving', () => {

    const visited = [];

    const ast = parse('{ a, b { x }, c }');
    visit(ast, {
      enter(node) {
        visited.push([ 'enter', node.kind, node.value ]);
      },

      leave(node) {
        visited.push([ 'leave', node.kind, node.value ]);
        if (node.kind === 'Name' && node.value === 'x') {
          return BREAK;
        }
      }
    });

    expect(visited).to.deep.equal([
      [ 'enter', 'Document', undefined ],
      [ 'enter', 'OperationDefinition', undefined ],
      [ 'enter', 'SelectionSet', undefined ],
      [ 'enter', 'Field', undefined ],
      [ 'enter', 'Name', 'a' ],
      [ 'leave', 'Name', 'a' ],
      [ 'leave', 'Field', undefined ],
      [ 'enter', 'Field', undefined ],
      [ 'enter', 'Name', 'b' ],
      [ 'leave', 'Name', 'b' ],
      [ 'enter', 'SelectionSet', undefined ],
      [ 'enter', 'Field', undefined ],
      [ 'enter', 'Name', 'x' ],
      [ 'leave', 'Name', 'x' ]
    ]);
  });

  it('allows a named functions visitor API', () => {

    const visited = [];

    const ast = parse('{ a, b { x }, c }');
    visit(ast, {
      Name(node) {
        visited.push([ 'enter', node.kind, node.value ]);
      },
      SelectionSet: {
        enter(node) {
          visited.push([ 'enter', node.kind, node.value ]);
        },
        leave(node) {
          visited.push([ 'leave', node.kind, node.value ]);
        }
      }
    });

    expect(visited).to.deep.equal([
      [ 'enter', 'SelectionSet', undefined ],
      [ 'enter', 'Name', 'a' ],
      [ 'enter', 'Name', 'b' ],
      [ 'enter', 'SelectionSet', undefined ],
      [ 'enter', 'Name', 'x' ],
      [ 'leave', 'SelectionSet', undefined ],
      [ 'enter', 'Name', 'c' ],
      [ 'leave', 'SelectionSet', undefined ],
    ]);
  });


  const kitchenSink = readFileSync(
    join(__dirname, '/kitchen-sink.graphql'),
    { encoding: 'utf8' }
  );

  it('visits kitchen sink', () => {

    const ast = parse(kitchenSink);

    const visited = [];

    visit(ast, {
      enter(node, key, parent) {
        visited.push([ 'enter', node.kind, key, parent && parent.kind ]);
      },

      leave(node, key, parent) {
        visited.push([ 'leave', node.kind, key, parent && parent.kind ]);
      }
    });

    expect(visited).to.deep.equal([
      [ 'enter', 'Document', undefined, undefined ],
      [ 'enter', 'OperationDefinition', 0, undefined ],
      [ 'enter', 'Name', 'name', 'OperationDefinition' ],
      [ 'leave', 'Name', 'name', 'OperationDefinition' ],
      [ 'enter', 'VariableDefinition', 0, undefined ],
      [ 'enter', 'Variable', 'variable', 'VariableDefinition' ],
      [ 'enter', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Variable', 'variable', 'VariableDefinition' ],
      [ 'enter', 'NamedType', 'type', 'VariableDefinition' ],
      [ 'enter', 'Name', 'name', 'NamedType' ],
      [ 'leave', 'Name', 'name', 'NamedType' ],
      [ 'leave', 'NamedType', 'type', 'VariableDefinition' ],
      [ 'leave', 'VariableDefinition', 0, undefined ],
      [ 'enter', 'VariableDefinition', 1, undefined ],
      [ 'enter', 'Variable', 'variable', 'VariableDefinition' ],
      [ 'enter', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Variable', 'variable', 'VariableDefinition' ],
      [ 'enter', 'NamedType', 'type', 'VariableDefinition' ],
      [ 'enter', 'Name', 'name', 'NamedType' ],
      [ 'leave', 'Name', 'name', 'NamedType' ],
      [ 'leave', 'NamedType', 'type', 'VariableDefinition' ],
      [ 'enter', 'EnumValue', 'defaultValue', 'VariableDefinition' ],
      [ 'leave', 'EnumValue', 'defaultValue', 'VariableDefinition' ],
      [ 'leave', 'VariableDefinition', 1, undefined ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'OperationDefinition' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'alias', 'Field' ],
      [ 'leave', 'Name', 'alias', 'Field' ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'enter', 'Argument', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'ListValue', 'value', 'Argument' ],
      [ 'enter', 'IntValue', 0, undefined ],
      [ 'leave', 'IntValue', 0, undefined ],
      [ 'enter', 'IntValue', 1, undefined ],
      [ 'leave', 'IntValue', 1, undefined ],
      [ 'leave', 'ListValue', 'value', 'Argument' ],
      [ 'leave', 'Argument', 0, undefined ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'enter', 'InlineFragment', 1, undefined ],
      [ 'enter', 'NamedType', 'typeCondition', 'InlineFragment' ],
      [ 'enter', 'Name', 'name', 'NamedType' ],
      [ 'leave', 'Name', 'name', 'NamedType' ],
      [ 'leave', 'NamedType', 'typeCondition', 'InlineFragment' ],
      [ 'enter', 'Directive', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Directive' ],
      [ 'leave', 'Name', 'name', 'Directive' ],
      [ 'leave', 'Directive', 0, undefined ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'InlineFragment' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'enter', 'Field', 1, undefined ],
      [ 'enter', 'Name', 'alias', 'Field' ],
      [ 'leave', 'Name', 'alias', 'Field' ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'enter', 'Argument', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'IntValue', 'value', 'Argument' ],
      [ 'leave', 'IntValue', 'value', 'Argument' ],
      [ 'leave', 'Argument', 0, undefined ],
      [ 'enter', 'Argument', 1, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'Variable', 'value', 'Argument' ],
      [ 'enter', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Variable', 'value', 'Argument' ],
      [ 'leave', 'Argument', 1, undefined ],
      [ 'enter', 'Directive', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Directive' ],
      [ 'leave', 'Name', 'name', 'Directive' ],
      [ 'enter', 'Argument', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'Variable', 'value', 'Argument' ],
      [ 'enter', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Variable', 'value', 'Argument' ],
      [ 'leave', 'Argument', 0, undefined ],
      [ 'leave', 'Directive', 0, undefined ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'enter', 'FragmentSpread', 1, undefined ],
      [ 'enter', 'Name', 'name', 'FragmentSpread' ],
      [ 'leave', 'Name', 'name', 'FragmentSpread' ],
      [ 'leave', 'FragmentSpread', 1, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'leave', 'Field', 1, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'InlineFragment' ],
      [ 'leave', 'InlineFragment', 1, undefined ],
      [ 'enter', 'InlineFragment', 2, undefined ],
      [ 'enter', 'Directive', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Directive' ],
      [ 'leave', 'Name', 'name', 'Directive' ],
      [ 'enter', 'Argument', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'Variable', 'value', 'Argument' ],
      [ 'enter', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Variable', 'value', 'Argument' ],
      [ 'leave', 'Argument', 0, undefined ],
      [ 'leave', 'Directive', 0, undefined ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'InlineFragment' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'InlineFragment' ],
      [ 'leave', 'InlineFragment', 2, undefined ],
      [ 'enter', 'InlineFragment', 3, undefined ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'InlineFragment' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'InlineFragment' ],
      [ 'leave', 'InlineFragment', 3, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'OperationDefinition' ],
      [ 'leave', 'OperationDefinition', 0, undefined ],
      [ 'enter', 'OperationDefinition', 1, undefined ],
      [ 'enter', 'Name', 'name', 'OperationDefinition' ],
      [ 'leave', 'Name', 'name', 'OperationDefinition' ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'OperationDefinition' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'enter', 'Argument', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'IntValue', 'value', 'Argument' ],
      [ 'leave', 'IntValue', 'value', 'Argument' ],
      [ 'leave', 'Argument', 0, undefined ],
      [ 'enter', 'Directive', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Directive' ],
      [ 'leave', 'Name', 'name', 'Directive' ],
      [ 'leave', 'Directive', 0, undefined ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'OperationDefinition' ],
      [ 'leave', 'OperationDefinition', 1, undefined ],
      [ 'enter', 'OperationDefinition', 2, undefined ],
      [ 'enter', 'Name', 'name', 'OperationDefinition' ],
      [ 'leave', 'Name', 'name', 'OperationDefinition' ],
      [ 'enter', 'VariableDefinition', 0, undefined ],
      [ 'enter', 'Variable', 'variable', 'VariableDefinition' ],
      [ 'enter', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Variable', 'variable', 'VariableDefinition' ],
      [ 'enter', 'NamedType', 'type', 'VariableDefinition' ],
      [ 'enter', 'Name', 'name', 'NamedType' ],
      [ 'leave', 'Name', 'name', 'NamedType' ],
      [ 'leave', 'NamedType', 'type', 'VariableDefinition' ],
      [ 'leave', 'VariableDefinition', 0, undefined ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'OperationDefinition' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'enter', 'Argument', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'Variable', 'value', 'Argument' ],
      [ 'enter', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Variable', 'value', 'Argument' ],
      [ 'leave', 'Argument', 0, undefined ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'enter', 'Field', 1, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'leave', 'Field', 1, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'OperationDefinition' ],
      [ 'leave', 'OperationDefinition', 2, undefined ],
      [ 'enter', 'FragmentDefinition', 3, undefined ],
      [ 'enter', 'Name', 'name', 'FragmentDefinition' ],
      [ 'leave', 'Name', 'name', 'FragmentDefinition' ],
      [ 'enter', 'NamedType', 'typeCondition', 'FragmentDefinition' ],
      [ 'enter', 'Name', 'name', 'NamedType' ],
      [ 'leave', 'Name', 'name', 'NamedType' ],
      [ 'leave', 'NamedType', 'typeCondition', 'FragmentDefinition' ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'FragmentDefinition' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'enter', 'Argument', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'Variable', 'value', 'Argument' ],
      [ 'enter', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Variable', 'value', 'Argument' ],
      [ 'leave', 'Argument', 0, undefined ],
      [ 'enter', 'Argument', 1, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'Variable', 'value', 'Argument' ],
      [ 'enter', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Variable', 'value', 'Argument' ],
      [ 'leave', 'Argument', 1, undefined ],
      [ 'enter', 'Argument', 2, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'ObjectValue', 'value', 'Argument' ],
      [ 'enter', 'ObjectField', 0, undefined ],
      [ 'enter', 'Name', 'name', 'ObjectField' ],
      [ 'leave', 'Name', 'name', 'ObjectField' ],
      [ 'enter', 'StringValue', 'value', 'ObjectField' ],
      [ 'leave', 'StringValue', 'value', 'ObjectField' ],
      [ 'leave', 'ObjectField', 0, undefined ],
      [ 'leave', 'ObjectValue', 'value', 'Argument' ],
      [ 'leave', 'Argument', 2, undefined ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'FragmentDefinition' ],
      [ 'leave', 'FragmentDefinition', 3, undefined ],
      [ 'enter', 'OperationDefinition', 4, undefined ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'OperationDefinition' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'enter', 'Argument', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'BooleanValue', 'value', 'Argument' ],
      [ 'leave', 'BooleanValue', 'value', 'Argument' ],
      [ 'leave', 'Argument', 0, undefined ],
      [ 'enter', 'Argument', 1, undefined ],
      [ 'enter', 'Name', 'name', 'Argument' ],
      [ 'leave', 'Name', 'name', 'Argument' ],
      [ 'enter', 'BooleanValue', 'value', 'Argument' ],
      [ 'leave', 'BooleanValue', 'value', 'Argument' ],
      [ 'leave', 'Argument', 1, undefined ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'enter', 'Field', 1, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'leave', 'Field', 1, undefined ],
      [ 'leave', 'SelectionSet', 'selectionSet', 'OperationDefinition' ],
      [ 'leave', 'OperationDefinition', 4, undefined ],
      [ 'leave', 'Document', undefined, undefined ] ]);
  });

  describe('visitInParallel', () => {

    // Note: nearly identical to the above test of the same test but
    // using visitInParallel.
    it('allows skipping a sub-tree', () => {

      const visited = [];

      const ast = parse('{ a, b { x }, c }');
      visit(ast, visitInParallel([ {
        enter(node) {
          visited.push([ 'enter', node.kind, node.value ]);
          if (node.kind === 'Field' && node.name.value === 'b') {
            return false;
          }
        },

        leave(node) {
          visited.push([ 'leave', node.kind, node.value ]);
        }
      } ]));

      expect(visited).to.deep.equal([
        [ 'enter', 'Document', undefined ],
        [ 'enter', 'OperationDefinition', undefined ],
        [ 'enter', 'SelectionSet', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'a' ],
        [ 'leave', 'Name', 'a' ],
        [ 'leave', 'Field', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'c' ],
        [ 'leave', 'Name', 'c' ],
        [ 'leave', 'Field', undefined ],
        [ 'leave', 'SelectionSet', undefined ],
        [ 'leave', 'OperationDefinition', undefined ],
        [ 'leave', 'Document', undefined ],
      ]);
    });

    it('allows skipping different sub-trees', () => {
      const visited = [];

      const ast = parse('{ a { x }, b { y} }');
      visit(ast, visitInParallel([
        {
          enter(node) {
            visited.push([ 'no-a', 'enter', node.kind, node.value ]);
            if (node.kind === 'Field' && node.name.value === 'a') {
              return false;
            }
          },
          leave(node) {
            visited.push([ 'no-a', 'leave', node.kind, node.value ]);
          }
        },
        {
          enter(node) {
            visited.push([ 'no-b', 'enter', node.kind, node.value ]);
            if (node.kind === 'Field' && node.name.value === 'b') {
              return false;
            }
          },
          leave(node) {
            visited.push([ 'no-b', 'leave', node.kind, node.value ]);
          }
        }
      ]));

      expect(visited).to.deep.equal([
        [ 'no-a', 'enter', 'Document', undefined ],
        [ 'no-b', 'enter', 'Document', undefined ],
        [ 'no-a', 'enter', 'OperationDefinition', undefined ],
        [ 'no-b', 'enter', 'OperationDefinition', undefined ],
        [ 'no-a', 'enter', 'SelectionSet', undefined ],
        [ 'no-b', 'enter', 'SelectionSet', undefined ],
        [ 'no-a', 'enter', 'Field', undefined ],
        [ 'no-b', 'enter', 'Field', undefined ],
        [ 'no-b', 'enter', 'Name', 'a' ],
        [ 'no-b', 'leave', 'Name', 'a' ],
        [ 'no-b', 'enter', 'SelectionSet', undefined ],
        [ 'no-b', 'enter', 'Field', undefined ],
        [ 'no-b', 'enter', 'Name', 'x' ],
        [ 'no-b', 'leave', 'Name', 'x' ],
        [ 'no-b', 'leave', 'Field', undefined ],
        [ 'no-b', 'leave', 'SelectionSet', undefined ],
        [ 'no-b', 'leave', 'Field', undefined ],
        [ 'no-a', 'enter', 'Field', undefined ],
        [ 'no-b', 'enter', 'Field', undefined ],
        [ 'no-a', 'enter', 'Name', 'b' ],
        [ 'no-a', 'leave', 'Name', 'b' ],
        [ 'no-a', 'enter', 'SelectionSet', undefined ],
        [ 'no-a', 'enter', 'Field', undefined ],
        [ 'no-a', 'enter', 'Name', 'y' ],
        [ 'no-a', 'leave', 'Name', 'y' ],
        [ 'no-a', 'leave', 'Field', undefined ],
        [ 'no-a', 'leave', 'SelectionSet', undefined ],
        [ 'no-a', 'leave', 'Field', undefined ],
        [ 'no-a', 'leave', 'SelectionSet', undefined ],
        [ 'no-b', 'leave', 'SelectionSet', undefined ],
        [ 'no-a', 'leave', 'OperationDefinition', undefined ],
        [ 'no-b', 'leave', 'OperationDefinition', undefined ],
        [ 'no-a', 'leave', 'Document', undefined ],
        [ 'no-b', 'leave', 'Document', undefined ],
      ]);
    });

    // Note: nearly identical to the above test of the same test but
    // using visitInParallel.
    it('allows early exit while visiting', () => {

      const visited = [];

      const ast = parse('{ a, b { x }, c }');
      visit(ast, visitInParallel([ {
        enter(node) {
          visited.push([ 'enter', node.kind, node.value ]);
          if (node.kind === 'Name' && node.value === 'x') {
            return BREAK;
          }
        },
        leave(node) {
          visited.push([ 'leave', node.kind, node.value ]);
        }
      } ]));

      expect(visited).to.deep.equal([
        [ 'enter', 'Document', undefined ],
        [ 'enter', 'OperationDefinition', undefined ],
        [ 'enter', 'SelectionSet', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'a' ],
        [ 'leave', 'Name', 'a' ],
        [ 'leave', 'Field', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'b' ],
        [ 'leave', 'Name', 'b' ],
        [ 'enter', 'SelectionSet', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'x' ]
      ]);
    });

    it('allows early exit from different points', () => {

      const visited = [];

      const ast = parse('{ a { y }, b { x } }');
      visit(ast, visitInParallel([
        {
          enter(node) {
            visited.push([ 'break-a', 'enter', node.kind, node.value ]);
            if (node.kind === 'Name' && node.value === 'a') {
              return BREAK;
            }
          },
          leave(node) {
            visited.push([ 'break-a', 'leave', node.kind, node.value ]);
          }
        },
        {
          enter(node) {
            visited.push([ 'break-b', 'enter', node.kind, node.value ]);
            if (node.kind === 'Name' && node.value === 'b') {
              return BREAK;
            }
          },
          leave(node) {
            visited.push([ 'break-b', 'leave', node.kind, node.value ]);
          }
        },
      ]));

      expect(visited).to.deep.equal([
        [ 'break-a', 'enter', 'Document', undefined ],
        [ 'break-b', 'enter', 'Document', undefined ],
        [ 'break-a', 'enter', 'OperationDefinition', undefined ],
        [ 'break-b', 'enter', 'OperationDefinition', undefined ],
        [ 'break-a', 'enter', 'SelectionSet', undefined ],
        [ 'break-b', 'enter', 'SelectionSet', undefined ],
        [ 'break-a', 'enter', 'Field', undefined ],
        [ 'break-b', 'enter', 'Field', undefined ],
        [ 'break-a', 'enter', 'Name', 'a' ],
        [ 'break-b', 'enter', 'Name', 'a' ],
        [ 'break-b', 'leave', 'Name', 'a' ],
        [ 'break-b', 'enter', 'SelectionSet', undefined ],
        [ 'break-b', 'enter', 'Field', undefined ],
        [ 'break-b', 'enter', 'Name', 'y' ],
        [ 'break-b', 'leave', 'Name', 'y' ],
        [ 'break-b', 'leave', 'Field', undefined ],
        [ 'break-b', 'leave', 'SelectionSet', undefined ],
        [ 'break-b', 'leave', 'Field', undefined ],
        [ 'break-b', 'enter', 'Field', undefined ],
        [ 'break-b', 'enter', 'Name', 'b' ]
      ]);
    });

    // Note: nearly identical to the above test of the same test but
    // using visitInParallel.
    it('allows early exit while leaving', () => {

      const visited = [];

      const ast = parse('{ a, b { x }, c }');
      visit(ast, visitInParallel([ {
        enter(node) {
          visited.push([ 'enter', node.kind, node.value ]);
        },
        leave(node) {
          visited.push([ 'leave', node.kind, node.value ]);
          if (node.kind === 'Name' && node.value === 'x') {
            return BREAK;
          }
        }
      } ]));

      expect(visited).to.deep.equal([
        [ 'enter', 'Document', undefined ],
        [ 'enter', 'OperationDefinition', undefined ],
        [ 'enter', 'SelectionSet', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'a' ],
        [ 'leave', 'Name', 'a' ],
        [ 'leave', 'Field', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'b' ],
        [ 'leave', 'Name', 'b' ],
        [ 'enter', 'SelectionSet', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'x' ],
        [ 'leave', 'Name', 'x' ]
      ]);
    });

    it('allows early exit from leaving different points', () => {

      const visited = [];

      const ast = parse('{ a { y }, b { x } }');
      visit(ast, visitInParallel([
        {
          enter(node) {
            visited.push([ 'break-a', 'enter', node.kind, node.value ]);
          },
          leave(node) {
            visited.push([ 'break-a', 'leave', node.kind, node.value ]);
            if (node.kind === 'Field' && node.name.value === 'a') {
              return BREAK;
            }
          }
        },
        {
          enter(node) {
            visited.push([ 'break-b', 'enter', node.kind, node.value ]);
          },
          leave(node) {
            visited.push([ 'break-b', 'leave', node.kind, node.value ]);
            if (node.kind === 'Field' && node.name.value === 'b') {
              return BREAK;
            }
          }
        },
      ]));

      expect(visited).to.deep.equal([
        [ 'break-a', 'enter', 'Document', undefined ],
        [ 'break-b', 'enter', 'Document', undefined ],
        [ 'break-a', 'enter', 'OperationDefinition', undefined ],
        [ 'break-b', 'enter', 'OperationDefinition', undefined ],
        [ 'break-a', 'enter', 'SelectionSet', undefined ],
        [ 'break-b', 'enter', 'SelectionSet', undefined ],
        [ 'break-a', 'enter', 'Field', undefined ],
        [ 'break-b', 'enter', 'Field', undefined ],
        [ 'break-a', 'enter', 'Name', 'a' ],
        [ 'break-b', 'enter', 'Name', 'a' ],
        [ 'break-a', 'leave', 'Name', 'a' ],
        [ 'break-b', 'leave', 'Name', 'a' ],
        [ 'break-a', 'enter', 'SelectionSet', undefined ],
        [ 'break-b', 'enter', 'SelectionSet', undefined ],
        [ 'break-a', 'enter', 'Field', undefined ],
        [ 'break-b', 'enter', 'Field', undefined ],
        [ 'break-a', 'enter', 'Name', 'y' ],
        [ 'break-b', 'enter', 'Name', 'y' ],
        [ 'break-a', 'leave', 'Name', 'y' ],
        [ 'break-b', 'leave', 'Name', 'y' ],
        [ 'break-a', 'leave', 'Field', undefined ],
        [ 'break-b', 'leave', 'Field', undefined ],
        [ 'break-a', 'leave', 'SelectionSet', undefined ],
        [ 'break-b', 'leave', 'SelectionSet', undefined ],
        [ 'break-a', 'leave', 'Field', undefined ],
        [ 'break-b', 'leave', 'Field', undefined ],
        [ 'break-b', 'enter', 'Field', undefined ],
        [ 'break-b', 'enter', 'Name', 'b' ],
        [ 'break-b', 'leave', 'Name', 'b' ],
        [ 'break-b', 'enter', 'SelectionSet', undefined ],
        [ 'break-b', 'enter', 'Field', undefined ],
        [ 'break-b', 'enter', 'Name', 'x' ],
        [ 'break-b', 'leave', 'Name', 'x' ],
        [ 'break-b', 'leave', 'Field', undefined ],
        [ 'break-b', 'leave', 'SelectionSet', undefined ],
        [ 'break-b', 'leave', 'Field', undefined ]
      ]);
    });

    it('allows for editing on enter', () => {
      const visited = [];

      const ast = parse('{ a, b, c { a, b, c } }', { noLocation: true });
      const editedAst = visit(ast, visitInParallel([
        {
          enter(node) {
            if (node.kind === 'Field' && node.name.value === 'b') {
              return null;
            }
          }
        },
        {
          enter(node) {
            visited.push([ 'enter', node.kind, node.value ]);
          },
          leave(node) {
            visited.push([ 'leave', node.kind, node.value ]);
          }
        },
      ]));

      expect(ast).to.deep.equal(
        parse('{ a, b, c { a, b, c } }', { noLocation: true })
      );

      expect(editedAst).to.deep.equal(
        parse('{ a,    c { a,    c } }', { noLocation: true })
      );

      expect(visited).to.deep.equal([
        [ 'enter', 'Document', undefined ],
        [ 'enter', 'OperationDefinition', undefined ],
        [ 'enter', 'SelectionSet', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'a' ],
        [ 'leave', 'Name', 'a' ],
        [ 'leave', 'Field', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'c' ],
        [ 'leave', 'Name', 'c' ],
        [ 'enter', 'SelectionSet', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'a' ],
        [ 'leave', 'Name', 'a' ],
        [ 'leave', 'Field', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'c' ],
        [ 'leave', 'Name', 'c' ],
        [ 'leave', 'Field', undefined ],
        [ 'leave', 'SelectionSet', undefined ],
        [ 'leave', 'Field', undefined ],
        [ 'leave', 'SelectionSet', undefined ],
        [ 'leave', 'OperationDefinition', undefined ],
        [ 'leave', 'Document', undefined ]
      ]);
    });

    it('allows for editing on leave', () => {
      const visited = [];

      const ast = parse('{ a, b, c { a, b, c } }', { noLocation: true });
      const editedAst = visit(ast, visitInParallel([
        {
          leave(node) {
            if (node.kind === 'Field' && node.name.value === 'b') {
              return null;
            }
          }
        },
        {
          enter(node) {
            visited.push([ 'enter', node.kind, node.value ]);
          },
          leave(node) {
            visited.push([ 'leave', node.kind, node.value ]);
          }
        },
      ]));

      expect(ast).to.deep.equal(
        parse('{ a, b, c { a, b, c } }', { noLocation: true })
      );

      expect(editedAst).to.deep.equal(
        parse('{ a,    c { a,    c } }', { noLocation: true })
      );

      expect(visited).to.deep.equal([
        [ 'enter', 'Document', undefined ],
        [ 'enter', 'OperationDefinition', undefined ],
        [ 'enter', 'SelectionSet', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'a' ],
        [ 'leave', 'Name', 'a' ],
        [ 'leave', 'Field', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'b' ],
        [ 'leave', 'Name', 'b' ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'c' ],
        [ 'leave', 'Name', 'c' ],
        [ 'enter', 'SelectionSet', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'a' ],
        [ 'leave', 'Name', 'a' ],
        [ 'leave', 'Field', undefined ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'b' ],
        [ 'leave', 'Name', 'b' ],
        [ 'enter', 'Field', undefined ],
        [ 'enter', 'Name', 'c' ],
        [ 'leave', 'Name', 'c' ],
        [ 'leave', 'Field', undefined ],
        [ 'leave', 'SelectionSet', undefined ],
        [ 'leave', 'Field', undefined ],
        [ 'leave', 'SelectionSet', undefined ],
        [ 'leave', 'OperationDefinition', undefined ],
        [ 'leave', 'Document', undefined ]
      ]);
    });

  });

  describe('visitWithTypeInfo', () => {

    it('maintains type info during visit', () => {
      const visited = [];

      const typeInfo = new TypeInfo(testSchema);

      const ast = parse('{ human(id: 4) { name, pets { name }, unknown } }');
      visit(ast, visitWithTypeInfo(typeInfo, {
        enter(node) {
          const parentType = typeInfo.getParentType();
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'enter',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            parentType ? String(parentType) : null,
            type ? String(type) : null,
            inputType ? String(inputType) : null
          ]);
        },
        leave(node) {
          const parentType = typeInfo.getParentType();
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'leave',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            parentType ? String(parentType) : null,
            type ? String(type) : null,
            inputType ? String(inputType) : null
          ]);
        }
      }));

      expect(visited).to.deep.equal([
        [ 'enter', 'Document', null, null, null, null ],
        [ 'enter', 'OperationDefinition', null, null, 'QueryRoot', null ],
        [ 'enter', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null ],
        [ 'enter', 'Field', null, 'QueryRoot', 'Human', null ],
        [ 'enter', 'Name', 'human', 'QueryRoot', 'Human', null ],
        [ 'leave', 'Name', 'human', 'QueryRoot', 'Human', null ],
        [ 'enter', 'Argument', null, 'QueryRoot', 'Human', 'ID' ],
        [ 'enter', 'Name', 'id', 'QueryRoot', 'Human', 'ID' ],
        [ 'leave', 'Name', 'id', 'QueryRoot', 'Human', 'ID' ],
        [ 'enter', 'IntValue', null, 'QueryRoot', 'Human', 'ID' ],
        [ 'leave', 'IntValue', null, 'QueryRoot', 'Human', 'ID' ],
        [ 'leave', 'Argument', null, 'QueryRoot', 'Human', 'ID' ],
        [ 'enter', 'SelectionSet', null, 'Human', 'Human', null ],
        [ 'enter', 'Field', null, 'Human', 'String', null ],
        [ 'enter', 'Name', 'name', 'Human', 'String', null ],
        [ 'leave', 'Name', 'name', 'Human', 'String', null ],
        [ 'leave', 'Field', null, 'Human', 'String', null ],
        [ 'enter', 'Field', null, 'Human', '[Pet]', null ],
        [ 'enter', 'Name', 'pets', 'Human', '[Pet]', null ],
        [ 'leave', 'Name', 'pets', 'Human', '[Pet]', null ],
        [ 'enter', 'SelectionSet', null, 'Pet', '[Pet]', null ],
        [ 'enter', 'Field', null, 'Pet', 'String', null ],
        [ 'enter', 'Name', 'name', 'Pet', 'String', null ],
        [ 'leave', 'Name', 'name', 'Pet', 'String', null ],
        [ 'leave', 'Field', null, 'Pet', 'String', null ],
        [ 'leave', 'SelectionSet', null, 'Pet', '[Pet]', null ],
        [ 'leave', 'Field', null, 'Human', '[Pet]', null ],
        [ 'enter', 'Field', null, 'Human', null, null ],
        [ 'enter', 'Name', 'unknown', 'Human', null, null ],
        [ 'leave', 'Name', 'unknown', 'Human', null, null ],
        [ 'leave', 'Field', null, 'Human', null, null ],
        [ 'leave', 'SelectionSet', null, 'Human', 'Human', null ],
        [ 'leave', 'Field', null, 'QueryRoot', 'Human', null ],
        [ 'leave', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null ],
        [ 'leave', 'OperationDefinition', null, null, 'QueryRoot', null ],
        [ 'leave', 'Document', null, null, null, null ]
      ]);
    });

    it('maintains type info during edit', () => {
      const visited = [];
      const typeInfo = new TypeInfo(testSchema);

      const ast = parse(
        '{ human(id: 4) { name, pets }, alien }'
      );
      const editedAst = visit(ast, visitWithTypeInfo(typeInfo, {
        enter(node) {
          const parentType = typeInfo.getParentType();
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'enter',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            parentType ? String(parentType) : null,
            type ? String(type) : null,
            inputType ? String(inputType) : null
          ]);

          // Make a query valid by adding missing selection sets.
          if (
            node.kind === 'Field' &&
            !node.selectionSet &&
            isCompositeType(getNamedType(type))
          ) {
            return {
              kind: 'Field',
              alias: node.alias,
              name: node.name,
              arguments: node.arguments,
              directives: node.directives,
              selectionSet: {
                kind: 'SelectionSet',
                selections: [
                  {
                    kind: 'Field',
                    name: { kind: 'Name', value: '__typename' }
                  }
                ]
              }
            };
          }
        },
        leave(node) {
          const parentType = typeInfo.getParentType();
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'leave',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            parentType ? String(parentType) : null,
            type ? String(type) : null,
            inputType ? String(inputType) : null
          ]);
        }
      }));

      expect(print(ast)).to.deep.equal(print(parse(
        '{ human(id: 4) { name, pets }, alien }'
      )));

      expect(print(editedAst)).to.deep.equal(print(parse(
        '{ human(id: 4) { name, pets { __typename } }, alien { __typename } }'
      )));

      expect(visited).to.deep.equal([
        [ 'enter', 'Document', null, null, null, null ],
        [ 'enter', 'OperationDefinition', null, null, 'QueryRoot', null ],
        [ 'enter', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null ],
        [ 'enter', 'Field', null, 'QueryRoot', 'Human', null ],
        [ 'enter', 'Name', 'human', 'QueryRoot', 'Human', null ],
        [ 'leave', 'Name', 'human', 'QueryRoot', 'Human', null ],
        [ 'enter', 'Argument', null, 'QueryRoot', 'Human', 'ID' ],
        [ 'enter', 'Name', 'id', 'QueryRoot', 'Human', 'ID' ],
        [ 'leave', 'Name', 'id', 'QueryRoot', 'Human', 'ID' ],
        [ 'enter', 'IntValue', null, 'QueryRoot', 'Human', 'ID' ],
        [ 'leave', 'IntValue', null, 'QueryRoot', 'Human', 'ID' ],
        [ 'leave', 'Argument', null, 'QueryRoot', 'Human', 'ID' ],
        [ 'enter', 'SelectionSet', null, 'Human', 'Human', null ],
        [ 'enter', 'Field', null, 'Human', 'String', null ],
        [ 'enter', 'Name', 'name', 'Human', 'String', null ],
        [ 'leave', 'Name', 'name', 'Human', 'String', null ],
        [ 'leave', 'Field', null, 'Human', 'String', null ],
        [ 'enter', 'Field', null, 'Human', '[Pet]', null ],
        [ 'enter', 'Name', 'pets', 'Human', '[Pet]', null ],
        [ 'leave', 'Name', 'pets', 'Human', '[Pet]', null ],
        [ 'enter', 'SelectionSet', null, 'Pet', '[Pet]', null ],
        [ 'enter', 'Field', null, 'Pet', 'String!', null ],
        [ 'enter', 'Name', '__typename', 'Pet', 'String!', null ],
        [ 'leave', 'Name', '__typename', 'Pet', 'String!', null ],
        [ 'leave', 'Field', null, 'Pet', 'String!', null ],
        [ 'leave', 'SelectionSet', null, 'Pet', '[Pet]', null ],
        [ 'leave', 'Field', null, 'Human', '[Pet]', null ],
        [ 'leave', 'SelectionSet', null, 'Human', 'Human', null ],
        [ 'leave', 'Field', null, 'QueryRoot', 'Human', null ],
        [ 'enter', 'Field', null, 'QueryRoot', 'Alien', null ],
        [ 'enter', 'Name', 'alien', 'QueryRoot', 'Alien', null ],
        [ 'leave', 'Name', 'alien', 'QueryRoot', 'Alien', null ],
        [ 'enter', 'SelectionSet', null, 'Alien', 'Alien', null ],
        [ 'enter', 'Field', null, 'Alien', 'String!', null ],
        [ 'enter', 'Name', '__typename', 'Alien', 'String!', null ],
        [ 'leave', 'Name', '__typename', 'Alien', 'String!', null ],
        [ 'leave', 'Field', null, 'Alien', 'String!', null ],
        [ 'leave', 'SelectionSet', null, 'Alien', 'Alien', null ],
        [ 'leave', 'Field', null, 'QueryRoot', 'Alien', null ],
        [ 'leave', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null ],
        [ 'leave', 'OperationDefinition', null, null, 'QueryRoot', null ],
        [ 'leave', 'Document', null, null, null, null ]
      ]);
    });

  });

});
