// @flow strict

import { GraphQLError } from '../error/GraphQLError';

import { visit } from '../language/visitor';
import { type DocumentNode } from '../language/ast';

import { getNamedType } from '../type/definition';
import { type GraphQLSchema } from '../type/schema';

import { TypeInfo, visitWithTypeInfo } from './TypeInfo';

/**
 * A validation rule which reports deprecated usages.
 *
 * Returns a list of GraphQLError instances describing each deprecated use.
 */
export function findDeprecatedUsages(
  schema: GraphQLSchema,
  ast: DocumentNode,
): Array<GraphQLError> {
  const errors = [];
  const typeInfo = new TypeInfo(schema);

  visit(
    ast,
    visitWithTypeInfo(typeInfo, {
      Field(node) {
        const parentType = typeInfo.getParentType();
        const fieldDef = typeInfo.getFieldDef();
        if (parentType && fieldDef?.deprecationReason != null) {
          errors.push(
            new GraphQLError(
              `The field "${parentType.name}.${fieldDef.name}" is deprecated. ` +
                fieldDef.deprecationReason,
              node,
            ),
          );
        }
      },
      EnumValue(node) {
        const type = getNamedType(typeInfo.getInputType());
        const enumVal = typeInfo.getEnumValue();
        if (type && enumVal?.deprecationReason != null) {
          errors.push(
            new GraphQLError(
              `The enum value "${type.name}.${enumVal.name}" is deprecated. ` +
                enumVal.deprecationReason,
              node,
            ),
          );
        }
      },
    }),
  );

  return errors;
}
