import { didYouMean } from '../../jsutils/didYouMean.js';
import { suggestionList } from '../../jsutils/suggestionList.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTNode } from '../../language/ast.js';
import {
  isTypeDefinitionNode,
  isTypeSystemDefinitionNode,
  isTypeSystemExtensionNode,
} from '../../language/predicates.js';
import type { ASTVisitor } from '../../language/visitor.js';

import { introspectionTypes } from '../../type/introspection.js';
import { specifiedScalarTypes } from '../../type/scalars.js';

import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext.js';

/**
 * Known type names
 *
 * A GraphQL document is only valid if referenced types (specifically
 * variable definitions and fragment conditions) are defined by the type schema.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-Spread-Type-Existence
 */
export function KnownTypeNamesRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor {
  const { definitions } = context.getDocument();
  const existingTypesMap = context.getSchema()?.getTypeMap() ?? {};

  const typeNames = new Set([
    ...Object.keys(existingTypesMap),
    ...definitions.filter(isTypeDefinitionNode).map((def) => def.name.value),
  ]);

  return {
    NamedType(node, _1, parent, _2, ancestors) {
      const typeName = node.name.value;
      if (!typeNames.has(typeName)) {
        const definitionNode = ancestors[2] ?? parent;
        const isSDL = definitionNode != null && isSDLNode(definitionNode);
        if (isSDL && standardTypeNames.has(typeName)) {
          return;
        }

        const suggestedTypes = context.hideSuggestions
          ? []
          : suggestionList(
              typeName,
              isSDL ? [...standardTypeNames, ...typeNames] : [...typeNames],
            );
        context.reportError(
          new GraphQLError(
            `Unknown type "${typeName}".` + didYouMean(suggestedTypes),
            { nodes: node },
          ),
        );
      }
    },
  };
}

const standardTypeNames = new Set<string>(
  [...specifiedScalarTypes, ...introspectionTypes].map((type) => type.name),
);

function isSDLNode(value: ASTNode | ReadonlyArray<ASTNode>): boolean {
  return (
    'kind' in value &&
    (isTypeSystemDefinitionNode(value) || isTypeSystemExtensionNode(value))
  );
}
