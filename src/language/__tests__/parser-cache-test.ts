import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { isPromise } from '../../jsutils/isPromise.js';

import type { DocumentNode } from '../ast.js';
import type { ParseCache } from '../parser.js';
import { parse, parseSync } from '../parser.js';

describe('Parser Cache', () => {
  const fooDocument = {
    kind: 'Document',
    definitions: [
      {
        kind: 'OperationDefinition',
        name: undefined,
        operation: 'query',
        selectionSet: {
          kind: 'SelectionSet',
          selections: [
            {
              alias: undefined,
              arguments: undefined,
              directives: undefined,
              kind: 'Field',
              loc: { start: 2, end: 5 },
              name: {
                kind: 'Name',
                value: 'foo',
                loc: { start: 2, end: 5 },
              },
              selectionSet: undefined,
            },
          ],
          loc: { start: 0, end: 7 },
        },
        variableDefinitions: undefined,
        directives: undefined,
        loc: { start: 0, end: 7 },
      },
    ],
    loc: { start: 0, end: 7 },
  };

  it('parses asynchronously using asynchronous cache', async () => {
    let cachedDocument: DocumentNode | Error | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache: ParseCache = {
      set: async (resultedDocument) => {
        await resolveOnNextTick();
        cachedDocument = resultedDocument;
      },
      get: () => {
        getAttempts++;
        if (cachedDocument) {
          cacheHits++;
        }
        return Promise.resolve(cachedDocument);
      },
    };

    const firstDocumentPromise = parse('{ foo }', {
      cache: customCache,
    });
    expect(isPromise(firstDocumentPromise)).to.equal(true);
    const firstDocument = await firstDocumentPromise;

    expectJSON(firstDocument).toDeepEqual(fooDocument);
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    const secondDocumentPromise = parse('{ foo }', {
      cache: customCache,
    });

    expect(isPromise(secondDocumentPromise)).to.equal(true);

    const secondErrors = await secondDocumentPromise;
    expectJSON(secondErrors).toDeepEqual(fooDocument);
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('parses synchronously using cache with sync getter and async setter', async () => {
    let cachedDocument: DocumentNode | Error | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache: ParseCache = {
      set: async (resultedDocument) => {
        await resolveOnNextTick();
        cachedDocument = resultedDocument;
      },
      get: () => {
        getAttempts++;
        if (cachedDocument) {
          cacheHits++;
        }
        return cachedDocument;
      },
    };

    const firstDocument = parse('{ foo }', {
      cache: customCache,
    });

    expectJSON(firstDocument).toDeepEqual(fooDocument);
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    await resolveOnNextTick();

    const secondErrors = parse('{ foo }', {
      cache: customCache,
    });

    expectJSON(secondErrors).toDeepEqual(fooDocument);
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('parses asynchronously using cache with async getter and sync setter', async () => {
    let cachedDocument: DocumentNode | Error | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache: ParseCache = {
      set: (resultedDocument) => {
        cachedDocument = resultedDocument;
      },
      get: () => {
        getAttempts++;
        if (cachedDocument) {
          cacheHits++;
        }
        return Promise.resolve(cachedDocument);
      },
    };

    const firstDocumentPromise = parse('{ foo }', {
      cache: customCache,
    });
    const firstDocument = await firstDocumentPromise;

    expectJSON(firstDocument).toDeepEqual(fooDocument);
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    const secondDocumentPromise = parse('{ foo }', {
      cache: customCache,
    });

    expect(isPromise(secondDocumentPromise)).to.equal(true);

    const secondErrors = await secondDocumentPromise;
    expectJSON(secondErrors).toDeepEqual(fooDocument);
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('parseSync parses synchronously using synchronous cache', () => {
    let cachedDocument: DocumentNode | Error | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache: ParseCache = {
      set: (resultedDocument) => {
        cachedDocument = resultedDocument;
      },
      get: () => {
        getAttempts++;
        if (cachedDocument) {
          cacheHits++;
        }
        return cachedDocument;
      },
    };

    const firstDocument = parseSync('{ foo }', {
      cache: customCache,
    });

    expectJSON(firstDocument).toDeepEqual(fooDocument);
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    const secondErrors = parseSync('{ foo }', {
      cache: customCache,
    });

    expectJSON(secondErrors).toDeepEqual(fooDocument);
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('parseSync throws using asynchronous cache', () => {
    let cachedDocument: DocumentNode | Error | undefined;
    const customCache: ParseCache = {
      set: async (resultedDocument) => {
        await resolveOnNextTick();
        cachedDocument = resultedDocument;
      },
      get: () => Promise.resolve(cachedDocument),
    };

    expect(() =>
      parseSync('{ foo }', {
        cache: customCache,
      }),
    ).to.throw('GraphQL parsing failed to complete synchronously.');
  });

  it('parseSync parses synchronously using sync getter and async setter', async () => {
    let cachedDocument: DocumentNode | Error | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache: ParseCache = {
      set: async (resultedDocument) => {
        await resolveOnNextTick();
        cachedDocument = resultedDocument;
      },
      get: () => {
        getAttempts++;
        if (cachedDocument) {
          cacheHits++;
        }
        return cachedDocument;
      },
    };

    const firstDocument = parseSync('{ foo }', {
      cache: customCache,
    });

    await resolveOnNextTick();

    expectJSON(firstDocument).toDeepEqual(fooDocument);
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    const secondErrors = parseSync('{ foo }', {
      cache: customCache,
    });

    expectJSON(secondErrors).toDeepEqual(fooDocument);
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('parseSync throws using asynchronous cache', () => {
    let cachedDocument: DocumentNode | Error | undefined;
    const customCache: ParseCache = {
      set: async (resultedDocument) => {
        await resolveOnNextTick();
        cachedDocument = resultedDocument;
      },
      get: () => Promise.resolve(cachedDocument),
    };

    expect(() =>
      parseSync('{ foo }', {
        cache: customCache,
      }),
    ).to.throw('GraphQL parsing failed to complete synchronously.');
  });
});
