/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { DirectiveNode } from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import { isListType, isWrappingType } from '../../type/definition.ts';
import { GraphQLStreamDirective } from '../../type/directives.ts';

import type { ValidationContext } from '../ValidationContext.ts';

/**
 * Stream directives are used on list fields
 *
 * A GraphQL document is only valid if stream directives are used on list fields.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { validate, StreamDirectiveOnListFieldRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *     friends: [String]
 *   }
 * `);
 * const invalidDocument = parse('{ name @stream(initialCount: 0) }');
 * const validDocument = parse('{ friends @stream(initialCount: 0) }');
 *
 * validate(schema, invalidDocument, [StreamDirectiveOnListFieldRule]).length; // => 1
 * validate(schema, validDocument, [StreamDirectiveOnListFieldRule]); // => []
 * ```
 */
export function StreamDirectiveOnListFieldRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    Directive(node: DirectiveNode) {
      const fieldDef = context.getFieldDef();
      const parentType = context.getParentType();
      if (
        fieldDef &&
        parentType &&
        node.name.value === GraphQLStreamDirective.name &&
        !(
          isListType(fieldDef.type) ||
          (isWrappingType(fieldDef.type) && isListType(fieldDef.type.ofType))
        )
      ) {
        context.reportError(
          new GraphQLError(
            `Directive "@stream" cannot be used on non-list field "${parentType}.${fieldDef.name}".`,
            { nodes: node },
          ),
        );
      }
    },
  };
}
