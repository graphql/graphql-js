import { parse } from 'graphql/language/parser.js';
import { getIntrospectionQuery } from 'graphql/utilities/getIntrospectionQuery.js';

const introspectionQuery = getIntrospectionQuery();

export const benchmark = {
  name: 'Parse introspection query',
  measure: () => parse(introspectionQuery),
};
