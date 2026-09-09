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
 * Union types must define one or more member types.
 *
 * See https://spec.graphql.org/draft/#sec-Unions
 * @category Validation Rules
 
 * @internal
 */
export const UnionTypesHaveMembersTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.schema != null && !index.hasDocumentDefinitions) {
      for (const { type, memberTypes } of index.getSchemaValidationElements()
        .unionTypes) {
        if (memberTypes.length === 0) {
          index.reportError(unionMemberSetErrorMessage(type.name), [
            type.astNode,
            ...type.extensionASTNodes,
          ]);
        }
      }
      return;
    }

    for (const typeName of index.getValidationTypeNames()) {
      if (
        index.hasTypeKind(typeName, DocumentTypeKind.UNION) &&
        !index.hasTypeElements(typeName, TypeElementKind.UNION_MEMBER)
      ) {
        index.reportError(
          unionMemberSetErrorMessage(typeName),
          index.documentIndex.getDocumentTypeNodes(typeName),
        );
      }
    }
  };

function unionMemberSetErrorMessage(typeStr: string): string {
  return `Union type ${typeStr} must define one or more member types.`;
}
