import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTVisitor } from '../../language/visitor.js';
import { BREAK } from '../../language/visitor.js';

import { __Type } from '../../type/introspection.js';

import { TypeInfo, visitWithTypeInfo } from '../../utilities/TypeInfo.js';

import type { SDLValidationContext } from '../ValidationContext.js';

/** Maximum number of "__Type.fields" appearances during introspection. */
const MAX_TYPE_FIELDS_COUNT = 3;

export function MaxIntrospectionDepthRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  if (!schema) {
    throw new Error('Max introspection depth rule must have a schema');
  }
  const typeInfo = new TypeInfo(schema);
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
