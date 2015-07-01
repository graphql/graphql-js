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
  GraphQLObjectType
} from '../definition';

export default function TypesInterfacesMustShowThemAsPossible(
  context: ValidationContext
): ?Array<GraphQLError> {
  var schema = context.getSchema();
  var typeMap = schema.getTypeMap();
  var errors = [];

  Object.keys(typeMap).forEach((typeName) => {
    var type = typeMap[typeName];
    if (!(type instanceof GraphQLObjectType)) {
      return;
    }
    var interfaces = type.getInterfaces();
    interfaces.forEach((interfaceType) => {
      if (!interfaceType.isPossibleType(type)) {
        errors.push(new GraphQLError(
          `${typeName} implements interface ${interfaceType.name}, but ` +
          `${interfaceType.name} does not list it as possible!`
        ));
      }
    });
  });

  return errors.length > 0 ? errors : null;
}
