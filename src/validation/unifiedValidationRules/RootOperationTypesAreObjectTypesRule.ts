/** @category Validation Rules */

import { capitalize } from '../../jsutils/capitalize.ts';
import { inspect } from '../../jsutils/inspect.ts';
import type { Maybe } from '../../jsutils/Maybe.ts';

import type { ASTNode, DefinitionNode } from '../../language/ast.ts';
import { OperationTypeNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import { isNamedType, isObjectType } from '../../type/definition.ts';
import type { GraphQLSchema } from '../../type/schema.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';
import { DocumentTypeKind } from '../TypeSystemValidationIndex.ts';

/**
 * Root operation types must be object types.
 *
 * See https://spec.graphql.org/draft/#sec-Root-Operation-Types
 * @category Validation Rules
 
 * @internal
 */
export const RootOperationTypesAreObjectTypesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    const schema = index.schema;
    if (schema != null && index.shouldValidateSchemaOnlyElements()) {
      for (const { rootType, operation } of index.getSchemaValidationElements()
        .rootTypes) {
        if (!isObjectType(rootType)) {
          index.reportError(
            rootOperationTypeKindErrorMessage(operation, inspect(rootType)),
            getOperationTypeNode(schema, operation) ??
              (isNamedType(rootType) ? rootType.astNode : undefined),
          );
        }
      }
    }

    if (
      schema != null &&
      !hasSchemaDefinitionOrExtension(index.document.definitions)
    ) {
      return;
    }

    for (const [operation, rootType] of index.getRootOperationTypes()) {
      if (!index.hasOtherTypeKind(rootType.typeName, DocumentTypeKind.OBJECT)) {
        continue;
      }

      index.reportError(
        rootOperationTypeKindErrorMessage(operation, rootType.typeName),
        rootType.node ??
          index.documentIndex.getDocumentTypeNodes(rootType.typeName),
      );
    }
  };

/** AST validation rule variant of {@link RootOperationTypesAreObjectTypesTypeSystemValidation}. */

function rootOperationTypeKindErrorMessage(
  operation: OperationTypeNode,
  rootTypeStr: string,
): string {
  const operationTypeStr = capitalize(operation);
  return operation === OperationTypeNode.QUERY
    ? `${operationTypeStr} root type must be Object type, it cannot be ${rootTypeStr}.`
    : `${operationTypeStr} root type must be Object type if provided, it cannot be ${rootTypeStr}.`;
}

function getOperationTypeNode(
  schema: GraphQLSchema,
  operation: OperationTypeNode,
): Maybe<ASTNode> {
  const schemaNode = schema.astNode;
  if (schemaNode?.operationTypes != null) {
    for (const operationNode of schemaNode.operationTypes) {
      if (operationNode.operation === operation) {
        return operationNode.type;
      }
    }
  }

  for (const extensionASTNode of schema.extensionASTNodes) {
    if (extensionASTNode.operationTypes == null) {
      continue;
    }
    for (const operationNode of extensionASTNode.operationTypes) {
      if (operationNode.operation === operation) {
        return operationNode.type;
      }
    }
  }
}

function hasSchemaDefinitionOrExtension(
  definitions: ReadonlyArray<DefinitionNode>,
): boolean {
  for (const definition of definitions) {
    if (
      definition.kind === Kind.SCHEMA_DEFINITION ||
      definition.kind === Kind.SCHEMA_EXTENSION
    ) {
      return true;
    }
  }
  return false;
}
