'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DeferStreamDirectiveLabelRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const kinds_js_1 = require('../../language/kinds.js');
const directives_js_1 = require('../../type/directives.js');
/**
 * Defer and stream directive labels are unique
 *
 * A GraphQL document is only valid if defer and stream directives' label argument is static and unique.
 */
function DeferStreamDirectiveLabelRule(context) {
  const knownLabels = new Map();
  return {
    Directive(node) {
      if (
        node.name.value === directives_js_1.GraphQLDeferDirective.name ||
        node.name.value === directives_js_1.GraphQLStreamDirective.name
      ) {
        const labelArgument = node.arguments?.find(
          (arg) => arg.name.value === 'label',
        );
        const labelValue = labelArgument?.value;
        if (!labelValue) {
          return;
        }
        if (labelValue.kind !== kinds_js_1.Kind.STRING) {
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
              `Directive "${node.name.value}"'s label argument must be a static string.`,
              { nodes: node },
            ),
          );
          return;
        }
        const knownLabel = knownLabels.get(labelValue.value);
        if (knownLabel != null) {
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
              'Defer/Stream directive label argument must be unique.',
              { nodes: [knownLabel, node] },
            ),
          );
        } else {
          knownLabels.set(labelValue.value, node);
        }
      }
    },
  };
}
exports.DeferStreamDirectiveLabelRule = DeferStreamDirectiveLabelRule;
