import { didYouMean } from '../../jsutils/didYouMean';
import { suggestionList } from '../../jsutils/suggestionList';
import { naturalCompare } from '../../jsutils/naturalCompare';

import { GraphQLError } from '../../error/GraphQLError';

import type { FieldNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import type { GraphQLSchema } from '../../type/schema';
import type {
  GraphQLOutputType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLField,
} from '../../type/definition';
import {
  isObjectType,
  isInterfaceType,
  isAbstractType,
} from '../../type/definition';

import type { ValidationContext } from '../ValidationContext';
import { modifiedOutputType } from '../..';

/**
 * Fields on correct type
 *
 * A GraphQL document is only valid if all fields selected are defined by the
 * parent type, or are an allowed meta field such as __typename.
 *
 * See https://spec.graphql.org/draft/#sec-Field-Selections
 */
export function RequiredStatusOnFieldMatchesDefinitionRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    Field(node: FieldNode) {
      if (context.getFieldDef()) {
        const fieldDef = context.getFieldDef() as GraphQLField<
          unknown,
          unknown
        >;
        try {
          modifiedOutputType(fieldDef.type, node.required);
        } catch {
          context.reportError(
            new GraphQLError(
              `Syntax Error: Something is wrong with the nullability designator on ${
                node.alias?.value ?? node.name.value
              }. The type for that field in the schema is ${
                fieldDef.type
              } Is the correct list depth being used?`,
              node,
            ),
          );
        }
      }
    },
  };
}
