/** @category Validation Rules */

import { inspect } from '../../jsutils/inspect.ts';

import type {
  NamedTypeNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type { GraphQLUnionType } from '../../type/definition.ts';
import { isNamedType, isObjectType } from '../../type/definition.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';
import { DocumentTypeKind } from '../TypeSystemValidationIndex.ts';

/**
 * Union member types must be object types.
 *
 * See https://spec.graphql.org/draft/#sec-Unions
 * @category Validation Rules
 
 * @internal
 */
export const UnionMembersAreObjectTypesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      for (const { memberType, union } of index.getSchemaValidationElements()
        .unionMembers) {
        if (!isNamedType(memberType) || !isObjectType(memberType)) {
          index.reportError(
            unionMemberTypeErrorMessage(String(union), inspect(memberType)),
            getUnionMemberTypeNodes(union, String(memberType)),
          );
        }
      }
    }

    for (const definition of index.document.definitions) {
      if (
        definition.kind === Kind.UNION_TYPE_DEFINITION ||
        definition.kind === Kind.UNION_TYPE_EXTENSION
      ) {
        validateTypeSystemUnionMemberTypes(index, definition);
      }
    }
  };

/** AST validation rule variant of {@link UnionMembersAreObjectTypesTypeSystemValidation}. */

function validateTypeSystemUnionMemberTypes(
  index: TypeSystemValidationIndex,
  node: UnionTypeDefinitionNode | UnionTypeExtensionNode,
): void {
  const unionName = node.name.value;
  const memberTypes = node.types;
  if (memberTypes == null) {
    return;
  }

  for (const memberTypeNode of memberTypes) {
    const memberTypeName = memberTypeNode.name.value;
    if (index.hasOtherTypeKind(memberTypeName, DocumentTypeKind.OBJECT)) {
      index.reportError(
        unionMemberTypeErrorMessage(unionName, memberTypeName),
        memberTypeNode,
      );
    }
  }
}

function unionMemberTypeErrorMessage(
  unionStr: string,
  memberTypeStr: string,
): string {
  return `Union type ${unionStr} can only include Object types, it cannot include ${memberTypeStr}.`;
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
