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
  FIELD,
  FRAGMENT_DEFINITION,
  FRAGMENT_SPREAD,
  INLINE_FRAGMENT,
  OPERATION_DEFINITION,
  SCHEMA_DEFINITION,
  SCALAR_TYPE_DEFINITION,
  OBJECT_TYPE_DEFINITION,
  FIELD_DEFINITION,
  INPUT_VALUE_DEFINITION,
  INTERFACE_TYPE_DEFINITION,
  UNION_TYPE_DEFINITION,
  ENUM_TYPE_DEFINITION,
  ENUM_VALUE_DEFINITION,
  INPUT_OBJECT_TYPE_DEFINITION,
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
      const candidateLocation = getDirectiveLocationForASTPath(ancestors);
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

function getDirectiveLocationForASTPath(ancestors) {
  const appliedTo = ancestors[ancestors.length - 1];
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
    case SCHEMA_DEFINITION: return DirectiveLocation.SCHEMA;
    case SCALAR_TYPE_DEFINITION: return DirectiveLocation.SCALAR;
    case OBJECT_TYPE_DEFINITION: return DirectiveLocation.OBJECT;
    case FIELD_DEFINITION: return DirectiveLocation.FIELD_DEFINITION;
    case INTERFACE_TYPE_DEFINITION: return DirectiveLocation.INTERFACE;
    case UNION_TYPE_DEFINITION: return DirectiveLocation.UNION;
    case ENUM_TYPE_DEFINITION: return DirectiveLocation.ENUM;
    case ENUM_VALUE_DEFINITION: return DirectiveLocation.ENUM_VALUE;
    case INPUT_OBJECT_TYPE_DEFINITION: return DirectiveLocation.INPUT_OBJECT;
    case INPUT_VALUE_DEFINITION:
      const parentNode = ancestors[ancestors.length - 3];
      return parentNode.kind === INPUT_OBJECT_TYPE_DEFINITION ?
        DirectiveLocation.INPUT_FIELD_DEFINITION :
        DirectiveLocation.ARGUMENT_DEFINITION;
  }
}
