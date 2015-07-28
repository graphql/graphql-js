/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { GraphQLSchema } from '../../type';
import { parseSchemaIntoAST } from './parser';
import { materializeSchemaAST } from './materializer';

// DSL --> AST
export { parseSchemaIntoAST };

// DSL --> Schema
export async function createSchemaFromDSL(
  schemaDSL: string,
  queryType: string
) : GraphQLSchema {
  var doc = parseSchemaIntoAST(schemaDSL);
  return await materializeSchemaAST(doc, queryType);
}
