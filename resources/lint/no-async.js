/**
 * Copyright (c) 2017, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

module.exports = function(context) {
  if (context.getFilename().match(/\b__tests__\b/)) {
    return {};
  } else {
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
  }
};
