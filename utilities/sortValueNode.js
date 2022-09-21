'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.sortValueNode = void 0;
const naturalCompare_js_1 = require('../jsutils/naturalCompare.js');
const kinds_js_1 = require('../language/kinds.js');
/**
 * Sort ValueNode.
 *
 * This function returns a sorted copy of the given ValueNode.
 *
 * @internal
 */
function sortValueNode(valueNode) {
  switch (valueNode.kind) {
    case kinds_js_1.Kind.OBJECT:
      return {
        ...valueNode,
        fields: sortFields(valueNode.fields),
      };
    case kinds_js_1.Kind.LIST:
      return {
        ...valueNode,
        values: valueNode.values.map(sortValueNode),
      };
    case kinds_js_1.Kind.INT:
    case kinds_js_1.Kind.FLOAT:
    case kinds_js_1.Kind.STRING:
    case kinds_js_1.Kind.BOOLEAN:
    case kinds_js_1.Kind.NULL:
    case kinds_js_1.Kind.ENUM:
    case kinds_js_1.Kind.VARIABLE:
      return valueNode;
  }
}
exports.sortValueNode = sortValueNode;
function sortFields(fields) {
  return fields
    .map((fieldNode) => ({
      ...fieldNode,
      value: sortValueNode(fieldNode.value),
    }))
    .sort((fieldA, fieldB) =>
      (0, naturalCompare_js_1.naturalCompare)(
        fieldA.name.value,
        fieldB.name.value,
      ),
    );
}
