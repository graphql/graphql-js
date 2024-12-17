import { invariant } from '../jsutils/invariant.ts';
import type { ConstValueNode } from '../language/ast.ts';
import type { GraphQLArgument, GraphQLInputField } from '../type/definition.ts';
import { astFromValue } from './astFromValue.ts';
import { valueToLiteral } from './valueToLiteral.ts';
export function getDefaultValueAST(
  argOrInputField: GraphQLArgument | GraphQLInputField,
): ConstValueNode | undefined {
  const type = argOrInputField.type;
  const defaultInput = argOrInputField.default;
  if (defaultInput) {
    const literal =
      defaultInput.literal ?? valueToLiteral(defaultInput.value, type);
    literal != null || invariant(false, 'Invalid default value');
    return literal;
  }
  const defaultValue = argOrInputField.defaultValue;
  if (defaultValue !== undefined) {
    const valueAST = astFromValue(defaultValue, type);
    valueAST != null || invariant(false, 'Invalid default value');
    return valueAST;
  }
  return undefined;
}
