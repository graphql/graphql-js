import { invariant } from '../../jsutils/invariant.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import type { NameNode } from '../../language/ast.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { ASTValidationContext } from '../ValidationContext.js';

/**
 * Unique input field names
 *
 * A GraphQL input object value is only valid if all supplied fields are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Object-Field-Uniqueness
 */
export function UniqueInputFieldNamesRule(
  context: ASTValidationContext,
): ASTVisitor {
  const knownNameStack: Array<Map<string, NameNode>> = [];
  let knownNames = new Map<string, NameNode>();

  return {
    ObjectValue: {
      enter() {
        knownNameStack.push(knownNames);
        knownNames = new Map();
      },
      leave() {
        const prevKnownNames = knownNameStack.pop();
        invariant(prevKnownNames != null);
        knownNames = prevKnownNames;
      },
    },
    ObjectField(node) {
      const fieldName = node.name.value;
      const knownName = knownNames.get(fieldName);
      if (knownName != null) {
        context.reportError(
          new GraphQLError(
            `There can be only one input field named "${fieldName}".`,
            { nodes: [knownName, node.name] },
          ),
        );
      } else {
        knownNames.set(fieldName, node.name);
      }
    },
  };
}
