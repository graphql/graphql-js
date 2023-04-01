import { GraphQLError } from '../../error/GraphQLError.ts';
import type { DirectiveNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import {
  isTypeDefinitionNode,
  isTypeExtensionNode,
} from '../../language/predicates.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import { specifiedDirectives } from '../../type/directives.ts';
import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext.ts';
/**
 * Unique directive names per location
 *
 * A GraphQL document is only valid if all non-repeatable directives at
 * a given location are uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Unique-Per-Location
 */
export function UniqueDirectivesPerLocationRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor {
  const uniqueDirectiveMap = new Map<string, boolean>();
  const schema = context.getSchema();
  const definedDirectives = schema
    ? schema.getDirectives()
    : specifiedDirectives;
  for (const directive of definedDirectives) {
    uniqueDirectiveMap.set(directive.name, !directive.isRepeatable);
  }
  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      uniqueDirectiveMap.set(def.name.value, !def.repeatable);
    }
  }
  const schemaDirectives = new Map<string, DirectiveNode>();
  const typeDirectivesMap = new Map<string, Map<string, DirectiveNode>>();
  return {
    // Many different AST nodes may contain directives. Rather than listing
    // them all, just listen for entering any node, and check to see if it
    // defines any directives.
    enter(node) {
      if (!('directives' in node) || !node.directives) {
        return;
      }
      let seenDirectives;
      if (
        node.kind === Kind.SCHEMA_DEFINITION ||
        node.kind === Kind.SCHEMA_EXTENSION
      ) {
        seenDirectives = schemaDirectives;
      } else if (isTypeDefinitionNode(node) || isTypeExtensionNode(node)) {
        const typeName = node.name.value;
        seenDirectives = typeDirectivesMap.get(typeName);
        if (seenDirectives === undefined) {
          seenDirectives = new Map();
          typeDirectivesMap.set(typeName, seenDirectives);
        }
      } else {
        seenDirectives = new Map();
      }
      for (const directive of node.directives) {
        const directiveName = directive.name.value;
        if (uniqueDirectiveMap.get(directiveName) === true) {
          const seenDirective = seenDirectives.get(directiveName);
          if (seenDirective != null) {
            context.reportError(
              new GraphQLError(
                `The directive "@${directiveName}" can only be used once at this location.`,
                { nodes: [seenDirective, directive] },
              ),
            );
          } else {
            seenDirectives.set(directiveName, directive);
          }
        }
      }
    },
  };
}
