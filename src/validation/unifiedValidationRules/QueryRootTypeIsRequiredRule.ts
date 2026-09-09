/** @category Validation Rules */

import type {
  DefinitionNode,
  SchemaDefinitionNode,
  SchemaExtensionNode,
} from '../../language/ast.ts';
import { OperationTypeNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type { GraphQLSchema } from '../../type/schema.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Schema root operation types must include a query root type.
 *
 * See https://spec.graphql.org/draft/#sec-Root-Operation-Types
 * @category Validation Rules
 
 * @internal
 */
export const QueryRootTypeIsRequiredTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    const documentDefinitions = index.document.definitions;
    const schema = index.schema;
    if (
      schema != null &&
      !index.shouldValidateSchemaOnlyElements() &&
      !hasSchemaDefinitionOrExtension(documentDefinitions)
    ) {
      return;
    }

    const schemaNodes =
      getSchemaDefinitionOrExtensionNodes(documentDefinitions);
    if (!index.getRootOperationTypes().has(OperationTypeNode.QUERY)) {
      index.reportError(
        queryRootTypeMissingErrorMessage(),
        schemaNodes.length === 0
          ? schema == null
            ? index.document
            : getSchemaDefinitionOrExtensionNodesFromSchema(schema)
          : schemaNodes,
      );
    }
  };

/** AST validation rule variant of {@link QueryRootTypeIsRequiredTypeSystemValidation}. */

function queryRootTypeMissingErrorMessage(): string {
  return 'Query root type must be provided.';
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

function getSchemaDefinitionOrExtensionNodes(
  definitions: ReadonlyArray<DefinitionNode>,
): Array<SchemaDefinitionNode | SchemaExtensionNode> {
  const schemaNodes: Array<SchemaDefinitionNode | SchemaExtensionNode> = [];
  for (const definition of definitions) {
    if (
      definition.kind === Kind.SCHEMA_DEFINITION ||
      definition.kind === Kind.SCHEMA_EXTENSION
    ) {
      schemaNodes.push(definition);
    }
  }
  return schemaNodes;
}

function getSchemaDefinitionOrExtensionNodesFromSchema(
  schema: GraphQLSchema,
): Array<SchemaDefinitionNode | SchemaExtensionNode> | undefined {
  let schemaNodes:
    | Array<SchemaDefinitionNode | SchemaExtensionNode>
    | undefined;
  const astNode = schema.astNode;
  if (astNode != null) {
    (schemaNodes ??= []).push(astNode);
  }
  for (const extensionASTNode of schema.extensionASTNodes) {
    (schemaNodes ??= []).push(extensionASTNode);
  }
  return schemaNodes;
}
