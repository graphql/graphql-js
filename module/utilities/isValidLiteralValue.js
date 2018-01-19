/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import { TypeInfo } from './TypeInfo';

import { Kind } from '../language/kinds';
import { visit, visitWithTypeInfo } from '../language/visitor';

import { GraphQLSchema } from '../type/schema';
import { ValuesOfCorrectType } from '../validation/rules/ValuesOfCorrectType';
import { ValidationContext } from '../validation/validate';

/**
 * Utility which determines if a value literal node is valid for an input type.
 *
 * Deprecated. Rely on validation for documents containing literal values.
 */
export function isValidLiteralValue(type, valueNode) {
  var emptySchema = new GraphQLSchema({});
  var emptyDoc = { kind: Kind.DOCUMENT, definitions: [] };
  var typeInfo = new TypeInfo(emptySchema, undefined, type);
  var context = new ValidationContext(emptySchema, emptyDoc, typeInfo);
  var visitor = ValuesOfCorrectType(context);
  visit(valueNode, visitWithTypeInfo(typeInfo, visitor));
  return context.getErrors();
}