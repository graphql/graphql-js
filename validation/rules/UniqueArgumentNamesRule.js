'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.UniqueArgumentNamesRule = UniqueArgumentNamesRule;

var _GraphQLError = require('../../error/GraphQLError.js');

/**
 * Unique argument names
 *
 * A GraphQL field or directive is only valid if all supplied arguments are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Argument-Names
 */
function UniqueArgumentNamesRule(context) {
  let knownArgNames = Object.create(null);
  return {
    Field() {
      knownArgNames = Object.create(null);
    },

    Directive() {
      knownArgNames = Object.create(null);
    },

    Argument(node) {
      const argName = node.name.value;

      if (knownArgNames[argName]) {
        context.reportError(
          new _GraphQLError.GraphQLError(
            `There can be only one argument named "${argName}".`,
            [knownArgNames[argName], node.name],
          ),
        );
      } else {
        knownArgNames[argName] = node.name;
      }

      return false;
    },
  };
}
