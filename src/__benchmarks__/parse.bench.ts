import { bench, describe } from 'vitest';

import { parse } from '../language/parser.js';

import { getIntrospectionQuery } from '../utilities/getIntrospectionQuery.js';

describe('GraphQL Parsing and Validation Benchmarks', () => {
  bench('Parse introspection query', () => {
    parse(getIntrospectionQuery());
  });
});
