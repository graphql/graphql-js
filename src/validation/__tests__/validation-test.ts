import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectJSON } from '../../__testUtils__/expectJSON.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DirectiveNode,
  OperationDefinitionNode,
} from '../../language/ast.ts';
import { parse } from '../../language/parser.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { VariablesInAllowedPositionRule } from '../rules/VariablesInAllowedPositionRule.ts';
import { validate } from '../validate.ts';
import type { ValidationContext } from '../ValidationContext.ts';

import { testSchema } from './harness.ts';

describe('Validate: Supports full validation', () => {
  it('validates queries', () => {
    const doc = parse(`
      query {
        human {
          pets {
            ... on Cat {
              meowsVolume
            }
            ... on Dog {
              barkVolume
            }
          }
        }
      }
    `);

    const errors = validate(testSchema, doc);
    expectJSON(errors).toDeepEqual([]);
  });

  it('detects unknown fields', () => {
    const doc = parse(`
      {
        unknown
      }
    `);

    const errors = validate(testSchema, doc);
    expectJSON(errors).toDeepEqual([
      {
        locations: [{ line: 3, column: 9 }],
        message: 'Cannot query field "unknown" on type "QueryRoot".',
      },
    ]);
  });

  it('validates using a custom rule', () => {
    const schema = buildSchema(`
      directive @custom(arg: String) on FIELD

      type Query {
        foo: String
      }
    `);

    const doc = parse(`
      query {
        name @custom
      }
    `);

    function customRule(context: ValidationContext) {
      return {
        Directive(node: DirectiveNode) {
          const directiveDef = context.getDirective();
          const error = new GraphQLError(
            'Reporting directive: ' + String(directiveDef),
            { nodes: node },
          );
          context.reportError(error);
        },
      };
    }

    const errors = validate(schema, doc, [customRule]);
    expectJSON(errors).toDeepEqual([
      {
        message: 'Reporting directive: @custom',
        locations: [{ line: 3, column: 14 }],
      },
    ]);
  });
});

describe('Validate: Limit maximum number of validation errors', () => {
  const query = `
    {
      firstUnknownField
      secondUnknownField
      thirdUnknownField
    }
  `;
  const doc = parse(query, { noLocation: true });

  function validateDocument(options: { maxErrors?: number }) {
    return validate(testSchema, doc, undefined, options);
  }

  function invalidFieldError(fieldName: string) {
    return {
      message: `Cannot query field "${fieldName}" on type "QueryRoot".`,
    };
  }

  it('when maxErrors is equal to number of errors', () => {
    const errors = validateDocument({ maxErrors: 3 });
    expectJSON(errors).toDeepEqual([
      invalidFieldError('firstUnknownField'),
      invalidFieldError('secondUnknownField'),
      invalidFieldError('thirdUnknownField'),
    ]);
  });

  it('when maxErrors is less than number of errors', () => {
    const errors = validateDocument({ maxErrors: 2 });
    expectJSON(errors).toDeepEqual([
      invalidFieldError('firstUnknownField'),
      invalidFieldError('secondUnknownField'),
      {
        message:
          'Too many validation errors, error limit reached. Validation aborted.',
      },
    ]);
  });

  it('passthrough exceptions from rules', () => {
    function customRule() {
      return {
        Field() {
          throw new Error('Error from custom rule!');
        },
      };
    }
    expect(() =>
      validate(testSchema, doc, [customRule], { maxErrors: 1 }),
    ).to.throw(/^Error from custom rule!$/);
  });
});

describe('operation and variable definition descriptions', () => {
  it('validates operation with description and variable descriptions', () => {
    const schema = buildSchema(
      'type Query { field(a: Int, b: String): String }',
    );
    const query = `
        "Operation description"
        query myQuery(
          "Variable a description"
          $a: Int,
          """Variable b\nmultiline description"""
          $b: String
        ) {
          field(a: $a, b: $b)
        }
      `;
    const ast = parse(query);
    const errors = validate(schema, ast);
    expect(errors.length).to.equal(0);
  });
});

