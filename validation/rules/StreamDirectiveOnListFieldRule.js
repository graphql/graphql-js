'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.StreamDirectiveOnListFieldRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const definition_js_1 = require('../../type/definition.js');
const directives_js_1 = require('../../type/directives.js');
/**
 * Stream directives are used on list fields
 *
 * A GraphQL document is only valid if stream directives are used on list fields.
 */
function StreamDirectiveOnListFieldRule(context) {
  return {
    Directive(node) {
      const fieldDef = context.getFieldDef();
      const parentType = context.getParentType();
      if (
        fieldDef &&
        parentType &&
        node.name.value === directives_js_1.GraphQLStreamDirective.name &&
        !(
          (0, definition_js_1.isListType)(fieldDef.type) ||
          ((0, definition_js_1.isWrappingType)(fieldDef.type) &&
            (0, definition_js_1.isListType)(fieldDef.type.ofType))
        )
      ) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Stream directive cannot be used on non-list field "${fieldDef.name}" on type "${parentType.name}".`,
            { nodes: node },
          ),
        );
      }
    },
  };
}
exports.StreamDirectiveOnListFieldRule = StreamDirectiveOnListFieldRule;
