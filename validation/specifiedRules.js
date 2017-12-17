'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.specifiedRules = undefined;

var _ExecutableDefinitions = require('./rules/ExecutableDefinitions');

var _UniqueOperationNames = require('./rules/UniqueOperationNames');

var _LoneAnonymousOperation = require('./rules/LoneAnonymousOperation');

var _SingleFieldSubscriptions = require('./rules/SingleFieldSubscriptions');

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

var _ValuesOfCorrectType = require('./rules/ValuesOfCorrectType');

var _ProvidedNonNullArguments = require('./rules/ProvidedNonNullArguments');

var _VariablesDefaultValueAllowed = require('./rules/VariablesDefaultValueAllowed');

var _VariablesInAllowedPosition = require('./rules/VariablesInAllowedPosition');

var _OverlappingFieldsCanBeMerged = require('./rules/OverlappingFieldsCanBeMerged');

var _UniqueInputFieldNames = require('./rules/UniqueInputFieldNames');

/**
 * This set includes all validation rules defined by the GraphQL spec.
 *
 * The order of the rules in this list has been adjusted to lead to the
 * most clear output when encountering multiple validation errors.
 */


// Spec Section: "Field Selection Merging"


// Spec Section: "Variables Default Value Is Allowed"


// Spec Section: "Value Type Correctness"


// Spec Section: "Argument Names"


// Spec Section: "Directives Are Defined"


// Spec Section: "All Variable Used Defined"


// Spec Section: "Fragments must not form cycles"


// Spec Section: "Fragments must be used"


// Spec Section: "Fragment Name Uniqueness"


// Spec Section: "Leaf Field Selections"


// Spec Section: "Fragments on Composite Types"


// Spec Section: "Subscriptions with Single Root Field"


// Spec Section: "Operation Name Uniqueness"
var specifiedRules = exports.specifiedRules = [_ExecutableDefinitions.ExecutableDefinitions, _UniqueOperationNames.UniqueOperationNames, _LoneAnonymousOperation.LoneAnonymousOperation, _SingleFieldSubscriptions.SingleFieldSubscriptions, _KnownTypeNames.KnownTypeNames, _FragmentsOnCompositeTypes.FragmentsOnCompositeTypes, _VariablesAreInputTypes.VariablesAreInputTypes, _ScalarLeafs.ScalarLeafs, _FieldsOnCorrectType.FieldsOnCorrectType, _UniqueFragmentNames.UniqueFragmentNames, _KnownFragmentNames.KnownFragmentNames, _NoUnusedFragments.NoUnusedFragments, _PossibleFragmentSpreads.PossibleFragmentSpreads, _NoFragmentCycles.NoFragmentCycles, _UniqueVariableNames.UniqueVariableNames, _NoUndefinedVariables.NoUndefinedVariables, _NoUnusedVariables.NoUnusedVariables, _KnownDirectives.KnownDirectives, _UniqueDirectivesPerLocation.UniqueDirectivesPerLocation, _KnownArgumentNames.KnownArgumentNames, _UniqueArgumentNames.UniqueArgumentNames, _ValuesOfCorrectType.ValuesOfCorrectType, _ProvidedNonNullArguments.ProvidedNonNullArguments, _VariablesDefaultValueAllowed.VariablesDefaultValueAllowed, _VariablesInAllowedPosition.VariablesInAllowedPosition, _OverlappingFieldsCanBeMerged.OverlappingFieldsCanBeMerged, _UniqueInputFieldNames.UniqueInputFieldNames];

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


// Spec Section: "Lone Anonymous Operation"
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

// Spec Section: "Executable Definitions"