/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { type ObjMap } from '../jsutils/ObjMap';
import { uniqueBy } from '../jsutils/uniqueBy';
import { visit } from '../language/visitor';
import {
  type DocumentNode,
  type FragmentDefinitionNode,
} from '../language/ast';

/**
 * Given a document AST, inline all named fragment definitions
 */
export function inlineNamedFragments(documentAST: DocumentNode): DocumentNode {
  const fragmentDefinitions: ObjMap<FragmentDefinitionNode> = Object.create(
    null,
  );

  for (const definition of documentAST.definitions) {
    if (definition.kind === 'FragmentDefinition') {
      fragmentDefinitions[definition.name.value] = definition;
    }
  }

  return visit(documentAST, {
    FragmentSpread(node) {
      return {
        ...fragmentDefinitions[node.name.value],
        kind: 'InlineFragment',
      };
    },
    SelectionSet(node) {
      return {
        ...node,
        selections: uniqueBy(
          node.selections,
          selection => selection.name.value,
        ),
      };
    },
    FragmentDefinition() {
      return null;
    },
  });
}
