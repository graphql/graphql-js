/** @category Validation Rules */

import { AccumulatorMap } from '../../jsutils/AccumulatorMap.ts';
import { andList } from '../../jsutils/formatList.ts';
import type { Maybe } from '../../jsutils/Maybe.ts';

import type {
  ASTNode,
  DefinitionNode,
  OperationTypeNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type { GraphQLObjectType } from '../../type/definition.ts';
import { isObjectType } from '../../type/definition.ts';
import type { GraphQLSchema } from '../../type/schema.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';
import { DocumentTypeKind } from '../TypeSystemValidationIndex.ts';

/**
 * Root operation types must all be different when provided.
 *
 * See https://spec.graphql.org/draft/#sec-Root-Operation-Types
 * @category Validation Rules
 
 * @internal
 */
export const UniqueRootOperationTypesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    const schema = index.schema;
    const hasDocumentRootOperationTypes = hasSchemaDefinitionOrExtension(
      index.document.definitions,
    );

    if (index.shouldValidateSchemaOnlyElements() && schema != null) {
      const rootTypesMap = new AccumulatorMap<
        GraphQLObjectType,
        OperationTypeNode
      >();
      for (const { rootType, operation } of index.getSchemaValidationElements()
        .rootTypes) {
        if (isObjectType(rootType)) {
          rootTypesMap.add(rootType, operation);
        }
      }

      for (const [rootType, operationTypes] of rootTypesMap) {
        if (operationTypes.length > 1) {
          index.reportError(
            rootOperationTypeUniquenessErrorMessage(
              String(rootType),
              operationTypes,
            ),
            operationTypes.map((operationType) =>
              getOperationTypeNode(schema, operationType),
            ),
          );
        }
      }
    }

    if (schema != null && !hasDocumentRootOperationTypes) {
      return;
    }

    const rootTypesMap = new AccumulatorMap<string, OperationTypeNode>();

    for (const [operation, rootType] of index.getRootOperationTypes()) {
      if (index.hasTypeKind(rootType.typeName, DocumentTypeKind.OBJECT)) {
        rootTypesMap.add(rootType.typeName, operation);
      }
    }

    for (const [typeName, operationTypes] of rootTypesMap) {
      if (operationTypes.length <= 1) {
        continue;
      }

      const rootOperationTypes = index.getRootOperationTypes();
      let nodes: Array<ASTNode> | undefined;
      for (const operationType of operationTypes) {
        const node = rootOperationTypes.get(operationType)?.node;
        if (node != null) {
          (nodes ??= []).push(node);
        }
      }

      index.reportError(
        rootOperationTypeUniquenessErrorMessage(typeName, operationTypes),
        nodes ?? index.documentIndex.getDocumentTypeNodes(typeName),
      );
    }
  };

/** AST validation rule variant of {@link UniqueRootOperationTypesTypeSystemValidation}. */

function rootOperationTypeUniquenessErrorMessage(
  typeStr: string,
  operationTypes: ReadonlyArray<OperationTypeNode>,
): string {
  return `All root types must be different, "${typeStr}" type is used as ${andList(
    operationTypes,
  )} root types.`;
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
