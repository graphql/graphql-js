import { invariant } from '../jsutils/invariant.js';

import type { ConstValueNode } from '../language/ast.js';

import type { GraphQLArgument, GraphQLInputField } from '../type/definition.js';

import { astFromValue } from './astFromValue.js';
import { valueToLiteral } from './valueToLiteral.js';

export function getDefaultValueAST(
  argOrInputField: GraphQLArgument | GraphQLInputField,
): ConstValueNode | undefined {
  const type = argOrInputField.type;
  const externalDefaultValue = argOrInputField.externalDefaultValue;
  if (externalDefaultValue) {
    const literal =
      externalDefaultValue.literal ??
      valueToLiteral(externalDefaultValue.value, type);
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
