'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.specifiedRules = undefined;

var _UniqueOperationNames = require('./rules/UniqueOperationNames');

var _LoneAnonymousOperation = require('./rules/LoneAnonymousOperation');

var _KnownTypeNames = require('./rules/KnownTypeNames');

var _FragmentsOnCompositeTypes = require('./rules/FragmentsOnCompositeTypes');

var _VariablesAreInputTypes = require('./rules/VariablesAreInputTypes');

var _ScalarLeafs = require('./rules/ScalarLeafs');

var _FieldsOnCorrectType = require('./rules/FieldsOnCorrectType');

var _UniqueFragmentNames = require('./rules/UniqueFragmentNames');

var _KnownFragmentNames = require('./rules/KnownFragmentNames');

var _NoUnusedFragments = require('./rules/NoUnusedFragments');

var _PossibleFragmentSpreads = require('./rules/PossibleFragmentSpreads');

var _NoFragmentCycles = require('./rules/NoFragmentCycles');

var _UniqueVariableNames = require('./rules/UniqueVariableNames');

var _NoUndefinedVariables = require('./rules/NoUndefinedVariables');

var _NoUnusedVariables = require('./rules/NoUnusedVariables');

var _KnownDirectives = require('./rules/KnownDirectives');

var _UniqueDirectivesPerLocation = require('./rules/UniqueDirectivesPerLocation');

var _KnownArgumentNames = require('./rules/KnownArgumentNames');

var _UniqueArgumentNames = require('./rules/UniqueArgumentNames');

var _ArgumentsOfCorrectType = require('./rules/ArgumentsOfCorrectType');

var _ProvidedNonNullArguments = require('./rules/ProvidedNonNullArguments');

var _DefaultValuesOfCorrectType = require('./rules/DefaultValuesOfCorrectType');

var _VariablesInAllowedPosition = require('./rules/VariablesInAllowedPosition');

var _OverlappingFieldsCanBeMerged = require('./rules/OverlappingFieldsCanBeMerged');

var _UniqueInputFieldNames = require('./rules/UniqueInputFieldNames');

/**
 * This set includes all validation rules defined by the GraphQL spec.
 */


// Spec Section: "Field Selection Merging"


// Spec Section: "Variable Default Values Are Correctly Typed"


// Spec Section: "Argument Values Type Correctness"


// Spec Section: "Argument Names"


// Spec Section: "Directives Are Defined"


// Spec Section: "All Variable Used Defined"


// Spec Section: "Fragments must not form cycles"


// Spec Section: "Fragments must be used"


// Spec Section: "Fragment Name Uniqueness"


// Spec Section: "Leaf Field Selections"


// Spec Section: "Fragments on Composite Types"


// Spec Section: "Lone Anonymous Operation"
var specifiedRules = exports.specifiedRules = [_UniqueOperationNames.UniqueOperationNames, _LoneAnonymousOperation.LoneAnonymousOperation, _KnownTypeNames.KnownTypeNames, _FragmentsOnCompositeTypes.FragmentsOnCompositeTypes, _VariablesAreInputTypes.VariablesAreInputTypes, _ScalarLeafs.ScalarLeafs, _FieldsOnCorrectType.FieldsOnCorrectType, _UniqueFragmentNames.UniqueFragmentNames, _KnownFragmentNames.KnownFragmentNames, _NoUnusedFragments.NoUnusedFragments, _PossibleFragmentSpreads.PossibleFragmentSpreads, _NoFragmentCycles.NoFragmentCycles, _UniqueVariableNames.UniqueVariableNames, _NoUndefinedVariables.NoUndefinedVariables, _NoUnusedVariables.NoUnusedVariables, _KnownDirectives.KnownDirectives, _UniqueDirectivesPerLocation.UniqueDirectivesPerLocation, _KnownArgumentNames.KnownArgumentNames, _UniqueArgumentNames.UniqueArgumentNames, _ArgumentsOfCorrectType.ArgumentsOfCorrectType, _ProvidedNonNullArguments.ProvidedNonNullArguments, _DefaultValuesOfCorrectType.DefaultValuesOfCorrectType, _VariablesInAllowedPosition.VariablesInAllowedPosition, _OverlappingFieldsCanBeMerged.OverlappingFieldsCanBeMerged, _UniqueInputFieldNames.UniqueInputFieldNames];

// Spec Section: "Input Object Field Uniqueness"


// Spec Section: "All Variable Usages Are Allowed"


// Spec Section: "Argument Optionality"


// Spec Section: "Argument Uniqueness"


// Spec Section: "Directives Are Unique Per Location"


// Spec Section: "All Variables Used"


// Spec Section: "Variable Uniqueness"


// Spec Section: "Fragment spread is possible"


// Spec Section: "Fragment spread target defined"


// Spec Section: "Field Selections on Objects, Interfaces, and Unions Types"


// Spec Section: "Variables are Input Types"


// Spec Section: "Fragment Spread Type Existence"

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// Spec Section: "Operation Name Uniqueness"