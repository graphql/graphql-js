'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.KnownArgumentNamesOnDirectivesRule = exports.KnownArgumentNamesRule =
  void 0;
const didYouMean_js_1 = require('../../jsutils/didYouMean.js');
const suggestionList_js_1 = require('../../jsutils/suggestionList.js');
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const kinds_js_1 = require('../../language/kinds.js');
const directives_js_1 = require('../../type/directives.js');
/**
 * Known argument names
 *
 * A GraphQL field is only valid if all supplied arguments are defined by
 * that field.
 *
 * See https://spec.graphql.org/draft/#sec-Argument-Names
 * See https://spec.graphql.org/draft/#sec-Directives-Are-In-Valid-Locations
 */
function KnownArgumentNamesRule(context) {
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
        const suggestions = (0, suggestionList_js_1.suggestionList)(
          argName,
          knownArgsNames,
        );
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Unknown argument "${argName}" on field "${parentType.name}.${fieldDef.name}".` +
              (0, didYouMean_js_1.didYouMean)(suggestions),
            { nodes: argNode },
          ),
        );
      }
    },
  };
}
exports.KnownArgumentNamesRule = KnownArgumentNamesRule;
/**
 * @internal
 */
function KnownArgumentNamesOnDirectivesRule(context) {
  const directiveArgs = new Map();
  const schema = context.getSchema();
  const definedDirectives = schema
    ? schema.getDirectives()
    : directives_js_1.specifiedDirectives;
  for (const directive of definedDirectives) {
    directiveArgs.set(
      directive.name,
      directive.args.map((arg) => arg.name),
    );
  }
  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === kinds_js_1.Kind.DIRECTIVE_DEFINITION) {
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      /* c8 ignore next */
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
            const suggestions = (0, suggestionList_js_1.suggestionList)(
              argName,
              knownArgs,
            );
            context.reportError(
              new GraphQLError_js_1.GraphQLError(
                `Unknown argument "${argName}" on directive "@${directiveName}".` +
                  (0, didYouMean_js_1.didYouMean)(suggestions),
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
exports.KnownArgumentNamesOnDirectivesRule = KnownArgumentNamesOnDirectivesRule;
