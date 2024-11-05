import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { isPromise } from '../../jsutils/isPromise.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import type { DirectiveNode } from '../../language/ast.js';
import { parseSync as parse } from '../../language/parser.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import type { ValidateCache } from '../validate.js';
import { validate, validateSync } from '../validate.js';
import type { ValidationContext } from '../ValidationContext.js';

import { testSchema } from './harness.js';

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

  it('validates queries asynchronously using asynchronous cache', async () => {
    const doc = parse(`
      {
        unknown
      }
    `);

    let cachedErrors: ReadonlyArray<GraphQLError> | Error | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache: ValidateCache = {
      set: async (resultedErrors) => {
        await resolveOnNextTick();
        cachedErrors = resultedErrors;
      },
      get: (_schema, _documentAST, _rules, _options) => {
        getAttempts++;
        if (cachedErrors) {
          cacheHits++;
        }
        return Promise.resolve(cachedErrors);
      },
    };

    const firstErrorsPromise = validate(testSchema, doc, undefined, {
      cache: customCache,
    });
    expect(isPromise(firstErrorsPromise)).to.equal(true);
    const firstErrors = await firstErrorsPromise;

    expectJSON(firstErrors).toDeepEqual([
      {
        locations: [{ line: 3, column: 9 }],
        message: 'Cannot query field "unknown" on type "QueryRoot".',
      },
    ]);
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    const secondErrorsPromise = validate(testSchema, doc, undefined, {
      cache: customCache,
    });

    expect(isPromise(secondErrorsPromise)).to.equal(true);

    const secondErrors = await secondErrorsPromise;
    expectJSON(secondErrors).toDeepEqual([
      {
        locations: [{ line: 3, column: 9 }],
        message: 'Cannot query field "unknown" on type "QueryRoot".',
      },
    ]);
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('validates queries synchronously using cache with sync getter and async setter', async () => {
    const doc = parse(`
      {
        unknown
      }
    `);

    let cachedErrors: ReadonlyArray<GraphQLError> | Error | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache: ValidateCache = {
      set: async (resultedErrors) => {
        await resolveOnNextTick();
        cachedErrors = resultedErrors;
      },
      get: (_schema, _documentAST, _rules, _options) => {
        getAttempts++;
        if (cachedErrors) {
          cacheHits++;
        }
        return cachedErrors;
      },
    };

    const firstErrors = validate(testSchema, doc, undefined, {
      cache: customCache,
    });

    expectJSON(firstErrors).toDeepEqual([
      {
        locations: [{ line: 3, column: 9 }],
        message: 'Cannot query field "unknown" on type "QueryRoot".',
      },
    ]);
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    await resolveOnNextTick();

    const secondErrors = validate(testSchema, doc, undefined, {
      cache: customCache,
    });

    expectJSON(secondErrors).toDeepEqual([
      {
        locations: [{ line: 3, column: 9 }],
        message: 'Cannot query field "unknown" on type "QueryRoot".',
      },
    ]);
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('validates queries asynchronously using cache with async getter and sync setter', async () => {
    const doc = parse(`
      {
        unknown
      }
    `);

    let cachedErrors: ReadonlyArray<GraphQLError> | Error | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache: ValidateCache = {
      set: (resultedErrors) => {
        cachedErrors = resultedErrors;
      },
      get: (_schema, _documentAST, _rules, _options) => {
        getAttempts++;
        if (cachedErrors) {
          cacheHits++;
        }
        return Promise.resolve(cachedErrors);
      },
    };

    const firstErrorsPromise = validate(testSchema, doc, undefined, {
      cache: customCache,
    });
    const firstErrors = await firstErrorsPromise;

    expectJSON(firstErrors).toDeepEqual([
      {
        locations: [{ line: 3, column: 9 }],
        message: 'Cannot query field "unknown" on type "QueryRoot".',
      },
    ]);
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    const secondErrorsPromise = validate(testSchema, doc, undefined, {
      cache: customCache,
    });

    expect(isPromise(secondErrorsPromise)).to.equal(true);

    const secondErrors = await secondErrorsPromise;
    expectJSON(secondErrors).toDeepEqual([
      {
        locations: [{ line: 3, column: 9 }],
        message: 'Cannot query field "unknown" on type "QueryRoot".',
      },
    ]);
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('validateSync validates queries synchronously using synchronous cache', () => {
    const doc = parse(`
      {
        unknown
      }
    `);

    let cachedErrors: ReadonlyArray<GraphQLError> | Error | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache: ValidateCache = {
      set: (resultedErrors) => {
        cachedErrors = resultedErrors;
      },
      get: (_schema, _documentAST, _rules, _options) => {
        getAttempts++;
        if (cachedErrors) {
          cacheHits++;
        }
        return cachedErrors;
      },
    };

    const firstErrors = validateSync(testSchema, doc, undefined, {
      cache: customCache,
    });

    expectJSON(firstErrors).toDeepEqual([
      {
        locations: [{ line: 3, column: 9 }],
        message: 'Cannot query field "unknown" on type "QueryRoot".',
      },
    ]);
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    const secondErrors = validateSync(testSchema, doc, undefined, {
      cache: customCache,
    });

    expectJSON(secondErrors).toDeepEqual([
      {
        locations: [{ line: 3, column: 9 }],
        message: 'Cannot query field "unknown" on type "QueryRoot".',
      },
    ]);
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('validateSync validates queries synchronously using sync getter and async setter', async () => {
    const doc = parse(`
      {
        unknown
      }
    `);

    let cachedErrors: ReadonlyArray<GraphQLError> | Error | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache: ValidateCache = {
      set: async (resultedErrors) => {
        await resolveOnNextTick();
        cachedErrors = resultedErrors;
      },
      get: (_schema, _documentAST, _rules, _options) => {
        getAttempts++;
        if (cachedErrors) {
          cacheHits++;
        }
        return cachedErrors;
      },
    };

    const firstErrors = validateSync(testSchema, doc, undefined, {
      cache: customCache,
    });

    expectJSON(firstErrors).toDeepEqual([
      {
        locations: [{ line: 3, column: 9 }],
        message: 'Cannot query field "unknown" on type "QueryRoot".',
      },
    ]);
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    await resolveOnNextTick();

    const secondErrors = validateSync(testSchema, doc, undefined, {
      cache: customCache,
    });

    expectJSON(secondErrors).toDeepEqual([
      {
        locations: [{ line: 3, column: 9 }],
        message: 'Cannot query field "unknown" on type "QueryRoot".',
      },
    ]);
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('validateSync throws using asynchronous cache', () => {
    const doc = parse(`
      {
        unknown
      }
    `);

    let cachedErrors: ReadonlyArray<GraphQLError> | Error | undefined;
    const customCache: ValidateCache = {
      set: async (resultedErrors) => {
        await resolveOnNextTick();
        cachedErrors = resultedErrors;
      },
      get: (_schema, _documentAST, _rules, _options) =>
        Promise.resolve(cachedErrors),
    };

    expect(() =>
      validateSync(testSchema, doc, undefined, {
        cache: customCache,
      }),
    ).to.throw('GraphQL validation failed to complete synchronously.');
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
