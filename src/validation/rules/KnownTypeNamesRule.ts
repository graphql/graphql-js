/** @category Validation Rules */

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
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { KnownTypeNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   fragment Bad on Missing { name }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [KnownTypeNamesRule]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   fragment Good on Query { name }
 * `);
 * const validErrors = validate(schema, validDocument, [KnownTypeNamesRule]);
 *
 * validErrors; // => []
 * ```
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
