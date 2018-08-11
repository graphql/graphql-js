/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ValidationContext } from '../ValidationContext';
import { GraphQLError } from '../../error/GraphQLError';
import suggestionList from '../../jsutils/suggestionList';
import quotedOrList from '../../jsutils/quotedOrList';
import type { ASTVisitor } from '../../language/visitor';

export function unknownTypeMessage(
  typeName: string,
  suggestedTypes: Array<string>,
): string {
  let message = `Unknown type "${typeName}".`;
  if (suggestedTypes.length) {
    message += ` Did you mean ${quotedOrList(suggestedTypes)}?`;
  }
  return message;
}

/**
 * Known type names
 *
 * A GraphQL document is only valid if referenced types (specifically
 * variable definitions and fragment conditions) are defined by the type schema.
 */
export function KnownTypeNames(context: ValidationContext): ASTVisitor {
  return {
    // TODO: when validating IDL, re-enable these. Experimental version does not
    // add unreferenced types, resulting in false-positive errors. Squelched
    // errors for now.
    ObjectTypeDefinition: () => false,
    InterfaceTypeDefinition: () => false,
    UnionTypeDefinition: () => false,
    InputObjectTypeDefinition: () => false,
    NamedType(node) {
      const schema = context.getSchema();
      const typeName = node.name.value;
      const type = schema.getType(typeName);
      if (!type) {
        context.reportError(
          new GraphQLError(
            unknownTypeMessage(
              typeName,
              suggestionList(typeName, Object.keys(schema.getTypeMap())),
            ),
            [node],
          ),
        );
      }
    },
  };
}
