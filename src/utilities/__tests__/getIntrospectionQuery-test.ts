import { describe, it } from 'node:test';

import { expect } from 'chai';

import { parse } from '../../language/parser.ts';

import { validate } from '../../validation/validate.ts';

import { buildSchema } from '../buildASTSchema.ts';
import type { IntrospectionOptions } from '../getIntrospectionQuery.ts';
import { getIntrospectionQuery } from '../getIntrospectionQuery.ts';

const dummySchema = buildSchema(`
  type Query {
    dummy: String
  }
`);

function expectIntrospectionQuery(options?: IntrospectionOptions) {
  const query = getIntrospectionQuery(options);

  const validationErrors = validate(dummySchema, parse(query));
  expect(validationErrors).to.deep.equal([]);

  const helpers = {
    toMatch: (name: string, times: number = 1) => {
      const pattern = toRegExp(name);

      expect(query).to.match(pattern);
      expect(query.match(pattern)).to.have.lengthOf(times);
      return helpers;
    },
    toContain: (text: string) => {
      expect(query).to.include(text);
      return helpers;
    },
    toNotMatch: (name: string) => {
      expect(query).to.not.match(toRegExp(name));
      return helpers;
    },
    toNotContain: (text: string) => {
      expect(query).to.not.include(text);
      return helpers;
    },
  };

  return helpers;

  function toRegExp(name: string): RegExp {
    return new RegExp('\\b' + name + '\\b', 'g');
  }
}

describe('getIntrospectionQuery', () => {
  it('skip all "description" fields', () => {
    expectIntrospectionQuery().toMatch('description', 5);

    expectIntrospectionQuery({ descriptions: true }).toMatch('description', 5);

    expectIntrospectionQuery({ descriptions: false }).toNotMatch('description');
  });

  it('include "isRepeatable" field on directives', () => {
    expectIntrospectionQuery().toNotMatch('isRepeatable');

    expectIntrospectionQuery({ directiveIsRepeatable: true }).toMatch(
      'isRepeatable',
    );

    expectIntrospectionQuery({ directiveIsRepeatable: false }).toNotMatch(
      'isRepeatable',
    );
  });

  it('include "description" field on schema', () => {
    expectIntrospectionQuery().toMatch('description', 5);

    expectIntrospectionQuery({ schemaDescription: false }).toMatch(
      'description',
      5,
    );
    expectIntrospectionQuery({ schemaDescription: true }).toMatch(
      'description',
      6,
    );

    expectIntrospectionQuery({
      descriptions: false,
      schemaDescription: true,
    }).toNotMatch('description');
  });

  it('include "specifiedBy" field', () => {
    expectIntrospectionQuery().toNotMatch('specifiedByURL');

    expectIntrospectionQuery({ specifiedByUrl: true }).toMatch(
      'specifiedByURL',
    );

    expectIntrospectionQuery({ specifiedByUrl: false }).toNotMatch(
      'specifiedByURL',
    );
  });

  it('include "isDeprecated" field on input values', () => {
    expectIntrospectionQuery().toMatch('isDeprecated', 2);

    expectIntrospectionQuery({ inputValueDeprecation: true }).toMatch(
      'isDeprecated',
      3,
    );

    expectIntrospectionQuery({ inputValueDeprecation: false }).toMatch(
      'isDeprecated',
      2,
    );
  });

  it('include "deprecationReason" field on input values', () => {
    expectIntrospectionQuery().toMatch('deprecationReason', 2);

    expectIntrospectionQuery({ inputValueDeprecation: true }).toMatch(
      'deprecationReason',
      3,
    );

    expectIntrospectionQuery({ inputValueDeprecation: false }).toMatch(
      'deprecationReason',
      2,
    );
  });

  it('include "isOneOf" field on input objects', () => {
    expectIntrospectionQuery().toNotMatch('isOneOf');

    expectIntrospectionQuery({ oneOf: true }).toMatch('isOneOf', 1);

    expectIntrospectionQuery({ oneOf: false }).toNotMatch('isOneOf');
  });

  it('include deprecated input field and args', () => {
    expectIntrospectionQuery().toMatch('includeDeprecated: true', 2);

    expectIntrospectionQuery({ inputValueDeprecation: true }).toMatch(
      'includeDeprecated: true',
      5,
    );

    expectIntrospectionQuery({ inputValueDeprecation: false }).toMatch(
      'includeDeprecated: true',
      2,
    );
  });

  it('include "isDeprecated" field on directives', () => {
    expectIntrospectionQuery().toMatch('isDeprecated', 2);

    expectIntrospectionQuery({
      experimentalDirectiveDeprecation: true,
    }).toMatch('isDeprecated', 3);

    expectIntrospectionQuery({
      experimentalDirectiveDeprecation: false,
    }).toMatch('isDeprecated', 2);
  });

  it('include "deprecationReason" field on directives', () => {
    expectIntrospectionQuery()
      .toNotContain('directives(includeDeprecated: true) {')
      .toMatch('deprecationReason', 2);

    expectIntrospectionQuery({ experimentalDirectiveDeprecation: true })
      .toContain('directives(includeDeprecated: true) {')
      .toMatch('deprecationReason', 3);

    expectIntrospectionQuery({ experimentalDirectiveDeprecation: false })
      .toNotContain('directives(includeDeprecated: true) {')
      .toMatch('deprecationReason', 2);
  });

  it('throw error if typeDepth is too high', () => {
    expect(() => getIntrospectionQuery({ typeDepth: 101 })).to.throw(
      'Please set typeDepth to a reasonable value between 0 and 100; the default is 9.',
    );
  });
});
