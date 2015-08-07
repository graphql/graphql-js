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
import { unknownDirectiveMessage, misplacedDirectiveMessage } from '../errors';
import find from '../../jsutils/find';
import {
  OPERATION_DEFINITION,
  FIELD,
  FRAGMENT_SPREAD,
  INLINE_FRAGMENT,
  FRAGMENT_DEFINITION
} from '../../language/kinds';


/**
 * Known directives
 *
 * A GraphQL document is only valid if all `@directives` are known by the
 * schema and legally positioned.
 */
export default function KnownDirectives(context: ValidationContext): any {
  return {
    Directive(node, key, parent, path, ancestors) {
      var directiveDef = find(
        context.getSchema().getDirectives(),
        def => def.name === node.name.value
      );
      if (!directiveDef) {
        return new GraphQLError(
          unknownDirectiveMessage(node.name.value),
          [node]
        );
      }
      var appliedTo = ancestors[ancestors.length - 1];
      if (appliedTo.kind === OPERATION_DEFINITION &&
          !directiveDef.onOperation) {
        return new GraphQLError(
          misplacedDirectiveMessage(node.name.value, 'operation'),
          [node]
        );
      }
      if (appliedTo.kind === FIELD && !directiveDef.onField) {
        return new GraphQLError(
          misplacedDirectiveMessage(node.name.value, 'field'),
          [node]
        );
      }
      if ((appliedTo.kind === FRAGMENT_SPREAD ||
           appliedTo.kind === INLINE_FRAGMENT ||
           appliedTo.kind === FRAGMENT_DEFINITION) &&
          !directiveDef.onFragment) {
        return new GraphQLError(
          misplacedDirectiveMessage(node.name.value, 'fragment'),
          [node]
        );
      }
    }
  };
}
