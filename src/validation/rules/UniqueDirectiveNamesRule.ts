/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { NameNode } from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type { SDLValidationContext } from '../ValidationContext.ts';

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
  const knownDirectiveNames = new Map<string, NameNode>();
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

      const knownName = knownDirectiveNames.get(directiveName);
      if (knownName) {
        context.reportError(
          new GraphQLError(
            `There can be only one directive named "@${directiveName}".`,
            { nodes: [knownName, node.name] },
          ),
        );
      } else {
        knownDirectiveNames.set(directiveName, node.name);
      }

      return false;
    },
  };
}
