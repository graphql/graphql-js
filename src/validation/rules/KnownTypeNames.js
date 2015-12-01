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


export function unknownTypeMessage(type: any): string {
  return `Unknown type "${type}".`;
}

/**
 * Known type names
 *
 * A GraphQL document is only valid if referenced types (specifically
 * variable definitions and fragment conditions) are defined by the type schema.
 *
 * We ignore the types that are referenced by types that are not part of the
 * schema.
 */
export function KnownTypeNames(context: ValidationContext): any {
  return {
    ObjectTypeDefinition(node) {
      var typeName = node.name.value;
      var type = context.getSchema().getType(typeName);
      if (!type) {
        // If a type is not part of the schema, there's no reason to visit the
        // sub-tree. This might happen when extendSchema() doesn't pick up the
        // client-side type because it's never referenced by any of the queries.
        return false;
      }
    },
    NamedType(node) {
      var typeName = node.name.value;
      var type = context.getSchema().getType(typeName);
      if (!type) {
        context.reportError(
          new GraphQLError(unknownTypeMessage(typeName), [ node ])
        );
      }
    }
  };
}
