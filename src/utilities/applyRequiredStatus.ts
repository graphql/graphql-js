import type { RequiredStatus } from '../language/ast';
import type { GraphQLOutputType } from '../type/definition';
import {
  getNullableType,
  GraphQLNonNull,
  isNonNullType,
} from '../type/definition';

export function modifiedOutputType(
  type: GraphQLOutputType,
  required: RequiredStatus,
): GraphQLOutputType {
  if (required === 'required' && !isNonNullType(type)) {
    return new GraphQLNonNull(type);
  } else if (required === 'optional') {
    return getNullableType(type);
  }
  return type;
}
