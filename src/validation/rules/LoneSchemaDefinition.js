/**
 * Copyright (c) 2018-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { SDLValidationContext } from '../ValidationContext';
import { GraphQLError } from '../../error';
import type { ASTVisitor } from '../../language/visitor';

export function schemaDefinitionNotAloneMessage(): string {
  return 'Must provide only one schema definition.';
}

export function canNotDefineSchemaWithinExtension(): string {
  return 'Cannot define a new schema within a schema extension.';
}

/**
 * Lone Schema definition
 *
 * A GraphQL document is only valid if it contains only one schema definition.
 */
export function LoneSchemaDefinition(
  context: SDLValidationContext,
): ASTVisitor {
  const oldSchema = context.getSchema();
  const alreadyDefined =
    oldSchema &&
    (oldSchema.astNode ||
      oldSchema.getQueryType() ||
      oldSchema.getMutationType() ||
      oldSchema.getSubscriptionType());

  const schemaNodes = [];
  return {
    SchemaDefinition(node) {
      if (alreadyDefined) {
        context.reportError(
          new GraphQLError(canNotDefineSchemaWithinExtension(), [node]),
        );
        return;
      }
      schemaNodes.push(node);
    },
    Document: {
      leave() {
        if (schemaNodes.length > 1) {
          context.reportError(
            new GraphQLError(schemaDefinitionNotAloneMessage(), schemaNodes),
          );
        }
      },
    },
  };
}
