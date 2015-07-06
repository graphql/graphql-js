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
import { readFileSync } from 'fs';
import { visit, BREAK } from '../visitor';
import { join } from 'path';


describe('Visitor', () => {
  it('allows for editing on enter', () => {

    var ast = parse('{ a, b, c { a, b, c } }', { noLocation: true });
    var editedAst = visit(ast, {
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

    var ast = parse('{ a, b, c { a, b, c } }', { noLocation: true });
    var editedAst = visit(ast, {
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

    var addedField =
      { kind: 'Field',
        name:
         { kind: 'Name',
           value: '__typename' } };

    var didVisitAddedField;

    var ast = parse('{ a { x } }');
    visit(ast, {
      enter(node) {
        if (node.kind === 'Field' && node.name.value === 'a') {
          return {
            kind: 'Field',
            selectionSet: [addedField].concat(node.selectionSet)
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

    var visited = [];

    var ast = parse('{ a, b { x }, c }');
    visit(ast, {
      enter(node) {
        visited.push(['enter', node.kind, node.value]);
        if (node.kind === 'Field' && node.name.value === 'b') {
          return false;
        }
      },

      leave(node) {
        visited.push(['leave', node.kind, node.value]);
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

    var visited = [];

    var ast = parse('{ a, b { x }, c }');
    visit(ast, {
      enter(node) {
        visited.push(['enter', node.kind, node.value]);
        if (node.kind === 'Name' && node.value === 'x') {
          return BREAK;
        }
      },

      leave(node) {
        visited.push(['leave', node.kind, node.value]);
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

  it('allows a named functions visitor API', () => {

    var visited = [];

    var ast = parse('{ a, b { x }, c }');
    visit(ast, {
      Name(node) {
        visited.push(['enter', node.kind, node.value]);
      },
      SelectionSet: {
        enter(node) {
          visited.push(['enter', node.kind, node.value]);
        },
        leave(node) {
          visited.push(['leave', node.kind, node.value]);
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


  var kitchenSink = readFileSync(
    join(__dirname, '/kitchen-sink.graphql'),
    { encoding: 'utf8' }
  );

  it('visits kitchen sink', () => {

    var ast = parse(kitchenSink);

    var visited = [];

    visit(ast, {
      enter(node, key, parent) {
        visited.push(['enter', node.kind, key, parent && parent.kind]);
      },

      leave(node, key, parent) {
        visited.push(['leave', node.kind, key, parent && parent.kind]);
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
      [ 'enter', 'Name', 'type', 'VariableDefinition' ],
      [ 'leave', 'Name', 'type', 'VariableDefinition' ],
      [ 'leave', 'VariableDefinition', 0, undefined ],
      [ 'enter', 'VariableDefinition', 1, undefined ],
      [ 'enter', 'Variable', 'variable', 'VariableDefinition' ],
      [ 'enter', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Name', 'name', 'Variable' ],
      [ 'leave', 'Variable', 'variable', 'VariableDefinition' ],
      [ 'enter', 'Name', 'type', 'VariableDefinition' ],
      [ 'leave', 'Name', 'type', 'VariableDefinition' ],
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
      [ 'enter', 'ArrayValue', 'value', 'Argument' ],
      [ 'enter', 'IntValue', 0, undefined ],
      [ 'leave', 'IntValue', 0, undefined ],
      [ 'enter', 'IntValue', 1, undefined ],
      [ 'leave', 'IntValue', 1, undefined ],
      [ 'leave', 'ArrayValue', 'value', 'Argument' ],
      [ 'leave', 'Argument', 0, undefined ],
      [ 'enter', 'SelectionSet', 'selectionSet', 'Field' ],
      [ 'enter', 'Field', 0, undefined ],
      [ 'enter', 'Name', 'name', 'Field' ],
      [ 'leave', 'Name', 'name', 'Field' ],
      [ 'leave', 'Field', 0, undefined ],
      [ 'enter', 'InlineFragment', 1, undefined ],
      [ 'enter', 'Name', 'typeCondition', 'InlineFragment' ],
      [ 'leave', 'Name', 'typeCondition', 'InlineFragment' ],
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
      [ 'enter', 'FragmentDefinition', 2, undefined ],
      [ 'enter', 'Name', 'name', 'FragmentDefinition' ],
      [ 'leave', 'Name', 'name', 'FragmentDefinition' ],
      [ 'enter', 'Name', 'typeCondition', 'FragmentDefinition' ],
      [ 'leave', 'Name', 'typeCondition', 'FragmentDefinition' ],
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
      [ 'leave', 'FragmentDefinition', 2, undefined ],
      [ 'enter', 'OperationDefinition', 3, undefined ],
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
      [ 'leave', 'OperationDefinition', 3, undefined ],
      [ 'leave', 'Document', undefined, undefined ]
    ]);
  });
});
