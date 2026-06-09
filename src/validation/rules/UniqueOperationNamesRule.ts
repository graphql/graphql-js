/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { NameNode } from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type { ASTValidationContext } from '../ValidationContext.ts';

/**
 * Unique operation names
 *
 * A GraphQL document is only valid if all defined operations have unique names.
 *
 * See https://spec.graphql.org/draft/#sec-Operation-Name-Uniqueness
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { UniqueOperationNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   query Same { name } query Same { name }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   UniqueOperationNamesRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   query One { name } query Two { name }
 * `);
 * const validErrors = validate(schema, validDocument, [UniqueOperationNamesRule]);
 *
 * validErrors; // => []
 * ```
 */
export function UniqueOperationNamesRule(
  context: ASTValidationContext,
): ASTVisitor {
  const knownOperationNames = new Map<string, NameNode>();
  return {
    OperationDefinition(node) {
      const operationName = node.name;
      if (operationName != null) {
        const knownOperationName = knownOperationNames.get(operationName.value);
        if (knownOperationName != null) {
          context.reportError(
            new GraphQLError(
              `There can be only one operation named "${operationName.value}".`,
              { nodes: [knownOperationName, operationName] },
            ),
          );
        } else {
          knownOperationNames.set(operationName.value, operationName);
        }
      }
      return false;
    },
    FragmentDefinition: () => false,
  };
}
