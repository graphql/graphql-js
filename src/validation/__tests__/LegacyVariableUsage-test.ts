import { describe, it } from 'node:test';

import { expect } from 'chai';

import type { GraphQLError } from '../../error/GraphQLError.ts';

import type { OperationDefinitionNode } from '../../language/ast.ts';
import { parse } from '../../language/parser.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { VariablesInAllowedPositionRule } from '../rules/VariablesInAllowedPositionRule.ts';
import { validate } from '../validate.ts';

const schema = buildSchema(`
  directive @withDefault(flag: Boolean! = true) on FIELD
  input Options { n: Int! = 5 }
  input Choice @oneOf { n: Int }
  type Query {
    required(n: Int!): Int
    defaulted(n: Int! = 5): Int
    nullable(n: Int): Int
    numbers(values: [Int!]!): Int
    options(input: Options): Int
    choice(input: Choice): Int
  }
`);

describe('Validate: strict and legacy variable usages', () => {
  const cases = [
    {
      name: 'variable default',
      source: 'query Q($v: Int = 0) { required(n: $v) }',
      strict: false,
      legacy: true,
    },
    {
      name: 'argument default',
      source: 'query Q($v: Int) { defaulted(n: $v) }',
      strict: false,
      legacy: true,
    },
    {
      name: 'both defaults',
      source: 'query Q($v: Int = 3) { defaulted(n: $v) }',
      strict: false,
      legacy: true,
    },
    {
      name: 'null variable default with argument default',
      source: 'query Q($v: Int = null) { defaulted(n: $v) }',
      strict: false,
      legacy: true,
    },
    {
      name: 'input field default',
      source: 'query Q($v: Int) { options(input: { n: $v }) }',
      strict: false,
      legacy: true,
    },
    {
      name: 'list item with variable default',
      source: 'query Q($v: Int = 3) { numbers(values: [1, $v, 3]) }',
      strict: false,
      legacy: true,
    },
    {
      name: 'nullable list with variable default',
      source: 'query Q($v: [Int!] = [1]) { numbers(values: $v) }',
      strict: false,
      legacy: true,
    },
    {
      name: 'nullable list items are incompatible even with a default',
      source: 'query Q($v: [Int] = [1]) { numbers(values: $v) }',
      strict: false,
      legacy: false,
    },
    {
      name: 'directive variable default',
      source:
        'query Q($v: Boolean = false) { required(n: 1) @include(if: $v) }',
      strict: false,
      legacy: true,
    },
    {
      name: 'directive argument default',
      source: 'query Q($v: Boolean) { required(n: 1) @withDefault(flag: $v) }',
      strict: false,
      legacy: true,
    },
    {
      name: 'non-null variable with default',
      source: 'query Q($v: Int! = 3) { required(n: $v) }',
      strict: true,
      legacy: true,
    },
    {
      name: 'non-null variable at nullable position',
      source: 'query Q($v: Int!) { nullable(n: $v) }',
      strict: true,
      legacy: true,
    },
    {
      name: 'nullable variable at nullable position',
      source: 'query Q($v: Int) { nullable(n: $v) }',
      strict: true,
      legacy: true,
    },
    {
      name: 'nullable variable without defaults',
      source: 'query Q($v: Int) { required(n: $v) }',
      strict: false,
      legacy: false,
    },
    {
      name: 'null variable default without location default',
      source: 'query Q($v: Int = null) { required(n: $v) }',
      strict: false,
      legacy: false,
    },
    {
      name: 'incompatible named types with defaults',
      source: 'query Q($v: Boolean = true) { defaulted(n: $v) }',
      strict: false,
      legacy: false,
    },
    {
      name: 'incompatible non-null types',
      source: 'query Q($v: Boolean!) { required(n: $v) }',
      strict: false,
      legacy: false,
    },
    {
      name: 'OneOf nullable variable with default',
      source: 'query Q($v: Int = 3) { choice(input: { n: $v }) }',
      strict: false,
      legacy: false,
    },
    {
      name: 'OneOf non-null variable',
      source: 'query Q($v: Int!) { choice(input: { n: $v }) }',
      strict: true,
      legacy: true,
    },
    {
      name: 'transitive fragment usage',
      source: `
        query Q($v: Int) { ...Outer }
        fragment Outer on Query { ...Inner }
        fragment Inner on Query { defaulted(n: $v) }
      `,
      strict: false,
      legacy: true,
    },
    {
      name: 'local fragment variable',
      source: `
        query Q { ...F }
        fragment F($v: Int = 3) on Query { required(n: $v) }
      `,
      strict: false,
      legacy: true,
    },
    {
      name: 'fragment argument',
      source: `
        query Q($v: Int = 3) { ...F(n: $v) }
        fragment F($n: Int!) on Query { required(n: $n) }
      `,
      strict: false,
      legacy: true,
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      const document = parse(testCase.source, {
        experimentalFragmentArguments: true,
      });
      const strictErrors = validate(schema, document);
      expect(strictErrors).to.have.lengthOf(testCase.strict ? 0 : 1);

      for (const allowLegacyVariableUsage of [false, true]) {
        const warnings: Array<GraphQLError> = [];
        const errors = validate(schema, document, undefined, {
          allowLegacyVariableUsage,
          onLegacyVariableUsage: (warning) => {
            warnings.push(warning);
          },
        });
        const valid = allowLegacyVariableUsage
          ? testCase.legacy
          : testCase.strict;
        expect(errors).to.have.lengthOf(valid ? 0 : 1);
        expect(warnings).to.deep.equal(
          allowLegacyVariableUsage && testCase.legacy ? strictErrors : [],
        );
      }
    });
  }

  it('attributes shared fragment warnings to each affected operation', () => {
    const document = parse(`
      query First($v: Int = 3) { ...F ...F }
      query Strict($v: Int!) { ...F }
      query Last($v: Int = 4) { ...F }
      fragment F on Query { required(n: $v) }
    `);
    const warnings: Array<GraphQLError> = [];
    const operations: Array<OperationDefinitionNode> = [];
    expect(
      validate(schema, document, undefined, {
        allowLegacyVariableUsage: true,
        onLegacyVariableUsage(warning, operation) {
          warnings.push(warning);
          operations.push(operation);
        },
      }),
    ).to.deep.equal([]);
    expect(warnings).to.deep.equal(validate(schema, document));
    expect(operations).to.deep.equal([
      document.definitions[0],
      document.definitions[2],
    ]);
    expect(warnings[0].locations).to.deep.equal([
      { line: 2, column: 19 },
      { line: 5, column: 41 },
    ]);
  });

  it('supports anonymous operations without source locations', () => {
    const document = parse('query($v: Int = 3) { required(n: $v) }', {
      noLocation: true,
    });
    const warnings: Array<GraphQLError> = [];
    expect(
      validate(schema, document, undefined, {
        allowLegacyVariableUsage: true,
        onLegacyVariableUsage(warning, operation) {
          expect(operation.name).to.equal(undefined);
          expect(warning.locations).to.equal(undefined);
          warnings.push(warning);
        },
      }),
    ).to.deep.equal([]);
    expect(warnings).to.have.lengthOf(1);
  });

  it('respects custom rule lists and does not mutate subsequent validations', () => {
    const document = parse('query Q($v: Int = 3) { required(n: $v) }');
    const warnings: Array<GraphQLError> = [];
    const options = {
      allowLegacyVariableUsage: true,
      onLegacyVariableUsage: (warning: GraphQLError) => warnings.push(warning),
    };
    expect(validate(schema, document, [], options)).to.deep.equal([]);
    expect(warnings).to.deep.equal([]);
    expect(
      validate(schema, document, [VariablesInAllowedPositionRule], options),
    ).to.deep.equal([]);
    expect(warnings).to.have.lengthOf(1);
    expect(validate(schema, document)).to.have.lengthOf(1);
  });

  it('propagates exceptions from the warning callback', () => {
    const document = parse('query Q($v: Int = 3) { required(n: $v) }');
    const failure = new Error('Logger failed');
    expect(() =>
      validate(schema, document, undefined, {
        allowLegacyVariableUsage: true,
        onLegacyVariableUsage() {
          throw failure;
        },
      }),
    ).to.throw(failure);
  });
});

