import { didYouMean } from '../../jsutils/didYouMean.ts';
import { suggestionList } from '../../jsutils/suggestionList.ts';
import { GraphQLError } from '../../error/GraphQLError.ts';
import type { ASTNode } from '../../language/ast.ts';
import {
  isTypeDefinitionNode,
  isTypeSystemDefinitionNode,
  isTypeSystemExtensionNode,
} from '../../language/predicates.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import { introspectionTypes } from '../../type/introspection.ts';
import { specifiedScalarTypes } from '../../type/scalars.ts';
import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext.ts';
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
  const schema = context.getSchema();
  const existingTypesMap = schema ? schema.getTypeMap() : Object.create(null);
  const definedTypes = Object.create(null);
  for (const def of context.getDocument().definitions) {
    if (isTypeDefinitionNode(def)) {
      definedTypes[def.name.value] = true;
    }
  }
  const typeNames = [
    ...Object.keys(existingTypesMap),
    ...Object.keys(definedTypes),
  ];
  return {
    NamedType(node, _1, parent, _2, ancestors) {
      const typeName = node.name.value;
      if (!existingTypesMap[typeName] && !definedTypes[typeName]) {
        const definitionNode = ancestors[2] ?? parent;
        const isSDL = definitionNode != null && isSDLNode(definitionNode);
        if (isSDL && standardTypeNames.includes(typeName)) {
          return;
        }
        const suggestedTypes = suggestionList(
          typeName,
          isSDL ? standardTypeNames.concat(typeNames) : typeNames,
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
const standardTypeNames = [...specifiedScalarTypes, ...introspectionTypes].map(
  (type) => type.name,
);
function isSDLNode(value: ASTNode | ReadonlyArray<ASTNode>): boolean {
  return (
    'kind' in value &&
    (isTypeSystemDefinitionNode(value) || isTypeSystemExtensionNode(value))
  );
}
