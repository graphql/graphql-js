/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

module.exports = function(context) {
  return {
    FunctionDeclaration: function(node) {
      if (node.async) {
        context.report(
          node,
          'async functions are not allowed outside of the test suite ' +
          'because older versions of NodeJS do not support them ' +
          'without additional runtime dependencies. Instead, use explicit ' +
          'Promises.'
        );
      }
    },
  };
};
