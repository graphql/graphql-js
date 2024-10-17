import { bench, describe } from "vitest";

import { buildSchema } from "../utilities/buildASTSchema.js";

import { graphqlSync } from "../graphql.js";

const schema = buildSchema('type Query { hello: String! }');
const source = `{ ${'hello '.repeat(250)}}`;

describe("GraphQL Execution Benchmarks", () => {
  bench("Many repeated fields", () => {
    graphqlSync({ schema, source });
  });
});