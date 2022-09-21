'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.typeFromAST = void 0;
const kinds_js_1 = require('../language/kinds.js');
const definition_js_1 = require('../type/definition.js');
function typeFromAST(schema, typeNode) {
  switch (typeNode.kind) {
    case kinds_js_1.Kind.LIST_TYPE: {
      const innerType = typeFromAST(schema, typeNode.type);
      return innerType && new definition_js_1.GraphQLList(innerType);
    }
    case kinds_js_1.Kind.NON_NULL_TYPE: {
      const innerType = typeFromAST(schema, typeNode.type);
      return innerType && new definition_js_1.GraphQLNonNull(innerType);
    }
    case kinds_js_1.Kind.NAMED_TYPE:
      return schema.getType(typeNode.name.value);
  }
}
exports.typeFromAST = typeFromAST;
