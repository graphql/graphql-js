/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
import { GraphQLError } from '../../error/GraphQLError';
export function unknownFragmentMessage(fragName) {
  return "Unknown fragment \"".concat(fragName, "\".");
}
/**
 * Known fragment names
 *
 * A GraphQL document is only valid if all `...Fragment` fragment spreads refer
 * to fragments defined in the same document.
 */

export function KnownFragmentNames(context) {
  return {
    FragmentSpread: function FragmentSpread(node) {
      var fragmentName = node.name.value;
      var fragment = context.getFragment(fragmentName);

      if (!fragment) {
        context.reportError(new GraphQLError(unknownFragmentMessage(fragmentName), node.name));
      }
    }
  };
}
