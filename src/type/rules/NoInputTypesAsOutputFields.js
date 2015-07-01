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
  GraphQLInterfaceType,
  GraphQLObjectType,
  isOutputType
} from '../definition';
import type { GraphQLType } from '../definition';

export default function NoInputTypesAsOutputFields(
  context: ValidationContext
): ?Array<GraphQLError> {
  var schema = context.getSchema();
  var typeMap = schema.getTypeMap();
  var errors = [];

  var queryType = schema.getQueryType();
  if (queryType) {
    var queryError = operationMayNotBeInputType(queryType, 'query');
    if (queryError !== null) {
      errors.push(queryError);
    }
  }

  var mutationType = schema.getMutationType();
  if (mutationType) {
    var mutationError = operationMayNotBeInputType(mutationType, 'mutation');
    if (mutationError !== null) {
      errors.push(mutationError);
    }
  }

  Object.keys(typeMap)
    .map((typeName) => [typeName, typeMap[typeName]])
    .forEach(([typeName, type]) => {
      if (!(type instanceof GraphQLObjectType) &&
          !(type instanceof GraphQLInterfaceType)) {
        return;
      }
      var fields = type.getFields();
      Object.keys(fields).forEach(fieldName => {
        var field = fields[fieldName];
        if (field.type instanceof GraphQLInputObjectType) {
          errors.push(
            new GraphQLError(
              `Field ${typeName}.${field.name} is of type ` +
              `${field.type.name}, which is an input type, but field types ` +
              `must be output types!`
            )
          );
        }
      });
    });

  return errors.length > 0 ? errors : null;
}

function operationMayNotBeInputType(
  type: GraphQLType,
  operation: 'query' | 'mutation'
) {
  if (!isOutputType(type)) {
    return new GraphQLError(
      `Schema ${operation} type ${type} must be an object type!`
    );
  }
  return null;
}
