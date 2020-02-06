// @flow strict

import { GraphQLError } from '../../error/GraphQLError';

import { Kind } from '../../language/kinds';
import { type ASTVisitor } from '../../language/visitor';

import { specifiedDirectives } from '../../type/directives';

import {
  type SDLValidationContext,
  type ValidationContext,
} from '../ValidationContext';

/**
 * Unique directive names per location
 *
 * A GraphQL document is only valid if all non-repeatable directives at
 * a given location are uniquely named.
 */
export function UniqueDirectivesPerLocationRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor {
  const uniqueDirectiveMap = Object.create(null);

  const schema = context.getSchema();
  const definedDirectives = schema
    ? schema.getDirectives()
    : specifiedDirectives;
  for (const directive of definedDirectives) {
    uniqueDirectiveMap[directive.name] = !directive.isRepeatable;
  }

  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      uniqueDirectiveMap[def.name.value] = !def.repeatable;
    }
  }

  return {
    // Many different AST nodes may contain directives. Rather than listing
    // them all, just listen for entering any node, and check to see if it
    // defines any directives.
    enter(node) {
      if (node.directives != null) {
        const knownDirectives = Object.create(null);
        for (const directive of node.directives) {
          const directiveName = directive.name.value;

          if (uniqueDirectiveMap[directiveName]) {
            if (knownDirectives[directiveName]) {
              context.reportError(
                new GraphQLError(
                  `The directive "@${directiveName}" can only be used once at this location.`,
                  [knownDirectives[directiveName], directive],
                ),
              );
            } else {
              knownDirectives[directiveName] = directive;
            }
          }
        }
      }
    },
  };
}
