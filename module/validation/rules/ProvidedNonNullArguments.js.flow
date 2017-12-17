/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';
import keyMap from '../../jsutils/keyMap';
import { isNonNullType } from '../../type/definition';
import type { GraphQLType } from '../../type/definition';
import type { ASTVisitor } from '../../language/visitor';

export function missingFieldArgMessage(
  fieldName: string,
  argName: string,
  type: GraphQLType,
): string {
  return (
    `Field "${fieldName}" argument "${argName}" of type ` +
    `"${String(type)}" is required but not provided.`
  );
}

export function missingDirectiveArgMessage(
  directiveName: string,
  argName: string,
  type: GraphQLType,
): string {
  return (
    `Directive "@${directiveName}" argument "${argName}" of type ` +
    `"${String(type)}" is required but not provided.`
  );
}

/**
 * Provided required arguments
 *
 * A field or directive is only valid if all required (non-null) field arguments
 * have been provided.
 */
export function ProvidedNonNullArguments(
  context: ValidationContext,
): ASTVisitor {
  return {
    Field: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(node) {
        const fieldDef = context.getFieldDef();
        if (!fieldDef) {
          return false;
        }
        const argNodes = node.arguments || [];

        const argNodeMap = keyMap(argNodes, arg => arg.name.value);
        fieldDef.args.forEach(argDef => {
          const argNode = argNodeMap[argDef.name];
          if (!argNode && isNonNullType(argDef.type)) {
            context.reportError(
              new GraphQLError(
                missingFieldArgMessage(
                  node.name.value,
                  argDef.name,
                  argDef.type,
                ),
                [node],
              ),
            );
          }
        });
      },
    },

    Directive: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(node) {
        const directiveDef = context.getDirective();
        if (!directiveDef) {
          return false;
        }
        const argNodes = node.arguments || [];

        const argNodeMap = keyMap(argNodes, arg => arg.name.value);
        directiveDef.args.forEach(argDef => {
          const argNode = argNodeMap[argDef.name];
          if (!argNode && isNonNullType(argDef.type)) {
            context.reportError(
              new GraphQLError(
                missingDirectiveArgMessage(
                  node.name.value,
                  argDef.name,
                  argDef.type,
                ),
                [node],
              ),
            );
          }
        });
      },
    },
  };
}
