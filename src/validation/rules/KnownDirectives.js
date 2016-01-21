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
import find from '../../jsutils/find';
import {
  OPERATION_DEFINITION,
  FIELD,
  FRAGMENT_SPREAD,
  INLINE_FRAGMENT,
  FRAGMENT_DEFINITION
} from '../../language/kinds';


export function unknownDirectiveMessage(directiveName: string): string {
  return `Unknown directive "${directiveName}".`;
}

export function misplacedDirectiveMessage(
  directiveName: string,
  placement: string
): string {
  return `Directive "${directiveName}" may not be used on "${placement}".`;
}

/**
 * Known directives
 *
 * A GraphQL document is only valid if all `@directives` are known by the
 * schema and legally positioned.
 */
export function KnownDirectives(context: ValidationContext): any {
  return {
    Directive(node, key, parent, path, ancestors) {
      const directiveDef = find(
        context.getSchema().getDirectives(),
        def => def.name === node.name.value
      );
      if (!directiveDef) {
        context.reportError(new GraphQLError(
          unknownDirectiveMessage(node.name.value),
          [ node ]
        ));
        return;
      }
      const appliedTo = ancestors[ancestors.length - 1];
      switch (appliedTo.kind) {
        case OPERATION_DEFINITION:
          if (!directiveDef.onOperation) {
            context.reportError(new GraphQLError(
              misplacedDirectiveMessage(node.name.value, 'operation'),
              [ node ]
            ));
          }
          break;
        case FIELD:
          if (!directiveDef.onField) {
            context.reportError(new GraphQLError(
              misplacedDirectiveMessage(node.name.value, 'field'),
              [ node ]
            ));
          }
          break;
        case FRAGMENT_SPREAD:
        case INLINE_FRAGMENT:
        case FRAGMENT_DEFINITION:
          if (!directiveDef.onFragment) {
            context.reportError(new GraphQLError(
              misplacedDirectiveMessage(node.name.value, 'fragment'),
              [ node ]
            ));
          }
          break;
      }
    }
  };
}
