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
  GraphQLInputObjectType,
  isInputType
} from '../definition';

export default function NoOutputTypesAsInputArgs(
  context: ValidationContext
): ?Array<GraphQLError> {
  var schema = context.getSchema();
  var typeMap = schema.getTypeMap();
  var errors = [];

  Object.keys(typeMap).forEach((typeName) => {
    var type = typeMap[typeName];
    if (!(type instanceof GraphQLInputObjectType)) {
      return;
    }
    var fields = type.getFields();
    Object.keys(fields).forEach(fieldName => {
      var field = fields[fieldName];
      if (!isInputType(field.type)) {
        errors.push(outputArgError(type, field));
      }
    });
  });

  return errors.length > 0 ? errors : null;
}

function outputArgError(type, field) {
  return new GraphQLError(
    `Input field ${type.name}.${field.name} has type ` +
    `${field.type}, which is not an input type!`
  );
}
