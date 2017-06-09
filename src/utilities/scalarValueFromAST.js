/* @flow */
/**
 *  Copyright (c) 2017, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import keyValMap from '../jsutils/keyValMap';
import * as Kind from '../language/kinds';
import type { ValueNode } from '../language/ast';

/**
 * Create a JavaScript value from a GraphQL language AST representation
 * of Scalar.
 */
export function scalarValueFromAST(astValue: ValueNode): mixed {
  switch (astValue.kind) {
    case Kind.NULL:
      return null;
    case Kind.INT:
      return parseInt(astValue.value, 10);
    case Kind.FLOAT:
      return parseFloat(astValue.value);
    case Kind.STRING:
    case Kind.BOOLEAN:
      return astValue.value;
    case Kind.LIST:
      return astValue.values.map(scalarValueFromAST);
    case Kind.OBJECT:
      return keyValMap(
        astValue.fields,
        field => field.name.value,
        field => scalarValueFromAST(field.value),
      );
    case Kind.ENUM:
      throw new Error('Scalar value can not contain Enum.');
    case Kind.VARIABLE:
      throw new Error('Scalar value can not contain Query variable.');
  }
}
