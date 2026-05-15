/** @category Validation Rules */

import { invariant } from '../../jsutils/invariant.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { NameNode } from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type { ASTValidationContext } from '../ValidationContext.ts';

/**
 * Unique input field names
 *
 * A GraphQL input object value is only valid if all supplied fields are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Object-Field-Uniqueness
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { UniqueInputFieldNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   input Filter {
 *     name: String
 *   }
 *
 *   type Query {
 *     search(filter: Filter): String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { search(filter: { name: "a", name: "b" }) }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [UniqueInputFieldNamesRule]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { search(filter: { name: "a" }) }
 * `);
 * const validErrors = validate(schema, validDocument, [UniqueInputFieldNamesRule]);
 *
 * validErrors; // => []
 * ```
 */
export function UniqueInputFieldNamesRule(
  context: ASTValidationContext,
): ASTVisitor {
  const knownNameStack: Array<Map<string, NameNode>> = [];
  let knownNames = new Map<string, NameNode>();

  return {
    ObjectValue: {
      enter() {
        knownNameStack.push(knownNames);
        knownNames = new Map();
      },
      leave() {
        const prevKnownNames = knownNameStack.pop();
        invariant(prevKnownNames != null);
        knownNames = prevKnownNames;
      },
    },
    ObjectField(node) {
      const fieldName = node.name.value;
      const knownName = knownNames.get(fieldName);
      if (knownName != null) {
        context.reportError(
          new GraphQLError(
            `There can be only one input field named "${fieldName}".`,
            { nodes: [knownName, node.name] },
          ),
        );
      } else {
        knownNames.set(fieldName, node.name);
      }
    },
  };
}
