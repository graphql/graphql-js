/** @category Validation Rules */

import type {
  OperationTypeDefinitionNode,
  SchemaDefinitionNode,
  SchemaExtensionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * A schema definition or extension must not provide the same root operation
 * type more than once.
 *
 * See https://spec.graphql.org/draft/#sec-Root-Operation-Types
 * @category Validation Rules
 
 * @internal
 */
export const UniqueOperationTypesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    const schema = index.schema;
    const definedOperationTypes = new Map<
      string,
      OperationTypeDefinitionNode
    >();
    const existingOperationTypes = schema
      ? {
          query: schema.getQueryType(),
          mutation: schema.getMutationType(),
          subscription: schema.getSubscriptionType(),
        }
      : {};

    for (const definition of index.document.definitions) {
      if (
        definition.kind === Kind.SCHEMA_DEFINITION ||
        definition.kind === Kind.SCHEMA_EXTENSION
      ) {
        checkTypeSystemOperationTypes(
          index,
          definition,
          definedOperationTypes,
          existingOperationTypes,
        );
      }
    }
  };

/** AST validation rule variant of {@link UniqueOperationTypesTypeSystemValidation}. */

function checkTypeSystemOperationTypes(
  index: TypeSystemValidationIndex,
  node: SchemaDefinitionNode | SchemaExtensionNode,
  definedOperationTypes: Map<string, OperationTypeDefinitionNode>,
  existingOperationTypes: {
    query?: unknown;
    mutation?: unknown;
    subscription?: unknown;
  },
): void {
  const operationTypesNodes = node.operationTypes;
  if (operationTypesNodes == null) {
    return;
  }

  for (const operationType of operationTypesNodes) {
    const operation = operationType.operation;
    const alreadyDefinedOperationType = definedOperationTypes.get(operation);

    if (existingOperationTypes[operation] !== undefined) {
      index.reportError(
        `Type for ${operation} already defined in the schema. It cannot be redefined.`,
        operationType,
      );
    } else if (alreadyDefinedOperationType) {
      index.reportError(`There can be only one ${operation} type in schema.`, [
        alreadyDefinedOperationType,
        operationType,
      ]);
    } else {
      definedOperationTypes.set(operation, operationType);
    }
  }
}
