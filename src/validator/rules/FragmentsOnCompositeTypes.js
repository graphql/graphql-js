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
import {
  isCompositeType
} from '../../type/definition';

import { fragmentOnNonCompositeErrorMessage } from '../errors';

/**
 * Fragments on composite type
 *
 * Fragments use a type condition to determine if they apply, since fragments
 * can only be spread into a composite type (object, interface, or union), the
 * type condition must also be a composite type.
 */
export default function FragmentsOnCompositeType(
  context: ValidationContext
): any {
  return {
    InlineFragment(node) {
      var typeName = node.typeCondition.value;
      var type = context.getSchema().getType(typeName);
      if (!isCompositeType(type)) {
        return new GraphQLError(
          `Fragment cannot condition on non composite type "${typeName}".`,
          [node.typeCondition]
        );
      }
    },
    FragmentDefinition(node) {
      var typeName = node.typeCondition.value;
      var type = context.getSchema().getType(typeName);
      if (!isCompositeType(type)) {
        return new GraphQLError(
          fragmentOnNonCompositeErrorMessage(node.name.value, typeName),
          [node.typeCondition]
        );
      }
    }
  };
}
