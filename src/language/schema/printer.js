/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { parseSchema } from './parser';
import { materializeSchema } from './materializer';
import { introspectionQuery } from './../../type/introspectionQuery';
import { graphql } from '../../';

export async function getIntrospectionResult(body, queryType) {
  var doc = parseSchema(body);
  var schema = materializeSchema(doc, queryType);
  return await graphql(schema, introspectionQuery);
}
