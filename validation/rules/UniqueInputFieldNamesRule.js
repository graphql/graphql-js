'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.UniqueInputFieldNamesRule = void 0;
const invariant_js_1 = require('../../jsutils/invariant.js');
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
/**
 * Unique input field names
 *
 * A GraphQL input object value is only valid if all supplied fields are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Object-Field-Uniqueness
 */
function UniqueInputFieldNamesRule(context) {
  const knownNameStack = [];
  let knownNames = new Map();
  return {
    ObjectValue: {
      enter() {
        knownNameStack.push(knownNames);
        knownNames = new Map();
      },
      leave() {
        const prevKnownNames = knownNameStack.pop();
        prevKnownNames != null || (0, invariant_js_1.invariant)(false);
        knownNames = prevKnownNames;
      },
    },
    ObjectField(node) {
      const fieldName = node.name.value;
      const knownName = knownNames.get(fieldName);
      if (knownName != null) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `There can be only one input field named "${fieldName}".`,
            { nodes: [knownName, node.name] },
          ),
        );
      } else {
        knownNames.set(fieldName, node.name);
      }
    },
  };
}
exports.UniqueInputFieldNamesRule = UniqueInputFieldNamesRule;
