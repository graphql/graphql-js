/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTVisitor } from '../../language/visitor.ts';

import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../../type/directives.ts';

import type { ValidationContext } from '../ValidationContext.ts';

/**
 * Defer and stream directives are used on valid root field
 *
 * A GraphQL document is only valid if defer directives are not used on root mutation or subscription types.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { validate, DeferStreamDirectiveOnRootFieldRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     message: String
 *   }
 *
 *   type Mutation {
 *     updateMessage: String
 *   }
 * `);
 * const invalidDocument = parse(`
 *   mutation { ... @defer { updateMessage } }
 * `);
 * const validDocument = parse(`
 *   { ... @defer { message } }
 * `);
 *
 * validate(schema, invalidDocument, [DeferStreamDirectiveOnRootFieldRule]).length; // => 1
 * validate(schema, validDocument, [DeferStreamDirectiveOnRootFieldRule]); // => []
 * ```
 */
export function DeferStreamDirectiveOnRootFieldRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    Directive(node) {
      const mutationType = context.getSchema().getMutationType();
      const subscriptionType = context.getSchema().getSubscriptionType();
      const parentType = context.getParentType();
      if (parentType && node.name.value === GraphQLDeferDirective.name) {
        if (mutationType && parentType === mutationType) {
          context.reportError(
            new GraphQLError(
              `Defer directive cannot be used on root mutation type "${parentType}".`,
              { nodes: node },
            ),
          );
        }
        if (subscriptionType && parentType === subscriptionType) {
          context.reportError(
            new GraphQLError(
              `Defer directive cannot be used on root subscription type "${parentType}".`,
              { nodes: node },
            ),
          );
        }
      }
      if (parentType && node.name.value === GraphQLStreamDirective.name) {
        if (mutationType && parentType === mutationType) {
          context.reportError(
            new GraphQLError(
              `Stream directive cannot be used on root mutation type "${parentType}".`,
              { nodes: node },
            ),
          );
        }
        if (subscriptionType && parentType === subscriptionType) {
          context.reportError(
            new GraphQLError(
              `Stream directive cannot be used on root subscription type "${parentType}".`,
              { nodes: node },
            ),
          );
        }
      }
    },
  };
}
