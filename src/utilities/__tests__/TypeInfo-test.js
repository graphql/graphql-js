// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';
import { print } from '../../language/printer';
import { visit } from '../../language/visitor';

import { getNamedType, isCompositeType } from '../../type/definition';

import { TypeInfo, visitWithTypeInfo } from '../TypeInfo';

import { testSchema } from '../../validation/__tests__/harness';

describe('visitWithTypeInfo', () => {
  it('provide exact same arguments to wrapped visitor', () => {
    const ast = parse(
      '{ human(id: 4) { name, pets { ... { name } }, unknown } }',
    );

    const visitorArgs = [];
    visit(ast, {
      enter(...args) {
        visitorArgs.push(['enter', ...args]);
      },
      leave(...args) {
        visitorArgs.push(['leave', ...args]);
      },
    });

    const wrappedVisitorArgs = [];
    const typeInfo = new TypeInfo(testSchema);
    visit(
      ast,
      visitWithTypeInfo(typeInfo, {
        enter(...args) {
          wrappedVisitorArgs.push(['enter', ...args]);
        },
        leave(...args) {
          wrappedVisitorArgs.push(['leave', ...args]);
        },
      }),
    );

    expect(visitorArgs).to.deep.equal(wrappedVisitorArgs);
  });

  it('maintains type info during visit', () => {
    const visited = [];

    const typeInfo = new TypeInfo(testSchema);

    const ast = parse(
      '{ human(id: 4) { name, pets { ... { name } }, unknown } }',
    );

    visit(
      ast,
      visitWithTypeInfo(typeInfo, {
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
            inputType ? String(inputType) : null,
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
            inputType ? String(inputType) : null,
          ]);
        },
      }),
    );

    expect(visited).to.deep.equal([
      ['enter', 'Document', null, null, null, null],
      ['enter', 'OperationDefinition', null, null, 'QueryRoot', null],
      ['enter', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null],
      ['enter', 'Field', null, 'QueryRoot', 'Human', null],
      ['enter', 'Name', 'human', 'QueryRoot', 'Human', null],
      ['leave', 'Name', 'human', 'QueryRoot', 'Human', null],
      ['enter', 'Argument', null, 'QueryRoot', 'Human', 'ID'],
      ['enter', 'Name', 'id', 'QueryRoot', 'Human', 'ID'],
      ['leave', 'Name', 'id', 'QueryRoot', 'Human', 'ID'],
      ['enter', 'IntValue', null, 'QueryRoot', 'Human', 'ID'],
      ['leave', 'IntValue', null, 'QueryRoot', 'Human', 'ID'],
      ['leave', 'Argument', null, 'QueryRoot', 'Human', 'ID'],
      ['enter', 'SelectionSet', null, 'Human', 'Human', null],
      ['enter', 'Field', null, 'Human', 'String', null],
      ['enter', 'Name', 'name', 'Human', 'String', null],
      ['leave', 'Name', 'name', 'Human', 'String', null],
      ['leave', 'Field', null, 'Human', 'String', null],
      ['enter', 'Field', null, 'Human', '[Pet]', null],
      ['enter', 'Name', 'pets', 'Human', '[Pet]', null],
      ['leave', 'Name', 'pets', 'Human', '[Pet]', null],
      ['enter', 'SelectionSet', null, 'Pet', '[Pet]', null],
      ['enter', 'InlineFragment', null, 'Pet', 'Pet', null],
      ['enter', 'SelectionSet', null, 'Pet', 'Pet', null],
      ['enter', 'Field', null, 'Pet', 'String', null],
      ['enter', 'Name', 'name', 'Pet', 'String', null],
      ['leave', 'Name', 'name', 'Pet', 'String', null],
      ['leave', 'Field', null, 'Pet', 'String', null],
      ['leave', 'SelectionSet', null, 'Pet', 'Pet', null],
      ['leave', 'InlineFragment', null, 'Pet', 'Pet', null],
      ['leave', 'SelectionSet', null, 'Pet', '[Pet]', null],
      ['leave', 'Field', null, 'Human', '[Pet]', null],
      ['enter', 'Field', null, 'Human', null, null],
      ['enter', 'Name', 'unknown', 'Human', null, null],
      ['leave', 'Name', 'unknown', 'Human', null, null],
      ['leave', 'Field', null, 'Human', null, null],
      ['leave', 'SelectionSet', null, 'Human', 'Human', null],
      ['leave', 'Field', null, 'QueryRoot', 'Human', null],
      ['leave', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null],
      ['leave', 'OperationDefinition', null, null, 'QueryRoot', null],
      ['leave', 'Document', null, null, null, null],
    ]);
  });

  it('maintains type info during edit', () => {
    const visited = [];
    const typeInfo = new TypeInfo(testSchema);

    const ast = parse('{ human(id: 4) { name, pets }, alien }');
    const editedAST = visit(
      ast,
      visitWithTypeInfo(typeInfo, {
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
            inputType ? String(inputType) : null,
          ]);

          // Make a query valid by adding missing selection sets.
          if (
            node.kind === 'Field' &&
            !node.selectionSet &&
            isCompositeType(getNamedType(type))
          ) {
            return {
              ...node,
              selectionSet: {
                kind: 'SelectionSet',
                selections: [
                  {
                    kind: 'Field',
                    name: { kind: 'Name', value: '__typename' },
                  },
                ],
              },
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
            inputType ? String(inputType) : null,
          ]);
        },
      }),
    );

    expect(print(ast)).to.deep.equal(
      print(parse('{ human(id: 4) { name, pets }, alien }')),
    );

    expect(print(editedAST)).to.deep.equal(
      print(
        parse(
          '{ human(id: 4) { name, pets { __typename } }, alien { __typename } }',
        ),
      ),
    );

    expect(visited).to.deep.equal([
      ['enter', 'Document', null, null, null, null],
      ['enter', 'OperationDefinition', null, null, 'QueryRoot', null],
      ['enter', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null],
      ['enter', 'Field', null, 'QueryRoot', 'Human', null],
      ['enter', 'Name', 'human', 'QueryRoot', 'Human', null],
      ['leave', 'Name', 'human', 'QueryRoot', 'Human', null],
      ['enter', 'Argument', null, 'QueryRoot', 'Human', 'ID'],
      ['enter', 'Name', 'id', 'QueryRoot', 'Human', 'ID'],
      ['leave', 'Name', 'id', 'QueryRoot', 'Human', 'ID'],
      ['enter', 'IntValue', null, 'QueryRoot', 'Human', 'ID'],
      ['leave', 'IntValue', null, 'QueryRoot', 'Human', 'ID'],
      ['leave', 'Argument', null, 'QueryRoot', 'Human', 'ID'],
      ['enter', 'SelectionSet', null, 'Human', 'Human', null],
      ['enter', 'Field', null, 'Human', 'String', null],
      ['enter', 'Name', 'name', 'Human', 'String', null],
      ['leave', 'Name', 'name', 'Human', 'String', null],
      ['leave', 'Field', null, 'Human', 'String', null],
      ['enter', 'Field', null, 'Human', '[Pet]', null],
      ['enter', 'Name', 'pets', 'Human', '[Pet]', null],
      ['leave', 'Name', 'pets', 'Human', '[Pet]', null],
      ['enter', 'SelectionSet', null, 'Pet', '[Pet]', null],
      ['enter', 'Field', null, 'Pet', 'String!', null],
      ['enter', 'Name', '__typename', 'Pet', 'String!', null],
      ['leave', 'Name', '__typename', 'Pet', 'String!', null],
      ['leave', 'Field', null, 'Pet', 'String!', null],
      ['leave', 'SelectionSet', null, 'Pet', '[Pet]', null],
      ['leave', 'Field', null, 'Human', '[Pet]', null],
      ['leave', 'SelectionSet', null, 'Human', 'Human', null],
      ['leave', 'Field', null, 'QueryRoot', 'Human', null],
      ['enter', 'Field', null, 'QueryRoot', 'Alien', null],
      ['enter', 'Name', 'alien', 'QueryRoot', 'Alien', null],
      ['leave', 'Name', 'alien', 'QueryRoot', 'Alien', null],
      ['enter', 'SelectionSet', null, 'Alien', 'Alien', null],
      ['enter', 'Field', null, 'Alien', 'String!', null],
      ['enter', 'Name', '__typename', 'Alien', 'String!', null],
      ['leave', 'Name', '__typename', 'Alien', 'String!', null],
      ['leave', 'Field', null, 'Alien', 'String!', null],
      ['leave', 'SelectionSet', null, 'Alien', 'Alien', null],
      ['leave', 'Field', null, 'QueryRoot', 'Alien', null],
      ['leave', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null],
      ['leave', 'OperationDefinition', null, null, 'QueryRoot', null],
      ['leave', 'Document', null, null, null, null],
    ]);
  });
});
