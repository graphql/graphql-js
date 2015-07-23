/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { getIntrospectionResult }
  from '../../../language/schema/printer';

var Promise = require('bluebird');
var parseArgs = require('minimist');
var fs = require('fs');

Promise.promisifyAll(fs);

export async function executeTool() {
  try {
    var argDict = parseArgs(process.argv.slice(2));

    if (argDict['?'] !== undefined || argDict.help !== undefined) {
      console.log(helpString);
      process.exit(0);
    }

    if (argDict.query === undefined) {
      console.log('--query is required');
      console.log(helpString);
      process.exit(0);
    }

    if (argDict.file === undefined) {
      console.log('--file is required');
      console.log(helpString);
      process.exit(0);
    }

    var body = await fs.readFileAsync(argDict.file);
    var result = await getIntrospectionResult(body, argDict.query);
    var out = await JSON.stringify(result, null, 2);
    console.log(out);
  } catch (error) {
    console.error(error);
    console.error(error.stack);
  }
}

var helpString = `
This tool consumes GraphQL schema definition files and outputs the
introspection query result from querying that schema.

Required:

--file <path>: The path to the input schema definition file.
--query <queryType>: The query type (root type) of the schema.`;
