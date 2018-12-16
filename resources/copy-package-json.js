/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

'use strict';

/**
 * Ensure a vanilla package.json before deploying so other tools do not
 * interpret the built output as requiring any further transformation.
 */

const fs = require('fs');
const assert = require('assert');

const packageJSON = require('../package.json');
delete packageJSON.scripts;
delete packageJSON.devDependencies;

const { version } = packageJSON;
const match = /^[0-9]+\.[0-9]+\.[0-9]+-?([^.]*)/.exec(version);
assert(match, 'Version does not match semver spec.');
const tag = match[1];
assert(!tag || tag === 'rc', 'Only "rc" tag is supported.');

assert(!packageJSON.publishConfig, 'Can not override "publishConfig".');
packageJSON.publishConfig = { tag: tag || 'latest' };

fs.writeFileSync('./dist/package.json', JSON.stringify(packageJSON, null, 2));
