import { RequiredStatus } from '../language/ast';
import { GraphQLOutputType } from '../type/definition';

export function modifiedOutputType(
    type: GraphQLOutputType,
    required?: RequiredStatus,
): GraphQLOutputType;