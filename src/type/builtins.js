/* @flow */
/**
 *  Copyright (c) 2017, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import type { GraphQLNamedType } from './definition';
import { introspectionTypes } from './introspection';
import { builtInScalars } from './scalars';

export const builtInTypes: Array<GraphQLNamedType> = [
  ...introspectionTypes,
  ...builtInScalars,
];

const builtInTypeNames = builtInTypes.map(x => x.name);
export function isBuiltInType(type: GraphQLNamedType): boolean %checks {
  return builtInTypeNames.includes(type.name);
}
