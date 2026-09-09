/** @category Validation Rules */

import { didYouMean } from '../../jsutils/didYouMean.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Field selections must exist on their parent object, interface, or union type.
 *
 * See https://spec.graphql.org/draft/#sec-Field-Selections
 * @category Validation Rules
 
 * @internal
 */
export const FieldsOnCorrectTypeASTVisitor: ASTVisitorFn = (context) => {
  const { index, indexCursor } = context;

  return {
    Field(node) {
      const type = indexCursor.getCurrentParentType();
      if (type == null) {
        return;
      }

      const fieldDef = indexCursor.getCurrentFieldDef();
      if (fieldDef != null) {
        return;
      }

      const fieldName = node.name.value;
      let suggestion = didYouMean(
        'to use an inline fragment on',
        context.hideSuggestions
          ? []
          : index.getSuggestedTypeNames(type, fieldName),
      );

      if (suggestion === '') {
        suggestion = didYouMean(
          context.hideSuggestions
            ? []
            : index.getSuggestedFieldNames(type, fieldName),
        );
      }

      context.reportError(
        new GraphQLError(
          `Cannot query field "${fieldName}" on type "${index.typeToString(
            type,
          )}".` + suggestion,
          { nodes: node },
        ),
      );
    },
  };
};
