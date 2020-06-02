import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import { getOperationAST } from '../getOperationAST';

describe('getOperationAST', () => {
  it('Gets an operation from a simple document', () => {
    const doc = parse('{ field }');
    expect(getOperationAST(doc)).to.equal(doc.definitions[0]);
  });

  it('Gets an operation from a document with named op (mutation)', () => {
    const doc = parse('mutation Test { field }');
    expect(getOperationAST(doc)).to.equal(doc.definitions[0]);
  });

  it('Gets an operation from a document with named op (subscription)', () => {
    const doc = parse('subscription Test { field }');
    expect(getOperationAST(doc)).to.equal(doc.definitions[0]);
  });

  it('Does not get missing operation', () => {
    const doc = parse('type Foo { field: String }');
    expect(getOperationAST(doc)).to.equal(null);
  });

  it('Does not get ambiguous unnamed operation', () => {
    const doc = parse(`
      { field }
      mutation Test { field }
      subscription TestSub { field }
    `);
    expect(getOperationAST(doc)).to.equal(null);
  });

  it('Does not get ambiguous named operation', () => {
    const doc = parse(`
      query TestQ { field }
      mutation TestM { field }
      subscription TestS { field }
    `);
    expect(getOperationAST(doc)).to.equal(null);
  });

  it('Does not get misnamed operation', () => {
    const doc = parse(`
      { field }

      query TestQ { field }
      mutation TestM { field }
      subscription TestS { field }
    `);
    expect(getOperationAST(doc, 'Unknown')).to.equal(null);
  });

  it('Gets named operation', () => {
    const doc = parse(`
      query TestQ { field }
      mutation TestM { field }
      subscription TestS { field }
    `);
    expect(getOperationAST(doc, 'TestQ')).to.equal(doc.definitions[0]);
    expect(getOperationAST(doc, 'TestM')).to.equal(doc.definitions[1]);
    expect(getOperationAST(doc, 'TestS')).to.equal(doc.definitions[2]);
  });
});
