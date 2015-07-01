/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { GraphQLError } from '../../error';
import type { ValidationContext } from '../validator';
import {
  GraphQLInterfaceType
} from '../definition';

export default function InterfacePossibleTypesMustImplementTheInterface(
  context: ValidationContext
): ?Array<GraphQLError> {
  var schema = context.getSchema();
  var typeMap = schema.getTypeMap();
  var errors = [];

  Object.keys(typeMap).forEach((typeName) => {
    var type = typeMap[typeName];
    if (!(type instanceof GraphQLInterfaceType)) {
      return;
    }
    var possibleTypes = type.getPossibleTypes();
    possibleTypes.forEach((possibleType) => {
      if (possibleType.getInterfaces().indexOf(type) === -1) {
        errors.push(new GraphQLError(
          `${possibleType} is a possible type of interface ${type} but does ` +
          'not implement it!'
        ));
      }
    });
  });

  return errors.length > 0 ? errors : null;
}