describe('Validate: limit migration warnings independently of errors', () => {
  const fields = Array.from(
    { length: 102 },
    (_, i) => `field${i}: required(n: $v)`,
  ).join('\n');
  const document = parse(`query Q($v: Int = 3) { ${fields} }`);

  for (const maxWarnings of [undefined, 0, 1, Infinity]) {
    it(`limits warnings to ${maxWarnings ?? '100 by default'} without failing validation`, () => {
      const warnings: Array<GraphQLError> = [];
      expect(
        validate(schema, document, undefined, {
          allowLegacyVariableUsage: true,
          maxErrors: 0,
          maxWarnings,
          onLegacyVariableUsage: (warning) => {
            warnings.push(warning);
          },
        }),
      ).to.deep.equal([]);
      expect(warnings).to.have.lengthOf(Math.min(maxWarnings ?? 100, 102));
    });
  }

  it('continues reporting errors after the warning limit is reached', () => {
    const warnings: Array<GraphQLError> = [];
    const errors = validate(
      schema,
      parse(`
      query Q($v: Int = 3) { ${fields} }
      query Invalid { missing }
    `),
      undefined,
      {
        allowLegacyVariableUsage: true,
        maxWarnings: 1,
        onLegacyVariableUsage: (warning) => {
          warnings.push(warning);
        },
      },
    );
    expect(warnings).to.have.lengthOf(1);
    expect(errors.map((error) => error.message)).to.deep.equal([
      'Cannot query field "missing" on type "Query".',
    ]);
  });
});
