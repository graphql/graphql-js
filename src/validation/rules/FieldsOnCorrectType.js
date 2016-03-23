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
import type { Field } from '../../language/ast';
import type { GraphQLSchema } from '../../type/schema';
import type { GraphQLAbstractType } from '../../type/definition';
import { isAbstractType } from '../../type/definition';


export function undefinedFieldMessage(
  fieldName: string,
  type: string,
  suggestedTypes: Array<string>
): string {
  let message = `Cannot query field "${fieldName}" on type "${type}".`;
  const MAX_LENGTH = 5;
  if (suggestedTypes.length !== 0) {
    let suggestions = suggestedTypes
      .slice(0, MAX_LENGTH)
      .map(t => `"${t}"`)
      .join(', ');
    if (suggestedTypes.length > MAX_LENGTH) {
      suggestions += `, and ${suggestedTypes.length - MAX_LENGTH} other types`;
    }
    message += ` However, this field exists on ${suggestions}.`;
    message += ' Perhaps you meant to use an inline fragment?';
  }
  return message;
}

/**
 * Fields on correct type
 *
 * A GraphQL document is only valid if all fields selected are defined by the
 * parent type, or are an allowed meta field such as __typenamme
 */
export function FieldsOnCorrectType(context: ValidationContext): any {
  return {
    Field(node: Field) {
      const type = context.getParentType();
      if (type) {
        const fieldDef = context.getFieldDef();
        if (!fieldDef) {
          // This isn't valid. Let's find suggestions, if any.
          let suggestedTypes = [];
          if (isAbstractType(type)) {
            const schema = context.getSchema();
            suggestedTypes = getSiblingInterfacesIncludingField(
              schema,
              type,
              node.name.value
            );
            suggestedTypes = suggestedTypes.concat(
              getImplementationsIncludingField(schema, type, node.name.value)
            );
          }
          context.reportError(new GraphQLError(
            undefinedFieldMessage(node.name.value, type.name, suggestedTypes),
            [ node ]
          ));
        }
      }
    }
  };
}

/**
 * Return implementations of `type` that include `fieldName` as a valid field.
 */
function getImplementationsIncludingField(
  schema: GraphQLSchema,
  type: GraphQLAbstractType,
  fieldName: string
): Array<string> {
  return schema.getPossibleTypes(type)
    .filter(t => t.getFields()[fieldName] !== undefined)
    .map(t => t.name)
    .sort();
}

/**
 * Go through all of the implementations of type, and find other interaces
 * that they implement. If those interfaces include `field` as a valid field,
 * return them, sorted by how often the implementations include the other
 * interface.
 */
function getSiblingInterfacesIncludingField(
  schema: GraphQLSchema,
  type: GraphQLAbstractType,
  fieldName: string
): Array<string> {
  const suggestedInterfaces = schema.getPossibleTypes(type).reduce((acc, t) => {
    t.getInterfaces().forEach(i => {
      if (i.getFields()[fieldName] === undefined) {
        return;
      }
      if (acc[i.name] === undefined) {
        acc[i.name] = 0;
      }
      acc[i.name] += 1;
    });
    return acc;
  }, {});
  return Object.keys(suggestedInterfaces)
    .sort((a,b) => suggestedInterfaces[b] - suggestedInterfaces[a]);
}

