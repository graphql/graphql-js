/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError';

import { print } from '../../language/printer';
import type { ASTVisitor } from '../../language/visitor';

import { isCompositeType } from '../../type/definition';

import { typeFromAST } from '../../utilities/typeFromAST';

import type { ValidationContext } from '../ValidationContext';

/**
 * Fragments on composite type
 *
 * Fragments use a type condition to determine if they apply, since fragments
 * can only be spread into a composite type (object, interface, or union), the
 * type condition must also be a composite type.
 *
 * See https://spec.graphql.org/draft/#sec-Fragments-On-Composite-Types
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { FragmentsOnCompositeTypesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   fragment Bad on String { length }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [FragmentsOnCompositeTypesRule]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   fragment Good on Query { name }
 * `);
 * const validErrors = validate(schema, validDocument, [FragmentsOnCompositeTypesRule]);
 *
 * validErrors; // => []
 * ```
 */
export function FragmentsOnCompositeTypesRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    InlineFragment(node) {
      const typeCondition = node.typeCondition;
      if (typeCondition) {
        const type = typeFromAST(context.getSchema(), typeCondition);
        if (type && !isCompositeType(type)) {
          const typeStr = print(typeCondition);
          context.reportError(
            new GraphQLError(
              `Fragment cannot condition on non composite type "${typeStr}".`,
              { nodes: typeCondition },
            ),
          );
        }
      }
    },
    FragmentDefinition(node) {
      const type = typeFromAST(context.getSchema(), node.typeCondition);
      if (type && !isCompositeType(type)) {
        const typeStr = print(node.typeCondition);
        context.reportError(
          new GraphQLError(
            `Fragment "${node.name.value}" cannot condition on non composite type "${typeStr}".`,
            { nodes: node.typeCondition },
          ),
        );
      }
    },
  };
}
