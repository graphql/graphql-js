'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DeferStreamDirectiveOnValidOperationsRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const ast_js_1 = require('../../language/ast.js');
const kinds_js_1 = require('../../language/kinds.js');
const directives_js_1 = require('../../type/directives.js');
function ifArgumentCanBeFalse(node) {
  const ifArgument = node.arguments?.find((arg) => arg.name.value === 'if');
  if (!ifArgument) {
    return false;
  }
  if (ifArgument.value.kind === kinds_js_1.Kind.BOOLEAN) {
    if (ifArgument.value.value) {
      return false;
    }
  } else if (ifArgument.value.kind !== kinds_js_1.Kind.VARIABLE) {
    return false;
  }
  return true;
}
/**
 * Defer And Stream Directives Are Used On Valid Operations
 *
 * A GraphQL document is only valid if defer directives are not used on root mutation or subscription types.
 */
function DeferStreamDirectiveOnValidOperationsRule(context) {
  const fragmentsUsedOnSubscriptions = new Set();
  return {
    OperationDefinition(operation) {
      if (operation.operation === ast_js_1.OperationTypeNode.SUBSCRIPTION) {
        for (const fragment of context.getRecursivelyReferencedFragments(
          operation,
        )) {
          fragmentsUsedOnSubscriptions.add(fragment.name.value);
        }
      }
    },
    Directive(node, _key, _parent, _path, ancestors) {
      const definitionNode = ancestors[2];
      if (
        'kind' in definitionNode &&
        ((definitionNode.kind === kinds_js_1.Kind.FRAGMENT_DEFINITION &&
          fragmentsUsedOnSubscriptions.has(definitionNode.name.value)) ||
          (definitionNode.kind === kinds_js_1.Kind.OPERATION_DEFINITION &&
            definitionNode.operation ===
              ast_js_1.OperationTypeNode.SUBSCRIPTION))
      ) {
        if (node.name.value === directives_js_1.GraphQLDeferDirective.name) {
          if (!ifArgumentCanBeFalse(node)) {
            context.reportError(
              new GraphQLError_js_1.GraphQLError(
                'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
                { nodes: node },
              ),
            );
          }
        } else if (
          node.name.value === directives_js_1.GraphQLStreamDirective.name
        ) {
          if (!ifArgumentCanBeFalse(node)) {
            context.reportError(
              new GraphQLError_js_1.GraphQLError(
                'Stream directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
                { nodes: node },
              ),
            );
          }
        }
      }
    },
  };
}
exports.DeferStreamDirectiveOnValidOperationsRule =
  DeferStreamDirectiveOnValidOperationsRule;
