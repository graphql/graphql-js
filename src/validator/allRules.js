/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// Spec Section: Fragment Spread Type Existence
import KnownTypeNames from './rules/KnownTypeNames';
// Spec Section: Fragments on Composite Types
import FragmentsOnCompositeTypes from './rules/FragmentsOnCompositeTypes';
// Spec Section: Variables are Input Types
import VariablesAreInputTypes from './rules/VariablesAreInputTypes';
// Spec Section: "Leaf Field Selections"
import ScalarLeafs from './rules/ScalarLeafs';
// Spec Section: "Field Selections on Objects, Interfaces, and Unions Types"
import FieldsOnCorrectType from './rules/FieldsOnCorrectType';
// Spec Section: "Fragment spread target defined"
import KnownFragmentNames from './rules/KnownFragmentNames';
// Spec Section: "Fragments must be used"
import NoUnusedFragments from './rules/NoUnusedFragments';
// Spec Section: "Fragment spread is possible"
import PossibleFragmentSpreads from './rules/PossibleFragmentSpreads';
// Spec Section: "Fragments must not form cycles"
import NoFragmentCycles from './rules/NoFragmentCycles';
// Spec Section: "All Variable Used Defined"
import NoUndefinedVariables from './rules/NoUndefinedVariables';
// Spec Section: "All Variables Used"
import NoUnusedVariables from './rules/NoUnusedVariables';
// Spec Section: "Directives Are Defined"
import KnownDirectives from './rules/KnownDirectives';
// Spec Section: "Argument Names"
import KnownArgumentNames from './rules/KnownArgumentNames';
// Spec Section: "Argument Values Type Correctness"
import ArgumentsOfCorrectType from './rules/ArgumentsOfCorrectType';
// Spec Section: "Variable Default Values Are Correctly Typed"
import DefaultValuesOfCorrectType from './rules/DefaultValuesOfCorrectType';
// Spec Section: "All Variable Usages Are Allowed"
import VariablesInAllowedPosition from './rules/VariablesInAllowedPosition';
// Spec Section: "Field Selection Merging"
import OverlappingFieldsCanBeMerged from './rules/OverlappingFieldsCanBeMerged';

/**
 * This default set of rules includes all validation rules defined by the
 * GraphQL spec. The order of these rules is important as errors encountered in
 * earlier rules will skip later rules, leading to less noise in error output.
 */
export var allRules = [
  KnownTypeNames,
  FragmentsOnCompositeTypes,
  VariablesAreInputTypes,
  ScalarLeafs,
  FieldsOnCorrectType,
  KnownFragmentNames,
  NoUnusedFragments,
  PossibleFragmentSpreads,
  NoFragmentCycles,
  NoUndefinedVariables,
  NoUnusedVariables,
  KnownDirectives,
  KnownArgumentNames,
  ArgumentsOfCorrectType,
  DefaultValuesOfCorrectType,
  VariablesInAllowedPosition,
  OverlappingFieldsCanBeMerged
];
