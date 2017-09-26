/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var chai = require('chai');
chai.use(require('chai-json-equal'));
chai.use(require('chai-spies-next'));
chai.use(require('chai-subset'));

process.on('unhandledRejection', function (error) {
  console.error('Unhandled Promise Rejection:');
  console.error(error && error.stack || error);
});
