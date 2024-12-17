import { invariant } from '../jsutils/invariant.js';

import type { ConstValueNode } from '../language/ast.js';

import type { GraphQLArgument, GraphQLInputField } from '../type/definition.js';

import { astFromValue } from './astFromValue.js';
import { valueToLiteral } from './valueToLiteral.js';

export function getDefaultValueAST(
  argOrInputField: GraphQLArgument | GraphQLInputField,
): ConstValueNode | undefined {
  const type = argOrInputField.type;
  const defaultInput = argOrInputField.default;
  if (defaultInput) {
    const literal =
      defaultInput.literal ?? valueToLiteral(defaultInput.value, type);
    invariant(literal != null, 'Invalid default value');
    return literal;
  }

  const defaultValue = argOrInputField.defaultValue;
  if (defaultValue !== undefined) {
    const valueAST = astFromValue(defaultValue, type);
    invariant(valueAST != null, 'Invalid default value');
    return valueAST;
  }
  return undefined;
}
