/** @category Validation Rules */

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';
import {
  DocumentTypeKind,
  TypeElementKind,
} from '../TypeSystemValidationIndex.ts';

/**
 * Object and interface types must define one or more fields.
 *
 * See https://spec.graphql.org/draft/#sec-Objects
 * See https://spec.graphql.org/draft/#sec-Interfaces
 * @category Validation Rules
 
 * @internal
 */
export const ObjectAndInterfaceTypesHaveFieldsTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.schema != null && !index.hasDocumentDefinitions) {
      for (const { type, fields } of index.getSchemaValidationElements()
        .objectTypes) {
        if (fields.length === 0) {
          index.reportError(objectOrInterfaceFieldSetErrorMessage(type.name), [
            type.astNode,
            ...type.extensionASTNodes,
          ]);
        }
      }

      for (const { type, fields } of index.getSchemaValidationElements()
        .interfaceTypes) {
        if (fields.length === 0) {
          index.reportError(objectOrInterfaceFieldSetErrorMessage(type.name), [
            type.astNode,
            ...type.extensionASTNodes,
          ]);
        }
      }
      return;
    }

    for (const typeName of index.getValidationTypeNames()) {
      if (
        (index.hasTypeKind(typeName, DocumentTypeKind.OBJECT) ||
          index.hasTypeKind(typeName, DocumentTypeKind.INTERFACE)) &&
        !index.hasTypeElements(typeName, TypeElementKind.OUTPUT_FIELD)
      ) {
        index.reportError(
          objectOrInterfaceFieldSetErrorMessage(typeName),
          index.documentIndex.getDocumentTypeNodes(typeName),
        );
      }
    }
  };

function objectOrInterfaceFieldSetErrorMessage(typeStr: string): string {
  return `Type ${typeStr} must define one or more fields.`;
}
