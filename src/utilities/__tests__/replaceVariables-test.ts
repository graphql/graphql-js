import { expect } from 'chai';
import { describe, it } from 'mocha';

import { invariant } from '../../jsutils/invariant.js';
import type { ReadOnlyObjMap } from '../../jsutils/ObjMap.js';

import type { ValueNode } from '../../language/ast.js';
import { Parser, parseValue as _parseValue } from '../../language/parser.js';
import { TokenKind } from '../../language/tokenKind.js';

import { GraphQLInt } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { getVariableValues } from '../../execution/values.js';

import { replaceVariables } from '../replaceVariables.js';

function parseValue(ast: string): ValueNode {
  return _parseValue(ast, { noLocation: true });
}

function testVariables(variableDefs: string, inputs: ReadOnlyObjMap<unknown>) {
  const parser = new Parser(variableDefs, { noLocation: true });
  parser.expectToken(TokenKind.SOF);
  const variableValuesOrErrors = getVariableValues(
    new GraphQLSchema({ types: [GraphQLInt] }),
    parser.parseVariableDefinitions(),
    inputs,
  );
  invariant(variableValuesOrErrors.variableValues !== undefined);
  return variableValuesOrErrors.variableValues;
}

describe('replaceVariables', () => {
  it('does not change simple AST', () => {
    const ast = parseValue('null');
    expect(replaceVariables(ast, undefined)).to.equal(ast);
  });

  it('replaces simple Variables', () => {
    const ast = parseValue('$var');
    const vars = testVariables('($var: Int)', { var: 123 });
    expect(replaceVariables(ast, vars)).to.deep.equal(parseValue('123'));
  });

  it('replaces Variables with default values', () => {
    const ast = parseValue('$var');
    const vars = testVariables('($var: Int = 123)', {});
    expect(replaceVariables(ast, vars)).to.deep.equal(parseValue('123'));
  });

  it('replaces nested Variables', () => {
    const ast = parseValue('{ foo: [ $var ], bar: $var }');
    const vars = testVariables('($var: Int)', { var: 123 });
    expect(replaceVariables(ast, vars)).to.deep.equal(
      parseValue('{ foo: [ 123 ], bar: 123 }'),
    );
  });

  it('replaces missing Variables with null', () => {
    const ast = parseValue('$var');
    expect(replaceVariables(ast, undefined)).to.deep.equal(parseValue('null'));
  });

  it('replaces missing Variables in lists with null', () => {
    const ast = parseValue('[1, $var]');
    expect(replaceVariables(ast, undefined)).to.deep.equal(
      parseValue('[1, null]'),
    );
  });

  it('omits missing Variables from objects', () => {
    const ast = parseValue('{ foo: 1, bar: $var }');
    expect(replaceVariables(ast, undefined)).to.deep.equal(
      parseValue('{ foo: 1 }'),
    );
  });
});
