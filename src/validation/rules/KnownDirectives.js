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
import { DirectiveLocation } from '../../type/directives';


export function unknownDirectiveMessage(directiveName: string): string {
  return `Unknown directive "${directiveName}".`;
}

export function misplacedDirectiveMessage(
  directiveName: string,
  location: string
): string {
  return `Directive "${directiveName}" may not be used on ${location}.`;
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
      const candidateLocation = getLocationForAppliedNode(appliedTo);
      if (!candidateLocation) {
        context.reportError(new GraphQLError(
          misplacedDirectiveMessage(node.name.value, node.type),
          [ node ]
        ));
      } else if (directiveDef.locations.indexOf(candidateLocation) === -1) {
        context.reportError(new GraphQLError(
          misplacedDirectiveMessage(node.name.value, candidateLocation),
          [ node ]
        ));
      }
    }
  };
}

function getLocationForAppliedNode(appliedTo) {
  switch (appliedTo.kind) {
    case OPERATION_DEFINITION:
      switch (appliedTo.operation) {
        case 'query': return DirectiveLocation.QUERY;
        case 'mutation': return DirectiveLocation.MUTATION;
        case 'subscription': return DirectiveLocation.SUBSCRIPTION;
      }
      break;
    case FIELD: return DirectiveLocation.FIELD;
    case FRAGMENT_SPREAD: return DirectiveLocation.FRAGMENT_SPREAD;
    case INLINE_FRAGMENT: return DirectiveLocation.INLINE_FRAGMENT;
    case FRAGMENT_DEFINITION: return DirectiveLocation.FRAGMENT_DEFINITION;
  }
}
