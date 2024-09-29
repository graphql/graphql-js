import { GraphQLScalarType } from 'graphql/type';
import { GraphQLError } from 'graphql/error';
import type { NameNode } from 'graphql/language';
import { Kind } from 'graphql/language';

// Test subset of public APIs with "exactOptionalPropertyTypes" flag enabled
new GraphQLScalarType({
  name: 'SomeScalar',
  serialize: undefined,
  parseValue: undefined,
  parseConstLiteral: undefined,
});

new GraphQLError('test', { nodes: undefined });

const nameNode: NameNode = { kind: Kind.NAME, loc: undefined, value: 'test' };
