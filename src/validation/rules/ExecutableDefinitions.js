/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ASTValidationContext } from '../ValidationContext';
import { GraphQLError } from '../../error/GraphQLError';
import { Kind } from '../../language/kinds';
import {
  isDefinitionNode,
  isExecutableDefinitionNode,
} from '../../language/predicates';
import type { ASTNode } from '../../language/ast';
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
export function ExecutableDefinitions(
  context: ASTValidationContext,
): ASTVisitor {
  return {
    enter(node) {
      if (isDefinitionNode(node)) {
        if (!isExecutableDefinitionNode(node)) {
          context.reportError(
            new GraphQLError(
              nonExecutableDefinitionMessage(
                isSchemaNode(node) ? 'schema' : node.name.value,
              ),
              node,
            ),
          );
        }
        return false;
      }
    },
  };
}

function isSchemaNode(node: ASTNode): boolean %checks {
  return (
    node.kind === Kind.SCHEMA_DEFINITION || node.kind === Kind.SCHEMA_EXTENSION
  );
}
