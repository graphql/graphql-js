/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';
import { Kind } from '../../language/kinds';
import type { ASTVisitor } from '../../language/visitor';

export function nonExecutableDefinitionMessage(defName: string): string {
  return `The ${defName} definition is not executable.`;
}

/**
 * Executable definitions
 *
 * A GraphQL document is only valid for execution if all definitions are either
 * operation or fragment definitions.
 */
export function ExecutableDefinitions(context: ValidationContext): ASTVisitor {
  return {
    Document(node) {
      node.definitions.forEach(definition => {
        if (
          definition.kind !== Kind.OPERATION_DEFINITION &&
          definition.kind !== Kind.FRAGMENT_DEFINITION
        ) {
          context.reportError(
            new GraphQLError(
              nonExecutableDefinitionMessage(
                definition.kind === Kind.SCHEMA_DEFINITION
                  ? 'schema'
                  : definition.name.value,
              ),
              [definition],
            ),
          );
        }
      });
      return false;
    },
  };
}
