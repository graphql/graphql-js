/** @category Validation Rules */

import { groupBy } from '../../jsutils/groupBy.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  FieldDefinitionNode,
  InputValueDefinitionNode,
  NameNode,
} from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type { SDLValidationContext } from '../ValidationContext.ts';

/**
 * Unique argument definition names
 *
 * A GraphQL Object or Interface type is only valid if all its fields have uniquely named arguments.
 * A GraphQL Directive is only valid if all its arguments are uniquely named.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql';
 * import { UniqueArgumentDefinitionNamesRule } from 'graphql/validation';
 *
 * const invalidSDL = `
 *   type Query { field(arg: String, arg: Int): String }
 * `;
 *
 * UniqueArgumentDefinitionNamesRule.name; // => 'UniqueArgumentDefinitionNamesRule'
 * buildSchema(invalidSDL); // throws an error
 *
 * const validSDL = `
 *   type Query { field(arg: String): String }
 * `;
 *
 * buildSchema(validSDL); // does not throw
 * ```
 */
export function UniqueArgumentDefinitionNamesRule(
  context: SDLValidationContext,
): ASTVisitor {
  return {
    DirectiveDefinition(directiveNode) {
      const argumentNodes = directiveNode.arguments ?? [];

      return checkArgUniqueness(`@${directiveNode.name.value}`, argumentNodes);
    },
    InterfaceTypeDefinition: checkArgUniquenessPerField,
    InterfaceTypeExtension: checkArgUniquenessPerField,
    ObjectTypeDefinition: checkArgUniquenessPerField,
    ObjectTypeExtension: checkArgUniquenessPerField,
  };

  function checkArgUniquenessPerField(typeNode: {
    readonly name: NameNode;
    readonly fields?: ReadonlyArray<FieldDefinitionNode> | undefined;
  }) {
    const typeName = typeNode.name.value;

    const fieldNodes = typeNode.fields ?? [];

    for (const fieldDef of fieldNodes) {
      const fieldName = fieldDef.name.value;

      const argumentNodes = fieldDef.arguments ?? [];

      checkArgUniqueness(`${typeName}.${fieldName}`, argumentNodes);
    }

    return false;
  }

  function checkArgUniqueness(
    parentName: string,
    argumentNodes: ReadonlyArray<InputValueDefinitionNode>,
  ) {
    const seenArgs = groupBy(argumentNodes, (arg) => arg.name.value);

    for (const [argName, argNodes] of seenArgs) {
      if (argNodes.length > 1) {
        context.reportError(
          new GraphQLError(
            `Argument "${parentName}(${argName}:)" can only be defined once.`,
            { nodes: argNodes.map((node) => node.name) },
          ),
        );
      }
    }

    return false;
  }
}
