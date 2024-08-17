import { invariant } from '../../jsutils/invariant';
import type { ObjMap } from '../../jsutils/ObjMap';

import { GraphQLError } from '../../error/GraphQLError';

import type { NameNode, ObjectFieldNode } from '../../language/ast';
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

  let knownNamesInList: Array<ReadonlyArray<ObjectFieldNode>> =
    Object.create([]);

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
    ListValue: {
      enter(node) {
        node.values.forEach((valueNode) => {
          if(valueNode.kind === 'ObjectValue') {
            knownNamesInList.push(valueNode.fields);
          }
        });
      },
      leave() {
        knownNamesInList = Object.create([]);
      },
    },
    ObjectField(node) {
      const fieldName = node.name.value;

      let isError = false;
      if (knownNames[fieldName]) {
        if (!knownNamesInList.length) {
          isError = true;
        }
        else {
          for (const fields of knownNamesInList) {
            const nestedFields = fields.filter(
              (field) => field.name.value === fieldName,
            );

            // expecting only one field with the same name, if there is more than one, report error. if there is no field with the same name, mean it is in the nested object instead list value, report error.
            if (!isError && nestedFields.length !== 1) {            
              isError = true;
            }
          }
        }
      }



      if(isError) {
        context.reportError(
          new GraphQLError(
            `There can be only one input field named "${fieldName}".`,
            { nodes: [knownNames[fieldName], node.name] },
          ),
        );
      }
      else {
        knownNames[fieldName] = node.name;
      }
    },

  };
}
