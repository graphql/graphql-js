/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';
import find from '../../jsutils/find';
import * as Kind from '../../language/kinds';
import { DirectiveLocation } from '../../language/directiveLocation';
import type { ASTVisitor } from '../../language/visitor';

export function unknownDirectiveMessage(directiveName: string): string {
  return `Unknown directive "${directiveName}".`;
}

export function misplacedDirectiveMessage(
  directiveName: string,
  location: string,
): string {
  return `Directive "${directiveName}" may not be used on ${location}.`;
}

/**
 * Known directives
 *
 * A GraphQL document is only valid if all `@directives` are known by the
 * schema and legally positioned.
 */
export function KnownDirectives(context: ValidationContext): ASTVisitor {
  return {
    Directive(node, key, parent, path, ancestors) {
      const directiveDef = find(
        context.getSchema().getDirectives(),
        def => def.name === node.name.value,
      );
      if (!directiveDef) {
        context.reportError(
          new GraphQLError(unknownDirectiveMessage(node.name.value), [node]),
        );
        return;
      }
      const candidateLocation = getDirectiveLocationForASTPath(ancestors);
      if (
        candidateLocation &&
        directiveDef.locations.indexOf(candidateLocation) === -1
      ) {
        context.reportError(
          new GraphQLError(
            misplacedDirectiveMessage(node.name.value, candidateLocation),
            [node],
          ),
        );
      }
    },
  };
}

function getDirectiveLocationForASTPath(ancestors) {
  const appliedTo = ancestors[ancestors.length - 1];
  if (!Array.isArray(appliedTo)) {
    switch (appliedTo.kind) {
      case Kind.OPERATION_DEFINITION:
        switch (appliedTo.operation) {
          case 'query':
            return DirectiveLocation.QUERY;
          case 'mutation':
            return DirectiveLocation.MUTATION;
          case 'subscription':
            return DirectiveLocation.SUBSCRIPTION;
        }
        break;
      case Kind.FIELD:
        return DirectiveLocation.FIELD;
      case Kind.FRAGMENT_SPREAD:
        return DirectiveLocation.FRAGMENT_SPREAD;
      case Kind.INLINE_FRAGMENT:
        return DirectiveLocation.INLINE_FRAGMENT;
      case Kind.FRAGMENT_DEFINITION:
        return DirectiveLocation.FRAGMENT_DEFINITION;
      case Kind.SCHEMA_DEFINITION:
        return DirectiveLocation.SCHEMA;
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION:
        return DirectiveLocation.SCALAR;
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION:
        return DirectiveLocation.OBJECT;
      case Kind.FIELD_DEFINITION:
        return DirectiveLocation.FIELD_DEFINITION;
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_EXTENSION:
        return DirectiveLocation.INTERFACE;
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION:
        return DirectiveLocation.UNION;
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION:
        return DirectiveLocation.ENUM;
      case Kind.ENUM_VALUE_DEFINITION:
        return DirectiveLocation.ENUM_VALUE;
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
        return DirectiveLocation.INPUT_OBJECT;
      case Kind.INPUT_VALUE_DEFINITION:
        const parentNode = ancestors[ancestors.length - 3];
        return parentNode.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
          ? DirectiveLocation.INPUT_FIELD_DEFINITION
          : DirectiveLocation.ARGUMENT_DEFINITION;
    }
  }
}
