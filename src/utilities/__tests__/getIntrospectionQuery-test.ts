import { expect } from 'chai';
import { describe, it } from 'mocha';

import { getIntrospectionQuery } from '../getIntrospectionQuery';

describe('getIntrospectionQuery', () => {
  it('skip all "description" fields', () => {
    expect(getIntrospectionQuery()).to.match(/\bdescription\b/);

    expect(getIntrospectionQuery({ descriptions: true })).to.match(
      /\bdescription\b/,
    );

    expect(getIntrospectionQuery({ descriptions: false })).to.not.match(
      /\bdescription\b/,
    );
  });

  it('include "isRepeatable" field on directives', () => {
    expect(getIntrospectionQuery()).to.not.match(/\bisRepeatable\b/);

    expect(getIntrospectionQuery({ directiveIsRepeatable: true })).to.match(
      /\bisRepeatable\b/,
    );

    expect(
      getIntrospectionQuery({ directiveIsRepeatable: false }),
    ).to.not.match(/\bisRepeatable\b/);
  });

  it('include "description" field on schema', () => {
    expect(getIntrospectionQuery().match(/\bdescription\b/g)).to.have.lengthOf(
      5,
    );

    expect(
      getIntrospectionQuery({ schemaDescription: false }).match(
        /\bdescription\b/g,
      ),
    ).to.have.lengthOf(5);

    expect(
      getIntrospectionQuery({ schemaDescription: true }).match(
        /\bdescription\b/g,
      ),
    ).to.have.lengthOf(6);

    expect(
      getIntrospectionQuery({ descriptions: false, schemaDescription: true }),
    ).to.not.match(/\bdescription\b/);
  });

  it('include "specifiedByUrl" field', () => {
    expect(getIntrospectionQuery()).to.not.match(/\bspecifiedByUrl\b/);

    expect(getIntrospectionQuery({ specifiedByUrl: true })).to.match(
      /\bspecifiedByUrl\b/,
    );

    expect(getIntrospectionQuery({ specifiedByUrl: false })).to.not.match(
      /\bspecifiedByUrl\b/,
    );
  });
});
