/** @category Validation Rules */

import type { Maybe } from '../../jsutils/Maybe.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DocumentNode,
  ValueNode,
  VariableDefinitionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { isExecutableDefinitionNode } from '../../language/predicates.ts';

import type {
  InputTypeReference,
  TypeReference,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Variable usages must be compatible with their expected input positions.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variable-Usages-are-Allowed
 * @category Validation Rules
 
 * @internal
 */
export const VariablesInAllowedPositionASTVisitor: ASTVisitorFn = (context) => {
  if (!hasVariableDefinitions(context.document)) {
    return {};
  }

  const { index } = context;

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
          varDef ??= varDefMap.get(varName);
          if (varDef == null || type == null) {
            continue;
          }

          const varType = index.getTypeReference(varDef.type);
          if (
            varType != null &&
            !allowedVariableUsage(
              index,
              varType,
              varDef.defaultValue,
              type,
              defaultValue,
            )
          ) {
            context.reportError(
              new GraphQLError(
                `Variable "$${varName}" of type "${index.typeToString(
                  varType,
                )}" used in position expecting type "${index.typeToString(
                  type,
                )}".`,
                { nodes: [varDef, node] },
              ),
            );
          }

          if (
            parentType != null &&
            varType != null &&
            index.isInputObjectType(parentType) &&
            index.isOneOfInputObjectType(parentType) &&
            !index.isNonNullType(varType)
          ) {
            context.reportError(
              new GraphQLError(
                `Variable "$${varName}" is of type "${index.typeToString(
                  varType,
                )}" but must be non-nullable to be used for OneOf Input Object "${index.typeToString(
                  parentType,
                )}".`,
                { nodes: [varDef, node] },
              ),
            );
          }
        }
      },
    },
    VariableDefinition(node) {
      varDefMap.set(node.variable.name.value, node);
    },
  };
};

function hasVariableDefinitions(documentNode: DocumentNode): boolean {
  for (const definition of documentNode.definitions) {
    if (
      isExecutableDefinitionNode(definition) &&
      definition.variableDefinitions != null &&
      definition.variableDefinitions.length !== 0
    ) {
      return true;
    }
  }
  return false;
}

function allowedVariableUsage(
  index: TypeSystemValidationIndex,
  varType: TypeReference,
  varDefaultValue: Maybe<ValueNode>,
  locationType: InputTypeReference,
  locationDefaultValue: unknown,
): boolean {
  if (index.isNonNullType(locationType) && !index.isNonNullType(varType)) {
    const hasNonNullVariableDefaultValue =
      varDefaultValue != null && varDefaultValue.kind !== Kind.NULL;
    const hasLocationDefaultValue = locationDefaultValue !== undefined;
    if (!hasNonNullVariableDefaultValue && !hasLocationDefaultValue) {
      return false;
    }
    return index.isInputTypeSubTypeOf(
      varType,
      index.getNullableType(locationType),
    );
  }
  return index.isInputTypeSubTypeOf(varType, locationType);
}
