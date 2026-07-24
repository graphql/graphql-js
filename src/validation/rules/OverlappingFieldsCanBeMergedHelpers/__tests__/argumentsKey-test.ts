import { describe, it } from 'node:test';

import { expect } from 'chai';

import type {
  FieldNode,
  OperationDefinitionNode,
} from '../../../../language/ast.ts';
import { parse } from '../../../../language/parser.ts';

import type { VariableScope } from '../argumentsKey.ts';
import { argumentsKey } from '../argumentsKey.ts';

function key(args: string, variableScope?: VariableScope): string {
  const operation = parse(`{ field(${args}) }`)
    .definitions[0] as OperationDefinitionNode;
  const field = operation.selectionSet.selections[0] as FieldNode;
  return argumentsKey(field.arguments, variableScope);
}

describe('argumentsKey', () => {
  it('ignores argument order', () => {
    expect(key('a: 1, b: 2')).to.equal(key('b: 2, a: 1'));
  });

  it('ignores input-object field order', () => {
    expect(key('a: { x: [null, $value], y: true }, b: ENUM')).to.equal(
      key('b: ENUM, a: { y: true, x: [null, $value] }'),
    );
  });

  it('uses the last duplicate argument value', () => {
    expect(key('a: 1, a: 2')).to.equal(key('a: 2'));
  });

  it('distinguishes null and string values', () => {
    expect(key('a: null')).not.to.equal(key('a: "null"'));
  });

  it('distinguishes lexical fragment scopes', () => {
    const firstScope = new Map([['value', 'first:value']]);
    const secondScope = new Map([['value', 'second:value']]);

    expect(key('a: $value', firstScope)).not.to.equal(
      key('a: $value', secondScope),
    );
  });

  it('distinguishes operation and fragment variables', () => {
    const fragmentScope = new Map([['value', 'fragment:value']]);

    expect(key('a: $value')).not.to.equal(key('a: $value', fragmentScope));
  });
});
