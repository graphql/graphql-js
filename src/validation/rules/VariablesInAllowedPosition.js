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
            const varType = typeFromAST(schema, varDef.type);
            if (
              varType &&
              !isTypeSubTypeOf(schema, effectiveType(varType, varDef), type)
            ) {
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
 * If varType is not non-null and defaultValue is provided and not null:
 *   Let varType be the non-null of varType.
 *
 * Note: the explicit value null may still be explicitly provided as a variable
 * value at runtime. While this validation rule could be more strict, this
 * pattern was very common before the changed behavior of null values so it is
 * still allowed.
 */
function effectiveType(varType, varDef) {
  if (
    !isNonNullType(varType) &&
    varDef.defaultValue &&
    varDef.defaultValue.kind !== Kind.NULL
  ) {
    return GraphQLNonNull(varType);
  }
  return varType;
}
