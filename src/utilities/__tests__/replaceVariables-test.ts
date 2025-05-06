import { expect } from 'chai';
import { describe, it } from 'mocha';

import { invariant } from '../../jsutils/invariant.js';
import type { ReadOnlyObjMap } from '../../jsutils/ObjMap.js';

import type {
  FragmentArgumentNode,
  FragmentSpreadNode,
  ValueNode,
  VariableDefinitionNode,
} from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import { Parser, parseValue as _parseValue } from '../../language/parser.js';
import { TokenKind } from '../../language/tokenKind.js';

import { GraphQLInt } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { getVariableSignature } from '../../execution/getVariableSignature.js';
import {
  getFragmentVariableValues,
  getVariableValues,
} from '../../execution/values.js';

import { replaceVariables } from '../replaceVariables.js';

function parseValue(ast: string): ValueNode {
  return _parseValue(ast, { noLocation: true });
}

function testVariables(variableDefs: string, inputs: ReadOnlyObjMap<unknown>) {
  const variableValuesOrErrors = getVariableValues(
    new GraphQLSchema({ types: [GraphQLInt] }),
    parseVariableDefinitions(variableDefs),
    inputs,
  );
  invariant(variableValuesOrErrors.variableValues !== undefined);
  return variableValuesOrErrors.variableValues;
}

function parseVariableDefinitions(
  variableDefs: string,
): ReadonlyArray<VariableDefinitionNode> {
  const parser = new Parser(variableDefs, { noLocation: true });
  parser.expectToken(TokenKind.SOF);
  return parser.parseVariableDefinitions() ?? [];
}

function testFragmentVariables(variableDefs: string, fragmentArgs: string) {
  const schema = new GraphQLSchema({ types: [GraphQLInt] });
  const fragmentSignatures = Object.create(null);
  for (const varDef of parseVariableDefinitions(variableDefs)) {
    const signature = getVariableSignature(schema, varDef);
    fragmentSignatures[signature.name] = signature;
  }
  const spread: FragmentSpreadNode = {
    kind: Kind.FRAGMENT_SPREAD,
    name: { kind: Kind.NAME, value: 'TestFragment' },
    arguments: parseFragmentArguments(fragmentArgs),
  };
  return getFragmentVariableValues(
    spread,
    fragmentSignatures,
    Object.create(null),
    undefined,
  );
}

function parseFragmentArguments(
  fragmentArguments: string,
): ReadonlyArray<FragmentArgumentNode> {
  const parser = new Parser(fragmentArguments, { noLocation: true });
  parser.expectToken(TokenKind.SOF);
  return parser.parseFragmentArguments() ?? [];
}

