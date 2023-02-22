import { invariant } from '../../jsutils/invariant.js';
import type { ObjMap } from '../../jsutils/ObjMap.js';

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
  const knownNameStack: Array<ObjMap<NameNode>> = [];
  let knownNames: ObjMap<NameNode> = Object.create(null);

  return {
    ObjectValue: {
      enter() {
        knownNameStack.push(knownNames);
        knownNames = Object.create(null);
      },
      leave() {
        const prevKnownNames = knownNameStack.pop();
        invariant(prevKnownNames != null);
        knownNames = prevKnownNames;
      },
    },
    ObjectField(node) {
      const fieldName = node.name.value;
      if (knownNames[fieldName]) {
        context.reportError(
          new GraphQLError(
            `There can be only one input field named "${fieldName}".`,
            { nodes: [knownNames[fieldName], node.name] },
          ),
        );
      } else {
        knownNames[fieldName] = node.name;
      }
    },
  };
}
