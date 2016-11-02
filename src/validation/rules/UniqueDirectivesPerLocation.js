/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';


export function duplicateDirectiveMessage(directiveName: string): string {
  return `The directive "${directiveName}" can only be used once at ` +
    'this location.';
}

/**
 * Unique directive names per location
 *
 * A GraphQL document is only valid if all directives at a given location
 * are uniquely named.
 */
export function UniqueDirectivesPerLocation(context: ValidationContext): any {
  return {
    // Many different AST nodes may contain directives. Rather than listing
    // them all, just listen for entering any node, and check to see if it
    // defines any directives.
    enter(node) {
      if (node.directives) {
        const knownDirectives = Object.create(null);
        node.directives.forEach(directive => {
          const directiveName = directive.name.value;
          if (knownDirectives[directiveName]) {
            context.reportError(new GraphQLError(
              duplicateDirectiveMessage(directiveName),
              [ knownDirectives[directiveName], directive ]
            ));
          } else {
            knownDirectives[directiveName] = directive;
          }
        });
      }
    }
  };
}
