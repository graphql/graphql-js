import naturalCompare from '../jsutils/naturalCompare';

import type { ObjectFieldNode, ValueNode } from '../language/ast';
import { Kind } from '../language/kinds';

/**
 * Sort ValueNode.
 *
 * This function returns a sorted copy of the given ValueNode.
 *
 * @internal
 */
export function sortValueNode(valueNode: ValueNode): ValueNode {
  switch (valueNode.kind) {
    case Kind.OBJECT:
      return {
        ...valueNode,
        fields: sortFields(valueNode.fields),
      };
    case Kind.LIST:
      return {
        ...valueNode,
        values: valueNode.values.map(sortValueNode),
      };
    default:
      return valueNode;
  }
}

function sortFields(
  fields: $ReadOnlyArray<ObjectFieldNode>,
): Array<ObjectFieldNode> {
  return fields
    .map((fieldNode) => ({
      ...fieldNode,
      value: sortValueNode(fieldNode.value),
    }))
    .sort((fieldA, fieldB) =>
      naturalCompare(fieldA.name.value, fieldB.name.value),
    );
}
