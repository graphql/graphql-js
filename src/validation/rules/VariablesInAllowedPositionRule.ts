import type { Maybe } from '../../jsutils/Maybe.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import type { ValueNode, VariableDefinitionNode } from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { GraphQLType } from '../../type/definition.js';
import {
  isInputObjectType,
  isNonNullType,
  isNullableType,
} from '../../type/definition.js';
import type { GraphQLSchema } from '../../type/schema.js';

import { isTypeSubTypeOf } from '../../utilities/typeComparators.js';
import { typeFromAST } from '../../utilities/typeFromAST.js';

import type { ValidationContext } from '../ValidationContext.js';

/**
 * Variables in allowed position
 *
 * Variable usages must be compatible with the arguments they are passed to.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variable-Usages-are-Allowed
 */
export function VariablesInAllowedPositionRule(
  context: ValidationContext,
): ASTVisitor {
  let varDefMap: Map<string, VariableDefinitionNode>;

  return {
    OperationDefinition: {
      enter() {
        varDefMap = new Map();
      },
      leave(operation) {
        const usages = context.getRecursiveVariableUsages(operation);

        for (const {
          node,
          type,
          parentType,
          defaultValue,
          fragmentVariableDefinition,
        } of usages) {
          const varName = node.name.value;

          let varDef = fragmentVariableDefinition;
          if (!varDef) {
            varDef = varDefMap.get(varName);
          }
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
              !allowedVariableUsage(
                schema,
                varType,
                varDef.defaultValue,
                type,
                defaultValue,
              )
            ) {
              context.reportError(
                new GraphQLError(
                  `Variable "$${varName}" of type "${varType}" used in position expecting type "${type}".`,
                  { nodes: [varDef, node] },
                ),
              );
            }

            if (
              isInputObjectType(parentType) &&
              parentType.isOneOf &&
              isNullableType(varType)
            ) {
              context.reportError(
                new GraphQLError(
                  `Variable "$${varName}" is of type "${varType}" but must be non-nullable to be used for OneOf Input Object "${parentType}".`,
                  { nodes: [varDef, node] },
                ),
              );
            }
          }
        }
      },
    },
    VariableDefinition(node) {
      varDefMap.set(node.variable.name.value, node);
    },
  };
}

/**
 * Returns true if the variable is allowed in the location it was found,
 * including considering if default values exist for either the variable
 * or the location at which it is located.
 *
 * OneOf Input Object Type fields are considered separately above to
 * provide a more descriptive error message.
 */
function allowedVariableUsage(
  schema: GraphQLSchema,
  varType: GraphQLType,
  varDefaultValue: Maybe<ValueNode>,
  locationType: GraphQLType,
  locationDefaultValue: unknown,
): boolean {
  if (isNonNullType(locationType) && !isNonNullType(varType)) {
    const hasNonNullVariableDefaultValue =
      varDefaultValue != null && varDefaultValue.kind !== Kind.NULL;
    const hasLocationDefaultValue = locationDefaultValue !== undefined;
    if (!hasNonNullVariableDefaultValue && !hasLocationDefaultValue) {
      return false;
    }
    const nullableLocationType = locationType.ofType;
    return isTypeSubTypeOf(schema, varType, nullableLocationType);
  }
  return isTypeSubTypeOf(schema, varType, locationType);
}
