import { didYouMean } from '../../jsutils/didYouMean';
import { suggestionList } from '../../jsutils/suggestionList';

import { GraphQLError } from '../../error/GraphQLError';

import { Kind } from '../../language/kinds';
import type { ASTVisitor } from '../../language/visitor';

import { specifiedDirectives } from '../../type/directives';

import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext';

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
    Argument(argNode) {
      const argDef = context.getArgument();
      const fieldDef = context.getFieldDef();
      const parentType = context.getParentType();

      if (!argDef && fieldDef && parentType) {
        const argName = argNode.name.value;
        const knownArgsNames = fieldDef.args.map((arg) => arg.name);
        const suggestions = suggestionList(argName, knownArgsNames);
        context.reportError(
          new GraphQLError(
            `Unknown argument "${argName}" on field "${parentType.name}.${fieldDef.name}".` +
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
  const directiveArgs = Object.create(null);

  const schema = context.getSchema();
  const definedDirectives = schema
    ? schema.getDirectives()
    : specifiedDirectives;
  for (const directive of definedDirectives) {
    directiveArgs[directive.name] = directive.args.map((arg) => arg.name);
  }

  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      /* c8 ignore next */
      const argsNodes = def.arguments ?? [];

      directiveArgs[def.name.value] = argsNodes.map((arg) => arg.name.value);
    }
  }

  return {
    Directive(directiveNode) {
      const directiveName = directiveNode.name.value;
      const knownArgs = directiveArgs[directiveName];

      if (directiveNode.arguments && knownArgs) {
        for (const argNode of directiveNode.arguments) {
          const argName = argNode.name.value;
          if (!knownArgs.includes(argName)) {
            const suggestions = suggestionList(argName, knownArgs);
            context.reportError(
              new GraphQLError(
                `Unknown argument "${argName}" on directive "@${directiveName}".` +
                  didYouMean(suggestions),
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
