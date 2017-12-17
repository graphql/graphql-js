function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import invariant from '../jsutils/invariant';

/**
 * A representation of source input to GraphQL.
 * `name` and `locationOffset` are optional. They are useful for clients who
 * store GraphQL documents in source files; for example, if the GraphQL input
 * starts at line 40 in a file named Foo.graphql, it might be useful for name to
 * be "Foo.graphql" and location to be `{ line: 40, column: 0 }`.
 * line and column in locationOffset are 1-indexed
 */
export var Source = function Source(body, name, locationOffset) {
  _classCallCheck(this, Source);

  this.body = body;
  this.name = name || 'GraphQL request';
  this.locationOffset = locationOffset || { line: 1, column: 1 };
  !(this.locationOffset.line > 0) ? invariant(0, 'line in locationOffset is 1-indexed and must be positive') : void 0;
  !(this.locationOffset.column > 0) ? invariant(0, 'column in locationOffset is 1-indexed and must be positive') : void 0;
};