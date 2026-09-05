/** @category Validation Rules */

import type { NamedTypeNode } from '../../language/ast.ts';

import type { GraphQLUnionType } from '../../type/definition.ts';
import { isNamedType } from '../../type/definition.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Union member types must be unique within a union type.
 *
 * See https://spec.graphql.org/draft/#sec-Unions
 * @category Validation Rules
 
 * @internal
 */
export const UniqueUnionMemberTypesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      for (const {
        type: union,
        memberTypes,
      } of index.getSchemaValidationElements().unionTypes) {
        const includedTypeNames = new Set<string>();

        for (const memberType of memberTypes) {
          if (!isNamedType(memberType)) {
            continue;
          }

          if (includedTypeNames.has(memberType.name)) {
            index.reportError(
              duplicateUnionMemberTypeErrorMessage(
                String(union),
                String(memberType),
              ),
              getUnionMemberTypeNodes(union, memberType.name),
            );
          } else {
            includedTypeNames.add(memberType.name);
          }
        }
      }
    }

    for (const { message, nodes } of index.getUniqueUnionMemberTypeErrors()) {
      index.reportError(message, nodes);
    }
  };

function duplicateUnionMemberTypeErrorMessage(
  unionStr: string,
  memberTypeStr: string,
): string {
  return `Union type ${unionStr} can only include type ${memberTypeStr} once.`;
}

function getUnionMemberTypeNodes(
  union: GraphQLUnionType,
  typeName: string,
): ReadonlyArray<NamedTypeNode> | undefined {
  const { astNode, extensionASTNodes } = union;
  let typeNodes: Array<NamedTypeNode> | undefined;
  if (astNode?.types != null) {
    for (const typeNode of astNode.types) {
      if (typeNode.name.value === typeName) {
        (typeNodes ??= []).push(typeNode);
      }
    }
  }
  for (const extensionASTNode of extensionASTNodes) {
    if (extensionASTNode.types == null) {
      continue;
    }
    for (const typeNode of extensionASTNode.types) {
      if (typeNode.name.value === typeName) {
        (typeNodes ??= []).push(typeNode);
      }
    }
  }
  return typeNodes;
}
