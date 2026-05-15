/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTVisitor } from '../../language/visitor.ts';

import type { ValidationContext } from '../ValidationContext.ts';

/**
 * Known Operation Types
 *
 * A GraphQL document is only valid if when it contains an operation,
 * the root type for the operation exists within the schema.
 *
 * See https://spec.graphql.org/draft/#sec-Operation-Type-Existence
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { validate, KnownOperationTypesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const invalidDocument = parse('mutation { greeting }');
 * const validDocument = parse('{ greeting }');
 *
 * validate(schema, invalidDocument, [KnownOperationTypesRule])[0].message; // => 'The mutation operation is not supported by the schema.'
 * validate(schema, validDocument, [KnownOperationTypesRule]); // => []
 * ```
 */
export function KnownOperationTypesRule(
  context: ValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  return {
    OperationDefinition(node) {
      const operation = node.operation;
      if (!schema.getRootType(operation)) {
        context.reportError(
          new GraphQLError(
            `The ${operation} operation is not supported by the schema.`,
            { nodes: node },
          ),
        );
      }
    },
  };
}
