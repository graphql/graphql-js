import type { GraphQLNamedType } from './definition';
import { GraphQLEnumType } from './definition';

export const GraphQLErrorBehavior: GraphQLEnumType = new GraphQLEnumType({
  name: 'ErrorBehavior',
  description:
    'An enum detailing the error behavior a GraphQL request should use.',
  values: {
    NO_PROPAGATE: {
      value: 'NO_PROPAGATE',
      description:
        'Indicates that an error should result in the response position becoming null, even if it is marked as non-null.',
    },
    PROPAGATE: {
      value: 'PROPAGATE',
      description:
        'Indicates that an error that occurs in a non-null position should propagate to the nearest nullable response position.',
    },
    ABORT: {
      value: 'ABORT',
      description:
        'Indicates execution should cease when the first error occurs, and that the response data should be null.',
    },
  },
});

export const specifiedEnumTypes: ReadonlyArray<GraphQLEnumType> = Object.freeze(
  [GraphQLErrorBehavior],
);

export function isSpecifiedEnumType(type: GraphQLNamedType): boolean {
  return specifiedEnumTypes.some(({ name }) => type.name === name);
}
