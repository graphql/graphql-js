// @flow

import type { GraphQLTypeResolver } from '../type/definition';

export const resolveTypeForGeneratedSchema: GraphQLTypeResolver<any, *> =
function (value: any): string {
  if (
    value &&
    typeof value === 'object' &&
    typeof value.__typename === 'string'
  ) {
    return value.__typename;
  }
  throw new Error(
    'To resolve Interface or Union types for a generated Schema the result ' +
    'must have a __typename property containing the name of the actual type.'
  );
};
