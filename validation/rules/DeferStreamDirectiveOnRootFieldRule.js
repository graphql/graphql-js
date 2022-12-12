'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DeferStreamDirectiveOnRootFieldRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const directives_js_1 = require('../../type/directives.js');
/**
 * Defer and stream directives are used on valid root field
 *
 * A GraphQL document is only valid if defer directives are not used on root mutation or subscription types.
 */
function DeferStreamDirectiveOnRootFieldRule(context) {
  return {
    Directive(node) {
      const mutationType = context.getSchema().getMutationType();
      const subscriptionType = context.getSchema().getSubscriptionType();
      const parentType = context.getParentType();
      if (
        parentType &&
        node.name.value === directives_js_1.GraphQLDeferDirective.name
      ) {
        if (mutationType && parentType === mutationType) {
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
              `Defer directive cannot be used on root mutation type "${parentType.name}".`,
              { nodes: node },
            ),
          );
        }
        if (subscriptionType && parentType === subscriptionType) {
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
              `Defer directive cannot be used on root subscription type "${parentType.name}".`,
              { nodes: node },
            ),
          );
        }
      }
      if (
        parentType &&
        node.name.value === directives_js_1.GraphQLStreamDirective.name
      ) {
        if (mutationType && parentType === mutationType) {
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
              `Stream directive cannot be used on root mutation type "${parentType.name}".`,
              { nodes: node },
            ),
          );
        }
        if (subscriptionType && parentType === subscriptionType) {
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
              `Stream directive cannot be used on root subscription type "${parentType.name}".`,
              { nodes: node },
            ),
          );
        }
      }
    },
  };
}
exports.DeferStreamDirectiveOnRootFieldRule =
  DeferStreamDirectiveOnRootFieldRule;