describe('Validate: legacy variable usage warnings', () => {
  const schema = buildSchema('type Query { required(n: Int!): Int }');
  const document = parse(`
      query Q($v: Int = 3) {
        required(n: $v)
      }
    `);
  const variableUsageError = {
    message:
      'Variable "$v" of type "Int" used in position expecting type "Int!".',
    locations: [
      { line: 2, column: 15 },
      { line: 3, column: 21 },
    ],
  };

  it('attributes shared fragment warnings to each affected operation', () => {
    const doc = parse(`
      query First($v: Int = 3) {
        ...F
        ...F
      }
      query Strict($v: Int!) {
        ...F
      }
      query Last($v: Int = 4) {
        ...F
      }
      fragment F on Query {
        required(n: $v)
      }
    `);
    const warnings: Array<GraphQLError> = [];
    const operations: Array<OperationDefinitionNode> = [];

    const errors = validate(schema, doc, undefined, {
      allowLegacyVariableUsage: true,
      onLegacyVariableUsage(warning, operation) {
        warnings.push(warning);
        operations.push(operation);
      },
    });

    expectJSON(errors).toDeepEqual([]);
    expectJSON(warnings).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 2, column: 19 },
          { line: 13, column: 21 },
        ],
      },
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
        locations: [
          { line: 9, column: 18 },
          { line: 13, column: 21 },
        ],
      },
    ]);
    expect(operations).to.deep.equal([doc.definitions[0], doc.definitions[2]]);
  });

  it('supports anonymous operations without source locations', () => {
    const doc = parse('query($v: Int = 3) { required(n: $v) }', {
      noLocation: true,
    });
    const warnings: Array<GraphQLError> = [];

    const errors = validate(schema, doc, undefined, {
      allowLegacyVariableUsage: true,
      onLegacyVariableUsage(warning, operation) {
        expect(operation.name).to.equal(undefined);
        warnings.push(warning);
      },
    });

    expectJSON(errors).toDeepEqual([]);
    expectJSON(warnings).toDeepEqual([
      {
        message:
          'Variable "$v" of type "Int" used in position expecting type "Int!".',
      },
    ]);
  });

  it('does not warn when the variable usage rule is omitted', () => {
    const warnings: Array<GraphQLError> = [];

    const errors = validate(schema, document, [], {
      allowLegacyVariableUsage: true,
      onLegacyVariableUsage(warning) {
        warnings.push(warning);
      },
    });

    expectJSON(errors).toDeepEqual([]);
    expectJSON(warnings).toDeepEqual([]);
  });

  it('warns when the variable usage rule is explicitly selected', () => {
    const warnings: Array<GraphQLError> = [];

    const errors = validate(
      schema,
      document,
      [VariablesInAllowedPositionRule],
      {
        allowLegacyVariableUsage: true,
        onLegacyVariableUsage(warning) {
          warnings.push(warning);
        },
      },
    );

    expectJSON(errors).toDeepEqual([]);
    expectJSON(warnings).toDeepEqual([variableUsageError]);
  });

  it('does not change subsequent strict validations or warn in strict mode', () => {
    const legacyErrors = validate(schema, document, undefined, {
      allowLegacyVariableUsage: true,
    });
    expectJSON(legacyErrors).toDeepEqual([]);

    const warnings: Array<GraphQLError> = [];
    function onLegacyVariableUsage(warning: GraphQLError) {
      warnings.push(warning);
    }

    const defaultErrors = validate(schema, document, undefined, {
      onLegacyVariableUsage,
    });
    const strictErrors = validate(schema, document, undefined, {
      allowLegacyVariableUsage: false,
      onLegacyVariableUsage,
    });

    expectJSON(defaultErrors).toDeepEqual([variableUsageError]);
    expectJSON(strictErrors).toDeepEqual([variableUsageError]);
    expectJSON(warnings).toDeepEqual([]);
  });

  it('propagates exceptions from the warning callback', () => {
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

  it('reports every warning without consuming the error limit', () => {
    const fields = Array.from(
      { length: 102 },
      (_, i) => `field${i}: required(n: $v)`,
    ).join('\n');
    const doc = parse(`query Q($v: Int = 3) { ${fields} }`);
    const warnings: Array<GraphQLError> = [];

    const errors = validate(schema, doc, undefined, {
      allowLegacyVariableUsage: true,
      maxErrors: 0,
      onLegacyVariableUsage(warning) {
        warnings.push(warning);
      },
    });

    expectJSON(errors).toDeepEqual([]);
    expect(warnings).to.have.lengthOf(102);
  });

  it('reports validation errors alongside migration warnings', () => {
    const doc = parse(`
      query Q($v: Int = 3) {
        required(n: $v)
      }
      query Invalid {
        missing
      }
    `);
    const warnings: Array<GraphQLError> = [];

    const errors = validate(schema, doc, undefined, {
      allowLegacyVariableUsage: true,
      onLegacyVariableUsage(warning) {
        warnings.push(warning);
      },
    });

    expectJSON(warnings).toDeepEqual([variableUsageError]);
    expectJSON(errors).toDeepEqual([
      {
        message: 'Cannot query field "missing" on type "Query".',
        locations: [{ line: 6, column: 9 }],
      },
    ]);
  });
});
