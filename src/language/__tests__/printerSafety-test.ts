import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { SelectionSetNode, TypeNode, ValueNode } from '../ast';
import { Kind } from '../kinds';
import { parse, parseValue } from '../parser';
import { print, printForError } from '../printer';
import { reduce } from '../reducer';

describe('Printer: bounded indentation and iterative reduction', () => {
  it('limits indentation only when requested', () => {
    const ast = parse('{ a { b { c } } }');
    expect(print(ast, { maxIndentDepth: 0 })).to.equal('{ a { b { c } } }');
    expect(print(ast, { maxIndentDepth: 1 })).to.equal('{\n  a { b { c } }\n}');
    expect(print(ast, {})).to.equal(print(ast));
  });
  it('keeps block string line breaks', () => {
    const ast = parseValue('"""first\nsecond"""');
    expect(print(ast, { maxIndentDepth: 0 })).to.equal(print(ast));
  });
  it('caps error indentation at 100 levels', () => {
    let selectionSet: SelectionSetNode = {
      kind: Kind.SELECTION_SET,
      selections: [],
    };
    for (let i = 0; i < 300; i++) {
      selectionSet = {
        kind: Kind.SELECTION_SET,
        selections: [
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'a' },
            selectionSet,
          },
        ],
      };
    }
    const full = print(selectionSet);
    const bounded = printForError(selectionSet);
    expect(full).to.include('\n' + ' '.repeat(201));
    expect(bounded).to.include('\n' + ' '.repeat(200));
    expect(bounded).not.to.include('\n' + ' '.repeat(201));
    expect(bounded.replace(/\s/g, '')).to.equal(full.replace(/\s/g, ''));
  });
  it('prints deeply nested types without recursion', () => {
    let type: TypeNode = {
      kind: Kind.NAMED_TYPE,
      name: { kind: Kind.NAME, value: 'T' },
    };
    for (let i = 0; i < 10000; i++) {
      type = { kind: Kind.LIST_TYPE, type };
    }
    expect(print(type)).to.equal('['.repeat(10000) + 'T' + ']'.repeat(10000));
  });
  it('does not mutate frozen or shared input nodes', () => {
    const value = Object.freeze(parseValue('[1, 2]'));
    const ast: ValueNode = Object.freeze({
      kind: Kind.LIST,
      values: Object.freeze([value, value]),
    });
    expect(print(ast)).to.equal('[[1, 2], [1, 2]]');
    expect(print(ast)).to.equal('[[1, 2], [1, 2]]');
  });
  it('keeps missing and non-node reduction results', () => {
    expect(reduce(parseValue('1'), {})).to.equal(undefined);
    expect(
      reduce<unknown>(parseValue('[1, 2]'), {
        IntValue: () => null,
        ListValue: (node) => node.values,
      }),
    ).to.deep.equal([null, null]);
  });
});
