/** @category Validation Rules */

import { didYouMean } from '../../jsutils/didYouMean.ts';
import { suggestionList } from '../../jsutils/suggestionList.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DefinitionNode,
  NamedTypeNode,
  TypeNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Type references must name a defined type.
 *
 * See https://spec.graphql.org/draft/#sec-Type-References
 * See https://spec.graphql.org/draft/#sec-Fragment-Spread-Type-Existence
 * See https://spec.graphql.org/draft/#sec-Variables-Are-Input-Types
 * @category Validation Rules
 * @internal
 */
export const KnownTypeNamesASTVisitor: ASTVisitorFn = (context) => {
  let executableDefinitionDepth = 0;
  let typeNames: ReadonlyArray<string> | undefined;
  const knownTypeNames = new Set<string>();
  const unknownTypeNames = new Set<string>();

  function validateNamedType(node: NamedTypeNode): void {
    const typeName = node.name.value;
    if (hasTypeInIndex(typeName)) {
      return;
    }

    typeNames ??= getTypeNames();
    const suggestions = context.hideSuggestions
      ? []
      : suggestionList(typeName, typeNames);

    context.reportError(
      new GraphQLError(
        `Unknown type "${typeName}".` + didYouMean(suggestions),
        { nodes: node },
      ),
    );
  }

  function hasTypeInIndex(typeName: string): boolean {
    if (knownTypeNames.has(typeName)) {
      return true;
    }
    if (unknownTypeNames.has(typeName)) {
      return false;
    }
    if (context.index.hasExecutableType(typeName)) {
      knownTypeNames.add(typeName);
      return true;
    }
    unknownTypeNames.add(typeName);
    return false;
  }

  function getTypeNames(): ReadonlyArray<string> {
    return context.index.getExecutableTypeNames();
  }

  return {
    OperationDefinition: {
      enter() {
        executableDefinitionDepth += 1;
      },
      leave() {
        executableDefinitionDepth -= 1;
      },
    },
    FragmentDefinition: {
      enter() {
        executableDefinitionDepth += 1;
      },
      leave() {
        executableDefinitionDepth -= 1;
      },
    },
    NamedType(node) {
      if (executableDefinitionDepth !== 0) {
        validateNamedType(node);
      }
    },
  };
};

/** Direct validation variant of {@link KnownTypeNamesASTVisitor}.
 * @internal
 */
export const KnownTypeNamesTypeSystemValidation: TypeSystemValidationFn = (
  index: TypeSystemValidationIndex,
): void => {
  let typeNames: ReadonlyArray<string> | undefined;
  const knownTypeNames = new Set<string>();
  const unknownTypeNames = new Set<string>();

  for (const definition of index.document.definitions) {
    validateDefinition(definition);
  }

  function validateNamedType(node: NamedTypeNode): void {
    const typeName = node.name.value;
    if (hasTypeInIndex(typeName)) {
      return;
    }

    typeNames ??= index.getTypeNames();
    const suggestions = index.hideSuggestions
      ? []
      : suggestionList(typeName, typeNames);

    index.reportError(
      `Unknown type "${typeName}".` + didYouMean(suggestions),
      node,
    );
  }

  function hasTypeInIndex(typeName: string): boolean {
    if (knownTypeNames.has(typeName)) {
      return true;
    }
    if (unknownTypeNames.has(typeName)) {
      return false;
    }
    if (index.hasTypeName(typeName)) {
      knownTypeNames.add(typeName);
      return true;
    }
    unknownTypeNames.add(typeName);
    return false;
  }

  function validateDefinition(definition: DefinitionNode): void {
    switch (definition.kind) {
      case Kind.SCHEMA_DEFINITION:
      case Kind.SCHEMA_EXTENSION: {
        const operationTypes = definition.operationTypes;
        if (operationTypes == null) {
          break;
        }
        for (const operationType of operationTypes) {
          validateNamedType(operationType.type);
        }
        break;
      }
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION:
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_EXTENSION: {
        const interfaces = definition.interfaces;
        if (interfaces != null) {
          for (const iface of interfaces) {
            validateNamedType(iface);
          }
        }
        const fields = definition.fields;
        if (fields != null) {
          for (const field of fields) {
            const args = field.arguments;
            if (args != null) {
              for (const arg of args) {
                validateType(arg.type);
              }
            }
            validateType(field.type);
          }
        }
        break;
      }
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION: {
        const types = definition.types;
        if (types == null) {
          break;
        }
        for (const type of types) {
          validateNamedType(type);
        }
        break;
      }
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION: {
        const fields = definition.fields;
        if (fields == null) {
          break;
        }
        for (const field of fields) {
          validateType(field.type);
        }
        break;
      }
      case Kind.DIRECTIVE_DEFINITION: {
        const args = definition.arguments;
        if (args == null) {
          break;
        }
        for (const arg of args) {
          validateType(arg.type);
        }
        break;
      }
      default:
        break;
    }
  }

  function validateType(type: TypeNode): void {
    if (type.kind === Kind.NAMED_TYPE) {
      validateNamedType(type);
    } else {
      validateType(type.type);
    }
  }
};
