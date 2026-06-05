import type { DocumentNode } from '../../../language/ast.ts';
import { parse } from '../../../language/parser.ts';

import {
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
} from '../../../type/index.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

export const rootStringCoverageDocument: DocumentNode = parse('{ value }');

export type RootStringCoverageSchemaMode =
  | 'customResolver'
  | 'customString'
  | 'missingField'
  | 'noQuery'
  | 'renamedRoot'
  | 'standard';

export function createRootStringCoverageSchema(
  mode: RootStringCoverageSchemaMode = 'standard',
): GraphQLSchema {
  switch (mode) {
    case 'customResolver': {
      const schema = buildSchema('type Query { value: String }');
      const valueField = schema.getQueryType()?.getFields().value;
      if (valueField === undefined) {
        throw new Error('Expected root-string coverage schema field.');
      }
      valueField.resolve = () => 'runtime-resolver';
      return schema;
    }
    case 'customString': {
      const CustomString = new GraphQLScalarType({
        name: 'CustomString',
        coerceOutputValue: (value) => value,
      });
      const Query = new GraphQLObjectType({
        name: 'Query',
        fields: {
          value: { type: CustomString },
        },
      });
      return new GraphQLSchema({ query: Query });
    }
    case 'missingField':
      return buildSchema('type Query { other: String }');
    case 'noQuery':
      return new GraphQLSchema({});
    case 'renamedRoot':
      return buildSchema('schema { query: Root } type Root { value: String }');
    case 'standard':
      return buildSchema('type Query { value: String }');
  }
}
