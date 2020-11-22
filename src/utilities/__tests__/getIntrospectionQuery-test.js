import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { IntrospectionOptions } from '../getIntrospectionQuery';
import { getIntrospectionQuery } from '../getIntrospectionQuery';

function expectIntrospectionQuery(options?: IntrospectionOptions) {
  const query = getIntrospectionQuery(options);

  return {
    toMatch(name: string, times: number = 1): void {
      const pattern = toRegExp(name);

      expect(query).to.match(pattern);
      expect(query.match(pattern)).to.have.lengthOf(times);
    },
    toNotMatch(name: string): void {
      expect(query).to.not.match(toRegExp(name));
    },
  };

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

  it('include "specifiedByUrl" field', () => {
    expectIntrospectionQuery().toNotMatch('specifiedByUrl');

    expectIntrospectionQuery({ specifiedByUrl: true }).toMatch(
      'specifiedByUrl',
    );

    expectIntrospectionQuery({ specifiedByUrl: false }).toNotMatch(
      'specifiedByUrl',
    );
  });
});
