/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Ensure a vanilla package.json before deploying so other tools do not
 * interpret the built output as requiring any further transformation.
 */

const fs = require('fs');

const package = require('../package.json');
delete package.scripts;
delete package.options;
delete package.devDependencies;
fs.writeFileSync('./dist/package.json', JSON.stringify(package, null, 2));
