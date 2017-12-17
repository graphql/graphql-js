/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import { GraphQLError } from '../error/GraphQLError';
import { visit, visitWithTypeInfo } from '../language/visitor';

import { getNamedType } from '../type/definition';
import { GraphQLSchema } from '../type/schema';
import { TypeInfo } from './TypeInfo';

/**
 * A validation rule which reports deprecated usages.
 *
 * Returns a list of GraphQLError instances describing each deprecated use.
 */
export function findDeprecatedUsages(schema, ast) {
  var errors = [];
  var typeInfo = new TypeInfo(schema);

  visit(ast, visitWithTypeInfo(typeInfo, {
    Field: function Field(node) {
      var fieldDef = typeInfo.getFieldDef();
      if (fieldDef && fieldDef.isDeprecated) {
        var parentType = typeInfo.getParentType();
        if (parentType) {
          var reason = fieldDef.deprecationReason;
          errors.push(new GraphQLError('The field ' + parentType.name + '.' + fieldDef.name + ' is deprecated.' + (reason ? ' ' + reason : ''), [node]));
        }
      }
    },
    EnumValue: function EnumValue(node) {
      var enumVal = typeInfo.getEnumValue();
      if (enumVal && enumVal.isDeprecated) {
        var type = getNamedType(typeInfo.getInputType());
        if (type) {
          var reason = enumVal.deprecationReason;
          errors.push(new GraphQLError('The enum value ' + type.name + '.' + enumVal.name + ' is deprecated.' + (reason ? ' ' + reason : ''), [node]));
        }
      }
    }
  }));

  return errors;
}