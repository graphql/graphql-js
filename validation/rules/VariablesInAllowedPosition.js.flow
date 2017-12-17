/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';
import type { ASTVisitor } from '../../language/visitor';
import { isNonNullType } from '../../type/definition';
import { GraphQLNonNull } from '../../type/wrappers';
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

// If a variable definition has a default value, it's effectively non-null.
function effectiveType(varType, varDef) {
  return !varDef.defaultValue || isNonNullType(varType)
    ? varType
    : GraphQLNonNull(varType);
}
