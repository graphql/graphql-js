/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// Spec Section: "Operation Name Uniqueness"
import { UniqueOperationNames } from './rules/UniqueOperationNames';

// Spec Section: "Lone Anonymous Operation"
import { LoneAnonymousOperation } from './rules/LoneAnonymousOperation';

// Spec Section: "Fragment Spread Type Existence"
import { KnownTypeNames } from './rules/KnownTypeNames';

// Spec Section: "Fragments on Composite Types"
import { FragmentsOnCompositeTypes } from './rules/FragmentsOnCompositeTypes';

// Spec Section: "Variables are Input Types"
import { VariablesAreInputTypes } from './rules/VariablesAreInputTypes';

// Spec Section: "Leaf Field Selections"
import { ScalarLeafs } from './rules/ScalarLeafs';

// Spec Section: "Field Selections on Objects, Interfaces, and Unions Types"
import { FieldsOnCorrectType } from './rules/FieldsOnCorrectType';

// Spec Section: "Fragment Name Uniqueness"
import { UniqueFragmentNames } from './rules/UniqueFragmentNames';

// Spec Section: "Fragment spread target defined"
import { KnownFragmentNames } from './rules/KnownFragmentNames';

// Spec Section: "Fragments must be used"
import { NoUnusedFragments } from './rules/NoUnusedFragments';

// Spec Section: "Fragment spread is possible"
import { PossibleFragmentSpreads } from './rules/PossibleFragmentSpreads';

// Spec Section: "Fragments must not form cycles"
import { NoFragmentCycles } from './rules/NoFragmentCycles';

// Spec Section: "Variable Uniqueness"
import { UniqueVariableNames } from './rules/UniqueVariableNames';

// Spec Section: "All Variable Used Defined"
import { NoUndefinedVariables } from './rules/NoUndefinedVariables';

// Spec Section: "All Variables Used"
import { NoUnusedVariables } from './rules/NoUnusedVariables';

// Spec Section: "Directives Are Defined"
import { KnownDirectives } from './rules/KnownDirectives';

// Spec Section: "Directives Are Unique Per Location"
import {
  UniqueDirectivesPerLocation
} from './rules/UniqueDirectivesPerLocation';

// Spec Section: "Argument Names"
import { KnownArgumentNames } from './rules/KnownArgumentNames';

// Spec Section: "Argument Uniqueness"
import { UniqueArgumentNames } from './rules/UniqueArgumentNames';

// Spec Section: "Argument Values Type Correctness"
import { ArgumentsOfCorrectType } from './rules/ArgumentsOfCorrectType';

// Spec Section: "Argument Optionality"
import { ProvidedNonNullArguments } from './rules/ProvidedNonNullArguments';

// Spec Section: "Variable Default Values Are Correctly Typed"
import { DefaultValuesOfCorrectType } from './rules/DefaultValuesOfCorrectType';

// Spec Section: "All Variable Usages Are Allowed"
import { VariablesInAllowedPosition } from './rules/VariablesInAllowedPosition';

// Spec Section: "Field Selection Merging"
import {
  OverlappingFieldsCanBeMerged
} from './rules/OverlappingFieldsCanBeMerged';

// Spec Section: "Input Object Field Uniqueness"
import { UniqueInputFieldNames } from './rules/UniqueInputFieldNames';

import type { ValidationContext } from './index';

/**
 * This set includes all validation rules defined by the GraphQL spec.
 */
export const specifiedRules: Array<(context: ValidationContext) => any> = [
  UniqueOperationNames,
  LoneAnonymousOperation,
  KnownTypeNames,
  FragmentsOnCompositeTypes,
  VariablesAreInputTypes,
  ScalarLeafs,
  FieldsOnCorrectType,
  UniqueFragmentNames,
  KnownFragmentNames,
  NoUnusedFragments,
  PossibleFragmentSpreads,
  NoFragmentCycles,
  UniqueVariableNames,
  NoUndefinedVariables,
  NoUnusedVariables,
  KnownDirectives,
  UniqueDirectivesPerLocation,
  KnownArgumentNames,
  UniqueArgumentNames,
  ArgumentsOfCorrectType,
  ProvidedNonNullArguments,
  DefaultValuesOfCorrectType,
  VariablesInAllowedPosition,
  OverlappingFieldsCanBeMerged,
  UniqueInputFieldNames,
];
