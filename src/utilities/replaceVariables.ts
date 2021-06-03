import type { Maybe } from '../jsutils/Maybe';

import type { ValueNode, ConstValueNode } from '../language/ast';
import { Kind } from '../language/kinds';
import { visit } from '../language/visitor';

import type { VariableValues } from '../execution/values';

import { valueToLiteral } from './valueToLiteral';

/**
 * Replaces any Variables found within an AST Value literal with literals
 * supplied from a map of variable values, or removed if no variable replacement
 * exists, returning a constant value.
 *
 * Used primarily to ensure only complete constant values are used during input
 * coercion of custom scalars which accept complex literals.
 */
export function replaceVariables(
  valueNode: ValueNode,
  variables?: Maybe<VariableValues>,
): ConstValueNode {
  return visit(valueNode, {
    Variable(node) {
      const variableSource = variables?.sources[node.name.value];
      if (!variableSource) {
        return { kind: Kind.NULL };
      }
      if (
        variableSource.value === undefined &&
        variableSource.variable.defaultValue
      ) {
        return variableSource.variable.defaultValue;
      }
      return valueToLiteral(variableSource.value, variableSource.type);
    },
    ObjectValue(node) {
      return {
        ...node,
        // Filter out any fields with a missing variable.
        fields: node.fields.filter(
          (field) =>
            field.value.kind !== Kind.VARIABLE ||
            variables?.sources[field.value.name.value],
        ),
      };
    },
  }) as ConstValueNode;
}
