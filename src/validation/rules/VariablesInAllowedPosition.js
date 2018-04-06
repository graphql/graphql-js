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
import type { ValueNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';
import { isNonNullType } from '../../type/definition';
import { isTypeSubTypeOf } from '../../utilities/typeComparators';
import { typeFromAST } from '../../utilities/typeFromAST';
import type { GraphQLType } from '../../type/definition';
import type { GraphQLSchema } from '../../type/schema';

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

        usages.forEach(({ node, type, defaultValue }) => {
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
              !allowedInPosition(
                schema,
                varType,
                varDef.defaultValue,
                type,
                defaultValue,
              )
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
 * Returns true if the variable is allowed in the position it was found,
 * which includes considering if default values exist for either the variable
 * or the location at which it is located.
 */
function allowedInPosition(
  schema: GraphQLSchema,
  varType: GraphQLType,
  varDefaultValue: ?ValueNode,
  locationType: GraphQLType,
  locationDefaultValue: ?mixed,
): boolean {
  if (isNonNullType(locationType) && !isNonNullType(varType)) {
    const hasLocationDefaultValue = locationDefaultValue !== undefined;
    const hasNonNullVariableDefaultValue =
      varDefaultValue && varDefaultValue.kind !== Kind.NULL;
    if (!hasLocationDefaultValue && !hasNonNullVariableDefaultValue) {
      return false;
    }
    const locationNullableType = locationType.ofType;
    return isTypeSubTypeOf(schema, varType, locationNullableType);
  }
  return isTypeSubTypeOf(schema, varType, locationType);
}