describe('replaceVariables', () => {
  describe('Operation Variables', () => {
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
      expect(replaceVariables(ast, undefined)).to.deep.equal(
        parseValue('null'),
      );
    });

    it('replaces missing variable declaration with null', () => {
      const ast = parseValue('$var');
      const vars = testVariables('', {});
      expect(replaceVariables(ast, vars)).to.deep.equal(parseValue('null'));
    });

    it('replaces misspelled variable declaration with null', () => {
      const ast = parseValue('$var1');
      const vars = testVariables('($var2: Int)', { var2: 123 });
      expect(replaceVariables(ast, vars)).to.deep.equal(parseValue('null'));
    });

    it('replaces missing Variables in lists with null', () => {
      const ast = parseValue('[1, $var]');
      expect(replaceVariables(ast, undefined)).to.deep.equal(
        parseValue('[1, null]'),
      );
    });

    it('omits missing Variables from objects', () => {
      const ast = parseValue('{ foo: 1, bar: $var }');
      const vars = testVariables('($wrongVar: Int)', { var: 123 });
      expect(replaceVariables(ast, vars)).to.deep.equal(
        parseValue('{ foo: 1 }'),
      );
    });
  });

  describe('Fragment Variables', () => {
    it('replaces simple Fragment Variables', () => {
      const ast = parseValue('$var');
      const fragmentVars = testFragmentVariables('($var: Int)', `(var: 123)`);
      expect(replaceVariables(ast, undefined, fragmentVars)).to.deep.equal(
        parseValue('123'),
      );
    });

    it('replaces simple Fragment Variables even when overlapping with Operation Variables', () => {
      const ast = parseValue('$var');
      const operationVars = testVariables('($var: Int)', { var: 123 });
      const fragmentVars = testFragmentVariables('($var: Int)', '(var: 456)');
      expect(replaceVariables(ast, operationVars, fragmentVars)).to.deep.equal(
        parseValue('456'),
      );
    });

    it('replaces Fragment Variables with default values', () => {
      const ast = parseValue('$var');
      const fragmentVars = testFragmentVariables('($var: Int = 123)', '');
      expect(replaceVariables(ast, undefined, fragmentVars)).to.deep.equal(
        parseValue('123'),
      );
    });

    it('replaces Fragment Variables with default values even when overlapping with Operation Variables', () => {
      const ast = parseValue('$var');
      const operationVars = testVariables('($var: Int = 123)', {});
      const fragmentVars = testFragmentVariables('($var: Int = 456)', '');
      expect(replaceVariables(ast, operationVars, fragmentVars)).to.deep.equal(
        parseValue('456'),
      );
    });

    it('replaces nested Fragment Variables', () => {
      const ast = parseValue('{ foo: [ $var ], bar: $var }');
      const fragmentVars = testFragmentVariables('($var: Int)', '(var: 123)');
      expect(replaceVariables(ast, undefined, fragmentVars)).to.deep.equal(
        parseValue('{ foo: [ 123 ], bar: 123 }'),
      );
    });

    it('replaces nested Fragment Variables even when overlapping with Operation Variables', () => {
      const ast = parseValue('{ foo: [ $var ], bar: $var }');
      const operationVars = testVariables('($var: Int)', { var: 123 });
      const fragmentVars = testFragmentVariables('($var: Int)', '(var: 456)');
      expect(replaceVariables(ast, operationVars, fragmentVars)).to.deep.equal(
        parseValue('{ foo: [ 456 ], bar: 456 }'),
      );
    });

    it('replaces missing Fragment Variables with null', () => {
      const ast = parseValue('$var');
      expect(replaceVariables(ast, undefined, undefined)).to.deep.equal(
        parseValue('null'),
      );
    });

    it('replaces missing Fragment Variables with null even when overlapping with Operation Variables', () => {
      const ast = parseValue('$var');
      const operationVars = testVariables('($var: Int)', { var: 123 });
      const fragmentVars = testFragmentVariables('($var: Int)', '');
      expect(replaceVariables(ast, operationVars, fragmentVars)).to.deep.equal(
        parseValue('null'),
      );
    });

    it('replaces missing Fragment Variables in lists with null', () => {
      const ast = parseValue('[1, $var]');
      expect(replaceVariables(ast, undefined, undefined)).to.deep.equal(
        parseValue('[1, null]'),
      );
    });

    it('replaces missing Fragment Variables in lists with null even when overlapping with Operation Variables', () => {
      const ast = parseValue('[1, $var]');
      const operationVars = testVariables('($var: Int)', { var: 123 });
      const fragmentVars = testFragmentVariables('($var: Int)', '');
      expect(replaceVariables(ast, operationVars, fragmentVars)).to.deep.equal(
        parseValue('[1, null]'),
      );
    });

    it('omits missing Fragment Variables from objects', () => {
      const ast = parseValue('{ foo: 1, bar: $var }');
      expect(replaceVariables(ast, undefined, undefined)).to.deep.equal(
        parseValue('{ foo: 1 }'),
      );
    });

    it('omits missing Fragment Variables from objects even when overlapping with Operation Variables', () => {
      const ast = parseValue('{ foo: 1, bar: $var }');
      const operationVars = testVariables('($var: Int)', { var: 123 });
      const fragmentVars = testFragmentVariables('($var: Int)', '');
      expect(replaceVariables(ast, operationVars, fragmentVars)).to.deep.equal(
        parseValue('{ foo: 1 }'),
      );
    });
  });
});
