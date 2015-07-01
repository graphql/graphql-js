/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import InterfacePossibleTypesMustImplementTheInterface
  from './rules/InterfacePossibleTypesMustImplementTheInterface';
import NoInputTypesAsOutputFields from './rules/NoInputTypesAsOutputFields';
import NoOutputTypesAsInputArgs from './rules/NoOutputTypesAsInputArgs';
import TypesInterfacesMustShowThemAsPossible
  from './rules/TypesInterfacesMustShowThemAsPossible';

export var allRules = [
  InterfacePossibleTypesMustImplementTheInterface,
  NoInputTypesAsOutputFields,
  NoOutputTypesAsInputArgs,
  TypesInterfacesMustShowThemAsPossible,
];
