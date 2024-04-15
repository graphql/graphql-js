import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTVisitor } from '../../language/visitor.js';
import { BREAK } from '../../language/visitor.js';

import { __Type } from '../../type/introspection.js';

import { TypeInfo, visitWithTypeInfo } from '../../utilities/TypeInfo.js';

import type { ValidationContext } from '../ValidationContext.js';

/** Maximum number of "__Type.fields" appearances during introspection. */
const MAX_TYPE_FIELDS_COUNT = 4;

export function MaxIntrospectionDepthRule(
  context: ValidationContext,
): ASTVisitor {
  const typeInfo = new TypeInfo(context.getSchema());
  let count = 0;
  return visitWithTypeInfo(typeInfo, {
    Field(field) {
      if (
        field.name.value === 'fields' &&
        typeInfo.getParentType() === __Type &&
        ++count >= MAX_TYPE_FIELDS_COUNT
      ) {
        context.reportError(
          new GraphQLError('Maximum introspection depth exceeded'),
        );
        return BREAK;
      }
    },
  });
}
