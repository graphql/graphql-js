/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';
import { GraphQLList, GraphQLNonNull } from '../../type/definition';
import { typeFromAST } from '../../utilities/typeFromAST';


export function badVarPosMessage(
  varName: any,
  varType: any,
  expectedType: any
): string {
  return `Variable "$${varName}" of type "${varType}" used in position ` +
    `expecting type "${expectedType}".`;
}

/**
 * Variables passed to field arguments conform to type
 */
export function VariablesInAllowedPosition(context: ValidationContext): any {
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
          const varType =
            varDef && typeFromAST(context.getSchema(), varDef.type);
          if (varType && type &&
              !varTypeAllowedForType(effectiveType(varType, varDef), type)) {
            context.reportError(new GraphQLError(
              badVarPosMessage(varName, varType, type),
              [ node ]
            ));
          }
        });
      }
    },
    VariableDefinition(varDefAST) {
      varDefMap[varDefAST.variable.name.value] = varDefAST;
    }
  };
}

// If a variable definition has a default value, it's effectively non-null.
function effectiveType(varType, varDef) {
  return !varDef.defaultValue || varType instanceof GraphQLNonNull ?
    varType :
    new GraphQLNonNull(varType);
}

// A var type is allowed if it is the same or more strict than the expected
// type. It can be more strict if the variable type is non-null when the
// expected type is nullable. If both are list types, the variable item type can
// be more strict than the expected item type.
function varTypeAllowedForType(varType, expectedType): boolean {
  if (expectedType instanceof GraphQLNonNull) {
    if (varType instanceof GraphQLNonNull) {
      return varTypeAllowedForType(varType.ofType, expectedType.ofType);
    }
    return false;
  }
  if (varType instanceof GraphQLNonNull) {
    return varTypeAllowedForType(varType.ofType, expectedType);
  }
  if (varType instanceof GraphQLList && expectedType instanceof GraphQLList) {
    return varTypeAllowedForType(varType.ofType, expectedType.ofType);
  }
  return varType === expectedType;
}
