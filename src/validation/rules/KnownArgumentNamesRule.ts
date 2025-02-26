import { didYouMean } from '../../jsutils/didYouMean.js';
import { suggestionList } from '../../jsutils/suggestionList.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import { Kind } from '../../language/kinds.js';
import type { ASTVisitor } from '../../language/visitor.js';

import { specifiedDirectives } from '../../type/directives.js';

import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext.js';

/**
 * Known argument names
 *
 * A GraphQL field is only valid if all supplied arguments are defined by
 * that field.
 *
 * See https://spec.graphql.org/draft/#sec-Argument-Names
 * See https://spec.graphql.org/draft/#sec-Directives-Are-In-Valid-Locations
 */
export function KnownArgumentNamesRule(context: ValidationContext): ASTVisitor {
  return {
    // eslint-disable-next-line new-cap
    ...KnownArgumentNamesOnDirectivesRule(context),
    FragmentArgument(argNode) {
      const fragmentSignature = context.getFragmentSignature();
      if (fragmentSignature) {
        const varDef = fragmentSignature.variableDefinitions.get(
          argNode.name.value,
        );
        if (!varDef) {
          const argName = argNode.name.value;
          const suggestions = context.hideSuggestions
            ? []
            : suggestionList(
                argName,
                Array.from(fragmentSignature.variableDefinitions.values()).map(
                  (varSignature) => varSignature.variable.name.value,
                ),
              );
          context.reportError(
            new GraphQLError(
              `Unknown argument "${argName}" on fragment "${fragmentSignature.definition.name.value}".` +
                didYouMean(suggestions),
              { nodes: argNode },
            ),
          );
        }
      }
    },
    Argument(argNode) {
      const argDef = context.getArgument();
      const fieldDef = context.getFieldDef();

      if (!argDef && fieldDef) {
        const argName = argNode.name.value;
        const suggestions = context.hideSuggestions
          ? []
          : suggestionList(
              argName,
              fieldDef.args.map((arg) => arg.name),
            );
        context.reportError(
          new GraphQLError(
            `Unknown argument "${argName}" on field "${fieldDef}".` +
              didYouMean(suggestions),
            { nodes: argNode },
          ),
        );
      }
    },
  };
}

/**
 * @internal
 */
export function KnownArgumentNamesOnDirectivesRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor {
  const directiveArgs = new Map<string, ReadonlyArray<string>>();

  const schema = context.getSchema();
  const definedDirectives = schema
    ? schema.getDirectives()
    : specifiedDirectives;
  for (const directive of definedDirectives) {
    directiveArgs.set(
      directive.name,
      directive.args.map((arg) => arg.name),
    );
  }

  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      const argsNodes = def.arguments ?? [];

      directiveArgs.set(
        def.name.value,
        argsNodes.map((arg) => arg.name.value),
      );
    }
  }

  return {
    Directive(directiveNode) {
      const directiveName = directiveNode.name.value;
      const knownArgs = directiveArgs.get(directiveName);

      if (directiveNode.arguments != null && knownArgs != null) {
        for (const argNode of directiveNode.arguments) {
          const argName = argNode.name.value;
          if (!knownArgs.includes(argName)) {
            const suggestions = suggestionList(argName, knownArgs);
            context.reportError(
              new GraphQLError(
                `Unknown argument "${argName}" on directive "@${directiveName}".` +
                  (context.hideSuggestions ? '' : didYouMean(suggestions)),
                { nodes: argNode },
              ),
            );
          }
        }
      }

      return false;
    },
  };
}
