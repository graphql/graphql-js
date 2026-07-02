import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type { GraphQLError } from '../../../error/GraphQLError.ts';

import { parse } from '../../../language/parser.ts';
import { visit } from '../../../language/visitor.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { validateWithRules } from '../../validateWithRules.ts';

import {
  KnownTypeNamesASTVisitor,
  KnownTypeNamesTypeSystemValidation,
} from '../KnownTypeNamesRule.ts';

import {
  createRuleValidationContext,
  expectSDLRuleErrors,
  getSDLRuleVisitor,
} from './harness.ts';

describe('Validate: KnownTypeNamesRule', () => {
  it('validates SDL type references', () => {
    expectSDLRuleErrors(
      KnownTypeNamesTypeSystemValidation,
      'type Query { field: [Missing!] }',
    ).toDeepEqual([{ message: 'Unknown type "Missing".' }]);
  });

  it('validates SDL extension type references', () => {
    expectSDLRuleErrors(
      KnownTypeNamesTypeSystemValidation,
      'extend type Query { field: Missing }',
    ).toDeepEqual([{ message: 'Unknown type "Missing".' }]);
  });

  it('reports duplicate unknown SDL type references', () => {
    expectSDLRuleErrors(
      KnownTypeNamesTypeSystemValidation,
      `
        type Query {
          first: Missing
          second: Missing
        }
      `,
    ).toDeepEqual([
      { message: 'Unknown type "Missing".' },
      { message: 'Unknown type "Missing".' },
    ]);
  });

  it('uses schema type names for executable-only validation rounds', () => {
    const schema = buildSchema(`
      type Query {
        field: Known
      }

      type Known {
        field: String
      }
    `);
    const doc = parse(
      `
        query ($value: Missing) {
          field {
            field
          }
        }

        fragment KnownFields on Known {
          field
        }

        fragment OtherKnownFields on Known {
          field
        }
      `,
      { noLocation: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: doc,
        rules: [KnownTypeNamesASTVisitor],
        schema,
      }),
    ).toDeepEqual([{ message: 'Unknown type "Missing".' }]);
  });

  it('reports standard scalar references missing from an executable-only schema', () => {
    const schema = buildSchema('type Query { field: String }');
    const doc = parse('query ($id: ID, $float: Float, $int: Int) { field }', {
      noLocation: true,
    });

    expectJSON(
      validateWithRules({
        documentAST: doc,
        rules: [KnownTypeNamesASTVisitor],
        schema,
      }),
    ).toDeepEqual([
      { message: 'Unknown type "ID".' },
      { message: 'Unknown type "Float".' },
      { message: 'Unknown type "Int".' },
    ]);
  });

  it('caches known executable type references against an SDL index', () => {
    const doc = parse(
      `
        type Query {
          field: Known
        }

        type Known {
          field: String
        }

        fragment KnownFields on Known {
          field
        }

        fragment OtherKnownFields on Known {
          field
        }
      `,
      { noLocation: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: doc,
        rules: [KnownTypeNamesASTVisitor],
      }),
    ).toDeepEqual([]);
  });

  it('suggests schema type names for executable-only validation rounds', () => {
    const schema = buildSchema(`
      type Query {
        field: Known
      }

      type Known {
        field: String
      }
    `);
    const doc = parse('fragment KnownFields on Know { field }', {
      noLocation: true,
    });

    expectJSON(
      validateWithRules({
        documentAST: doc,
        rules: [KnownTypeNamesASTVisitor],
        schema,
      }),
    ).toDeepEqual([{ message: 'Unknown type "Know". Did you mean "Known"?' }]);
  });

  it('reports executable-only type references without a schema', () => {
    const doc = parse('fragment Frag on Missing { field }', {
      noLocation: true,
    });
    const errors: Array<GraphQLError> = [];
    const context = createRuleValidationContext(doc, undefined, (error) => {
      errors.push(error);
    });

    visit(doc, getSDLRuleVisitor(KnownTypeNamesASTVisitor, context));

    expectJSON(errors).toDeepEqual([{ message: 'Unknown type "Missing".' }]);
  });

  it('can hide SDL type suggestions', () => {
    const doc = parse('type Query { field: QueryType }', {
      noLocation: true,
    });

    expectJSON(
      validateWithRules({
        documentAST: doc,
        typeSystemRules: [KnownTypeNamesTypeSystemValidation],
        hideSuggestions: true,
      }),
    ).toDeepEqual([{ message: 'Unknown type "QueryType".' }]);
  });

  it('validates type-system-only operation, interface, and union references', () => {
    expectSDLRuleErrors(
      KnownTypeNamesTypeSystemValidation,
      `
        schema {
          query: MissingQuery
        }

        extend schema @tag

        type Query implements MissingObjectInterface {
          field: String
        }

        interface Node implements MissingInterface {
          id: ID
        }

        union Search = MissingMember
        union EmptySearch

        input Filter {
          value: MissingInput
        }

        extend input Filter @tag
      `,
    ).toDeepEqual([
      { message: 'Unknown type "MissingQuery".' },
      { message: 'Unknown type "MissingObjectInterface".' },
      { message: 'Unknown type "MissingInterface".' },
      { message: 'Unknown type "MissingMember".' },
      { message: 'Unknown type "MissingInput".' },
    ]);
  });
});
