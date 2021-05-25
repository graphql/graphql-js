'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.typeFromAST = typeFromAST;

var _inspect = require('../jsutils/inspect.js');

var _invariant = require('../jsutils/invariant.js');

var _kinds = require('../language/kinds.js');

var _definition = require('../type/definition.js');

function typeFromAST(schema, typeNode) {
  let innerType;

  if (typeNode.kind === _kinds.Kind.LIST_TYPE) {
    innerType = typeFromAST(schema, typeNode.type);
    return innerType && new _definition.GraphQLList(innerType);
  }

  if (typeNode.kind === _kinds.Kind.NON_NULL_TYPE) {
    innerType = typeFromAST(schema, typeNode.type);
    return innerType && new _definition.GraphQLNonNull(innerType);
  } // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')

  if (typeNode.kind === _kinds.Kind.NAMED_TYPE) {
    return schema.getType(typeNode.name.value);
  } // istanbul ignore next (Not reachable. All possible type nodes have been considered)

  false ||
    (0, _invariant.invariant)(
      false,
      'Unexpected type node: ' + (0, _inspect.inspect)(typeNode),
    );
}
