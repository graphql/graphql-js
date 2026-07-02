/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import { GraphQLStreamDirective } from '../../type/directives.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Stream directives must be used on list fields.
 *
 * See https://spec.graphql.org/draft/#sec-Stream-Directives-Are-Used-On-List-Fields
 * @category Validation Rules
 
 * @internal
 */
export const StreamDirectiveOnListFieldASTVisitor: ASTVisitorFn = (context) => {
  const { index, indexCursor } = context;

  return {
    Directive(node) {
      if (node.name.value !== GraphQLStreamDirective.name) {
        return;
      }

      const fieldDef = indexCursor.getCurrentFieldDef();
      const parentType = indexCursor.getCurrentParentType();
      const fieldType =
        fieldDef == null ? undefined : index.getFieldType(fieldDef);
      const nullableFieldType =
        fieldType != null && index.isNonNullType(fieldType)
          ? index.getNullableType(fieldType)
          : fieldType;
      if (
        fieldDef != null &&
        parentType != null &&
        nullableFieldType != null &&
        !index.isListType(nullableFieldType)
      ) {
        context.reportError(
          new GraphQLError(
            `Directive "@stream" cannot be used on non-list field "${index.typeToString(
              parentType,
            )}.${index.getFieldName(fieldDef)}".`,
            { nodes: node },
          ),
        );
      }
    },
  };
};
