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
import type { ASTVisitor } from '../../language/visitor';

export function unknownFragmentMessage(fragName: string): string {
  return `Unknown fragment "${fragName}".`;
}

/**
 * Known fragment names
 *
 * A GraphQL document is only valid if all `...Fragment` fragment spreads refer
 * to fragments defined in the same document.
 */
export function KnownFragmentNames(context: ValidationContext): ASTVisitor {
  return {
    FragmentSpread(node) {
      const fragmentName = node.name.value;
      const fragment = context.getFragment(fragmentName);
      if (!fragment) {
        context.reportError(
          new GraphQLError(unknownFragmentMessage(fragmentName), [node.name]),
        );
      }
    },
  };
}
