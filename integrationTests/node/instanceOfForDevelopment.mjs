/* eslint-disable simple-import-sort/imports */
import assert from 'assert';

import { isSchema } from 'graphql-esm';

class GraphQLSchema {
  get [Symbol.toStringTag]() {
    return 'GraphQLSchema';
  }
}
const notSchema = new GraphQLSchema();
let error;
try {
  isSchema(notSchema);
} catch (_error) {
  error = _error;
}
assert(
  String(error?.message).match(
    /^Cannot use GraphQLSchema "{}" from another module or realm./m,
  ),
);
