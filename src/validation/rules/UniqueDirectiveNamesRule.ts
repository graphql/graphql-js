/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError';

import type { ASTVisitor } from '../../language/visitor';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Unique directive names
 *
 * A GraphQL document is only valid if all defined directives have unique names.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql';
 * import { UniqueDirectiveNamesRule } from 'graphql/validation';
 *
 * const invalidSDL = `
 *   directive @tag on FIELD directive @tag on QUERY type Query { name: String }
 * `;
 *
 * UniqueDirectiveNamesRule.name; // => 'UniqueDirectiveNamesRule'
 * buildSchema(invalidSDL); // throws an error
 *
 * const validSDL = `
 *   directive @tag on FIELD type Query { name: String }
 * `;
 *
 * buildSchema(validSDL); // does not throw
 * ```
 */
export function UniqueDirectiveNamesRule(
  context: SDLValidationContext,
): ASTVisitor {
  const knownDirectiveNames = Object.create(null);
  const schema = context.getSchema();

  return {
    DirectiveDefinition(node) {
      const directiveName = node.name.value;

      if (schema?.getDirective(directiveName)) {
        context.reportError(
          new GraphQLError(
            `Directive "@${directiveName}" already exists in the schema. It cannot be redefined.`,
            { nodes: node.name },
          ),
        );
        return;
      }

      if (knownDirectiveNames[directiveName]) {
        context.reportError(
          new GraphQLError(
            `There can be only one directive named "@${directiveName}".`,
            { nodes: [knownDirectiveNames[directiveName], node.name] },
          ),
        );
      } else {
        knownDirectiveNames[directiveName] = node.name;
      }

      return false;
    },
  };
}
