import { invariant } from '../../jsutils/invariant';
import type { ObjMap } from '../../jsutils/ObjMap';

import { GraphQLError } from '../../error/GraphQLError';

import type { NameNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import type { ASTValidationContext } from '../ValidationContext';

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
        invariant(prevKnownNames);
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
