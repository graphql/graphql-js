import { groupBy } from '../../jsutils/groupBy.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import type {
  FieldDefinitionNode,
  InputValueDefinitionNode,
  NameNode,
} from '../../language/ast.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { SDLValidationContext } from '../ValidationContext.js';

/**
 * Unique argument definition names
 *
 * A GraphQL Object or Interface type is only valid if all its fields have uniquely named arguments.
 * A GraphQL Directive is only valid if all its arguments are uniquely named.
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
