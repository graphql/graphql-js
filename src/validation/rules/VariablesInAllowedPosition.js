/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type ValidationContext from '../ValidationContext';
import { GraphQLError } from '../../error';
import { Kind } from '../../language/kinds';
import type { ASTVisitor } from '../../language/visitor';
import { GraphQLNonNull, isNonNullType } from '../../type/definition';
import { isTypeSubTypeOf } from '../../utilities/typeComparators';
import { typeFromAST } from '../../utilities/typeFromAST';
import type { GraphQLType } from '../../type/definition';

export function badVarPosMessage(
  varName: string,
  varType: GraphQLType,
  expectedType: GraphQLType,
): string {
  return (
    `Variable "$${varName}" of type "${String(varType)}" used in ` +
    `position expecting type "${String(expectedType)}".`
  );
}

/**
 * Variables passed to field arguments conform to type
 */
export function VariablesInAllowedPosition(
  context: ValidationContext,
): ASTVisitor {
  let varDefMap = Object.create(null);

  return {
    OperationDefinition: {
      enter() {
        varDefMap = Object.create(null);
      },
      leave(operation) {
        const usages = context.getRecursiveVariableUsages(operation);

        usages.forEach(({ node, type }) => {
          const varName = node.name.value;
          const varDef = varDefMap[varName];
          if (varDef && type) {
            // A var type is allowed if it is the same or more strict (e.g. is
            // a subtype of) than the expected type. It can be more strict if
            // the variable type is non-null when the expected type is nullable.
            // If both are list types, the variable item type can be more strict
            // than the expected item type (contravariant).
            const schema = context.getSchema();
            const varType = effectiveVariableType(context, schema, varDef);
            if (varType && !isTypeSubTypeOf(schema, varType, type)) {
              context.reportError(
                new GraphQLError(badVarPosMessage(varName, varType, type), [
                  varDef,
                  node,
                ]),
              );
            }
          }
        });
      },
    },
    VariableDefinition(node) {
      varDefMap[node.variable.name.value] = node;
    },
  };
}

/**
 * See "supporting legacy operations" sub-section of this validation
 * rule specification.
 *
 * EffectiveVariableType(variableDefinition):
 *   * Let {variableType} be the expected type of {variableDefinition}.
 *   * If service supports operations written before this specification edition:
 *     * If {variableType} is not a non-null type:
 *       * Let {defaultValue} be the default value of {variableDefinition}.
 *       * If {defaultValue} is provided and not the value {null}:
 *         * Return the non-null of {variableType}.
 *   * Otherwise, return {variableType}.
 */
function effectiveVariableType(context, schema, varDef) {
  const varType = typeFromAST(schema, varDef.type);
  if (
    context.options.allowNullableVariablesInNonNullPositions &&
    varType &&
    !isNonNullType(varType) &&
    varDef.defaultValue &&
    varDef.defaultValue.kind !== Kind.NULL
  ) {
    return GraphQLNonNull(varType);
  }
  return varType;
}
