import { describe, it } from 'node:test';

import { expect } from 'chai';

import type { ASTNode, TypeNode } from '../ast.ts';
import { Kind } from '../kinds.ts';
import { parse, parseValue } from '../parser.ts';
import type { ASTReducer } from '../reducer.ts';
import { reduce } from '../reducer.ts';
import { BREAK } from '../visitor.ts';

describe('reduce', () => {
  it('rejects invalid nodes', () => {
    expect(() => reduce({} as ASTNode, {})).to.throw('Invalid AST Node: {}.');
  });

  it('rejects missing or invalid node kinds', () => {
    const invalidNodes: ReadonlyArray<unknown> = [
      null,
      { kind: 'Unknown' },
      { kind: 'constructor' },
      { kind: ['Name'] },
    ];
    for (const node of invalidNodes) {
      expect(() => reduce(node as ASTNode, {})).to.throw('Invalid AST Node:');
    }
  });

  it('reduces children before their parent', () => {
    const ast = parse('{ a b { c } }', { noLocation: true });
    const snapshot = JSON.stringify(ast);
    const count = reduce<number>(ast, {
      Field: (node) => 1 + (node.selectionSet ?? 0),
      SelectionSet: (node) =>
        node.selections.reduce((sum, value) => (sum ?? 0) + (value ?? 0), 0),
      OperationDefinition: (node) => node.selectionSet,
      Document: (node) => node.definitions[0],
    });
    expect(count).to.equal(3);
    expect(JSON.stringify(ast)).to.equal(snapshot);
  });

  it('reduces deeply nested nodes without recursion', () => {
    let type: TypeNode = {
      kind: Kind.NAMED_TYPE,
      name: { kind: Kind.NAME, value: 'T' },
    };
    for (let depth = 0; depth < 10_000; depth++) {
      type = { kind: Kind.LIST_TYPE, type };
    }

    let count = 0;
    reduce(type, {
      ListType: () => {
        count++;
      },
    });
    expect(count).to.equal(10_000);
  });

  it('uses undefined for missing callbacks', () => {
    expect(reduce(parseValue('1'), {})).to.equal(undefined);
    expect(
      reduce(parseValue('[1, 2]'), { ListValue: (node) => node.values }),
    ).to.deep.equal([undefined, undefined]);
    const values: Array<string> = [];
    expect(
      reduce(parseValue('[1, 2]'), {
        IntValue: (node) => values.push(node.value),
      }),
    ).to.equal(undefined);
    expect(values).to.deep.equal(['1', '2']);
  });
  for (const [label, value] of [
    ['false', false],
    ['null', null],
    ['undefined', undefined],
    ['BREAK', BREAK],
    ['array', [1, 2]],
    ['AST node', { kind: 'IntValue', value: '3' }],
  ] as const) {
    it(`retains ${label} as a reduced value`, () => {
      const reducer: ASTReducer<unknown> = {
        IntValue: () => value,
        ListValue: (node) => node.values,
      };
      expect(reduce(parseValue('1'), reducer)).to.equal(value);
      expect(reduce(parseValue('[1, 2]'), reducer)).to.deep.equal([
        value,
        value,
      ]);
      expect(
        reduce(parseValue('[1, 2]'), {
          ...reducer,
          ListValue: () => value,
        }),
      ).to.equal(value);
    });
  }
});
