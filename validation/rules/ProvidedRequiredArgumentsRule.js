'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.ProvidedRequiredArgumentsRule = ProvidedRequiredArgumentsRule;
exports.ProvidedRequiredArgumentsOnDirectivesRule = ProvidedRequiredArgumentsOnDirectivesRule;

var _inspect = require('../../jsutils/inspect.js');

var _keyMap = require('../../jsutils/keyMap.js');

var _GraphQLError = require('../../error/GraphQLError.js');

var _kinds = require('../../language/kinds.js');

var _printer = require('../../language/printer.js');

var _directives = require('../../type/directives.js');

var _definition = require('../../type/definition.js');

/**
 * Provided required arguments
 *
 * A field or directive is only valid if all required (non-null without a
 * default value) field arguments have been provided.
 */
function ProvidedRequiredArgumentsRule(context) {
  return {
    // eslint-disable-next-line new-cap
    ...ProvidedRequiredArgumentsOnDirectivesRule(context),
    Field: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(fieldNode) {
        var _fieldNode$arguments;

        const fieldDef = context.getFieldDef();

        if (!fieldDef) {
          return false;
        } // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')

        const argNodes =
          (_fieldNode$arguments = fieldNode.arguments) !== null &&
          _fieldNode$arguments !== void 0
            ? _fieldNode$arguments
            : [];
        const argNodeMap = (0, _keyMap.keyMap)(
          argNodes,
          (arg) => arg.name.value,
        );

        for (const argDef of fieldDef.args) {
          const argNode = argNodeMap[argDef.name];

          if (!argNode && (0, _definition.isRequiredArgument)(argDef)) {
            const argTypeStr = (0, _inspect.inspect)(argDef.type);
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Field "${fieldDef.name}" argument "${argDef.name}" of type "${argTypeStr}" is required, but it was not provided.`,
                fieldNode,
              ),
            );
          }
        }
      },
    },
  };
}
/**
 * @internal
 */

function ProvidedRequiredArgumentsOnDirectivesRule(context) {
  const requiredArgsMap = Object.create(null);
  const schema = context.getSchema();
  const definedDirectives = schema
    ? schema.getDirectives()
    : _directives.specifiedDirectives;

  for (const directive of definedDirectives) {
    requiredArgsMap[directive.name] = (0, _keyMap.keyMap)(
      directive.args.filter(_definition.isRequiredArgument),
      (arg) => arg.name,
    );
  }

  const astDefinitions = context.getDocument().definitions;

  for (const def of astDefinitions) {
    if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
      var _def$arguments;

      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      const argNodes =
        (_def$arguments = def.arguments) !== null && _def$arguments !== void 0
          ? _def$arguments
          : [];
      requiredArgsMap[def.name.value] = (0, _keyMap.keyMap)(
        argNodes.filter(isRequiredArgumentNode),
        (arg) => arg.name.value,
      );
    }
  }

  return {
    Directive: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(directiveNode) {
        const directiveName = directiveNode.name.value;
        const requiredArgs = requiredArgsMap[directiveName];

        if (requiredArgs) {
          var _directiveNode$argume;

          // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
          const argNodes =
            (_directiveNode$argume = directiveNode.arguments) !== null &&
            _directiveNode$argume !== void 0
              ? _directiveNode$argume
              : [];
          const argNodeMap = (0, _keyMap.keyMap)(
            argNodes,
            (arg) => arg.name.value,
          );

          for (const argName of Object.keys(requiredArgs)) {
            if (!argNodeMap[argName]) {
              const argType = requiredArgs[argName].type;
              const argTypeStr = (0, _definition.isType)(argType)
                ? (0, _inspect.inspect)(argType)
                : (0, _printer.print)(argType);
              context.reportError(
                new _GraphQLError.GraphQLError(
                  `Directive "@${directiveName}" argument "${argName}" of type "${argTypeStr}" is required, but it was not provided.`,
                  directiveNode,
                ),
              );
            }
          }
        }
      },
    },
  };
}

function isRequiredArgumentNode(arg) {
  return (
    arg.type.kind === _kinds.Kind.NON_NULL_TYPE && arg.defaultValue == null
  );
}
