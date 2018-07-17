/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type ValidationContext from '../ValidationContext';
import { GraphQLError } from '../../error';
import inspect from '../../jsutils/inspect';
import keyMap from '../../jsutils/keyMap';
import { isNonNullType } from '../../type/definition';
import type { ASTVisitor } from '../../language/visitor';

export function missingFieldArgMessage(
  fieldName: string,
  argName: string,
  type: string,
): string {
  return (
    `Field "${fieldName}" argument "${argName}" of type ` +
    `"${type}" is required but not provided.`
  );
}

export function missingDirectiveArgMessage(
  directiveName: string,
  argName: string,
  type: string,
): string {
  return (
    `Directive "@${directiveName}" argument "${argName}" of type ` +
    `"${type}" is required but not provided.`
  );
}

/**
 * Provided required arguments
 *
 * A field or directive is only valid if all required (non-null without a
 * default value) field arguments have been provided.
 */
export function ProvidedRequiredArguments(
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
        for (const argDef of fieldDef.args) {
          const argNode = argNodeMap[argDef.name];
          if (
            !argNode &&
            isNonNullType(argDef.type) &&
            argDef.defaultValue === undefined
          ) {
            context.reportError(
              new GraphQLError(
                missingFieldArgMessage(
                  node.name.value,
                  argDef.name,
                  inspect(argDef.type),
                ),
                [node],
              ),
            );
          }
        }
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
        for (const argDef of directiveDef.args) {
          const argNode = argNodeMap[argDef.name];
          if (
            !argNode &&
            isNonNullType(argDef.type) &&
            argDef.defaultValue === undefined
          ) {
            context.reportError(
              new GraphQLError(
                missingDirectiveArgMessage(
                  node.name.value,
                  argDef.name,
                  inspect(argDef.type),
                ),
                [node],
              ),
            );
          }
        }
      },
    },
  };
}
