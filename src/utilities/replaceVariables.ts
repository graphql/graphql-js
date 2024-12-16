import type { Maybe } from '../jsutils/Maybe.js';

import type {
  ConstValueNode,
  ObjectFieldNode,
  ValueNode,
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import type { VariableValues } from '../execution/values.js';

import { valueToLiteral } from './valueToLiteral.js';

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
  variableValues?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<VariableValues>,
): ConstValueNode {
  switch (valueNode.kind) {
    case Kind.VARIABLE: {
      const varName = valueNode.name.value;
      const scopedVariableValues = fragmentVariableValues?.sources[varName]
        ? fragmentVariableValues
        : variableValues;

      const scopedVariableSource = scopedVariableValues?.sources[varName];
      if (scopedVariableSource == null) {
        return { kind: Kind.NULL };
      }

      if (scopedVariableSource.value === undefined) {
        const defaultValue = scopedVariableSource.signature.default;
        if (defaultValue !== undefined) {
          return defaultValue.literal;
        }
      }

      return valueToLiteral(
        scopedVariableSource.value,
        scopedVariableSource.signature.type,
      ) as ConstValueNode;
    }
    case Kind.OBJECT: {
      const newFields: Array<ObjectFieldNode> = [];
      for (const field of valueNode.fields) {
        if (field.value.kind === Kind.VARIABLE) {
          const scopedVariableSource =
            fragmentVariableValues?.sources[field.value.name.value] ??
            variableValues?.sources[field.value.name.value];

          if (
            scopedVariableSource?.value === undefined &&
            scopedVariableSource?.signature.default === undefined
          ) {
            continue;
          }
        }
        const newFieldNodeValue = replaceVariables(
          field.value,
          variableValues,
          fragmentVariableValues,
        );
        newFields.push({
          ...field,
          value: newFieldNodeValue,
        });
      }
      return {
        ...valueNode,
        fields: newFields,
      } as ConstValueNode;
    }
    case Kind.LIST: {
      const newValues: Array<ValueNode> = [];
      for (const value of valueNode.values) {
        const newItemNodeValue = replaceVariables(
          value,
          variableValues,
          fragmentVariableValues,
        );
        newValues.push(newItemNodeValue);
      }
      return {
        ...valueNode,
        values: newValues,
      } as ConstValueNode;
    }
    default: {
      return valueNode;
    }
  }
}
