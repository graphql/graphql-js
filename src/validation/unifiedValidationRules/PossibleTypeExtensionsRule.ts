/** @category Validation Rules */

import { didYouMean } from '../../jsutils/didYouMean.ts';
import { suggestionList } from '../../jsutils/suggestionList.ts';

import type {
  DefinitionNode,
  TypeDefinitionNode,
  TypeExtensionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import {
  isTypeDefinitionNode,
  isTypeExtensionNode,
} from '../../language/predicates.ts';

import type { GraphQLNamedType } from '../../type/definition.ts';
import {
  isEnumType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
} from '../../type/definition.ts';
import type { GraphQLSchema } from '../../type/schema.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Type extensions must extend an existing type of the same kind.
 *
 * See https://spec.graphql.org/draft/#sec-Type-Extensions
 * @category Validation Rules
 
 * @internal
 */
export const PossibleTypeExtensionsTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    validateTypeExtensions(
      index.document.definitions,
      index.schema,
      index.hideSuggestions === true,
      (message, nodes) => {
        index.reportError(message, nodes);
      },
    );
  };

/** AST validation rule variant of {@link PossibleTypeExtensionsTypeSystemValidation}. */

function validateTypeExtensions(
  definitions: ReadonlyArray<DefinitionNode>,
  schema: GraphQLSchema | null | undefined,
  hideSuggestions: boolean,
  reportError: (
    message: string,
    nodes:
      | TypeExtensionNode
      | TypeExtensionNode['name']
      | ReadonlyArray<TypeDefinitionNode | TypeExtensionNode>,
  ) => void,
): void {
  const definedTypes = new Map<string, TypeDefinitionNode>();

  for (const def of definitions) {
    if (isTypeDefinitionNode(def)) {
      definedTypes.set(def.name.value, def);
    }
  }

  for (const node of definitions) {
    if (!isTypeExtensionNode(node)) {
      continue;
    }
    const typeName = node.name.value;
    const defNode = definedTypes.get(typeName);
    const existingType = schema?.getType(typeName);

    let expectedKind: Kind | undefined;
    if (defNode != null) {
      expectedKind = defKindToExtKind[defNode.kind];
    } else if (existingType != null) {
      expectedKind = typeToExtKind(existingType);
    }

    if (expectedKind != null) {
      if (expectedKind !== node.kind) {
        const kindStr = extensionKindToTypeName(node.kind);
        reportError(
          `Cannot extend non-${kindStr} type "${typeName}".`,
          defNode != null ? [defNode, node] : node,
        );
      }
    } else {
      const allTypeNames = [
        ...definedTypes.keys(),
        ...Object.keys(schema?.getTypeMap() ?? {}),
      ];

      reportError(
        `Cannot extend type "${typeName}" because it is not defined.` +
          didYouMean(
            hideSuggestions ? [] : suggestionList(typeName, allTypeNames),
          ),
        node.name,
      );
    }
  }
}

const defKindToExtKind = {
  [Kind.SCALAR_TYPE_DEFINITION]: Kind.SCALAR_TYPE_EXTENSION,
  [Kind.OBJECT_TYPE_DEFINITION]: Kind.OBJECT_TYPE_EXTENSION,
  [Kind.INTERFACE_TYPE_DEFINITION]: Kind.INTERFACE_TYPE_EXTENSION,
  [Kind.UNION_TYPE_DEFINITION]: Kind.UNION_TYPE_EXTENSION,
  [Kind.ENUM_TYPE_DEFINITION]: Kind.ENUM_TYPE_EXTENSION,
  [Kind.INPUT_OBJECT_TYPE_DEFINITION]: Kind.INPUT_OBJECT_TYPE_EXTENSION,
} as const;

function typeToExtKind(type: GraphQLNamedType): TypeExtensionNode['kind'] {
  if (isScalarType(type)) {
    return Kind.SCALAR_TYPE_EXTENSION;
  }
  if (isObjectType(type)) {
    return Kind.OBJECT_TYPE_EXTENSION;
  }
  if (isInterfaceType(type)) {
    return Kind.INTERFACE_TYPE_EXTENSION;
  }
  if (isUnionType(type)) {
    return Kind.UNION_TYPE_EXTENSION;
  }
  if (isEnumType(type)) {
    return Kind.ENUM_TYPE_EXTENSION;
  }
  return Kind.INPUT_OBJECT_TYPE_EXTENSION;
}

function extensionKindToTypeName(kind: TypeExtensionNode['kind']): string {
  switch (kind) {
    case Kind.SCALAR_TYPE_EXTENSION:
      return 'scalar';
    case Kind.OBJECT_TYPE_EXTENSION:
      return 'object';
    case Kind.INTERFACE_TYPE_EXTENSION:
      return 'interface';
    case Kind.UNION_TYPE_EXTENSION:
      return 'union';
    case Kind.ENUM_TYPE_EXTENSION:
      return 'enum';
    case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      return 'input object';
  }
}
