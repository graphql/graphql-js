/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type {
  ValidationContext,
  SDLValidationContext,
} from '../ValidationContext';
import { GraphQLError } from '../../error/GraphQLError';
import suggestionList from '../../jsutils/suggestionList';
import quotedOrList from '../../jsutils/quotedOrList';
import type { ASTNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';
import {
  isTypeDefinitionNode,
  isTypeSystemDefinitionNode,
  isTypeSystemExtensionNode,
} from '../../language/predicates';
import { specifiedScalarTypes } from '../../type/scalars';

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
export function KnownTypeNames(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  const existingTypesMap = schema ? schema.getTypeMap() : Object.create(null);

  const definedTypes = Object.create(null);
  for (const def of context.getDocument().definitions) {
    if (isTypeDefinitionNode(def)) {
      definedTypes[def.name.value] = true;
    }
  }

  const typeNames = Object.keys(existingTypesMap).concat(
    Object.keys(definedTypes),
  );

  return {
    NamedType(node, _1, parent, _2, ancestors) {
      const typeName = node.name.value;
      if (!existingTypesMap[typeName] && !definedTypes[typeName]) {
        const definitionNode = ancestors[2] || parent;
        const isSDL = isSDLNode(definitionNode);
        if (isSDL && isSpecifiedScalarName(typeName)) {
          return;
        }

        const suggestedTypes = suggestionList(
          typeName,
          isSDL ? specifiedScalarsNames.concat(typeNames) : typeNames,
        );
        context.reportError(
          new GraphQLError(unknownTypeMessage(typeName, suggestedTypes), node),
        );
      }
    },
  };
}

const specifiedScalarsNames = specifiedScalarTypes.map(type => type.name);
function isSpecifiedScalarName(typeName) {
  return specifiedScalarsNames.indexOf(typeName) !== -1;
}

function isSDLNode(value: ASTNode | $ReadOnlyArray<ASTNode> | void): boolean {
  return Boolean(
    value &&
      !Array.isArray(value) &&
      (isTypeSystemDefinitionNode(value) || isTypeSystemExtensionNode(value)),
  );
}
