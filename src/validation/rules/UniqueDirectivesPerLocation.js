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
import type { DirectiveNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

export function duplicateDirectiveMessage(directiveName: string): string {
  return (
    `The directive "${directiveName}" can only be used once at ` +
    'this location.'
  );
}

/**
 * Unique directive names per location
 *
 * A GraphQL document is only valid if all directives at a given location
 * are uniquely named.
 */
export function UniqueDirectivesPerLocation(
  context: ValidationContext,
): ASTVisitor {
  return {
    // Many different AST nodes may contain directives. Rather than listing
    // them all, just listen for entering any node, and check to see if it
    // defines any directives.
    enter(node) {
      // Flow can't refine that node.directives will only contain directives,
      // so we cast so the rest of the code is well typed.
      const directives: ?$ReadOnlyArray<DirectiveNode> = (node: any).directives;
      if (directives) {
        const knownDirectives = Object.create(null);
        directives.forEach(directive => {
          const directiveName = directive.name.value;
          if (knownDirectives[directiveName]) {
            context.reportError(
              new GraphQLError(duplicateDirectiveMessage(directiveName), [
                knownDirectives[directiveName],
                directive,
              ]),
            );
          } else {
            knownDirectives[directiveName] = directive;
          }
        });
      }
    },
  };
}
