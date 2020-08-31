"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.specifiedSDLRules = exports.specifiedRules = void 0;

var _ExecutableDefinitionsRule = require("./rules/ExecutableDefinitionsRule.js");

var _UniqueOperationNamesRule = require("./rules/UniqueOperationNamesRule.js");

var _LoneAnonymousOperationRule = require("./rules/LoneAnonymousOperationRule.js");

var _SingleFieldSubscriptionsRule = require("./rules/SingleFieldSubscriptionsRule.js");

var _KnownTypeNamesRule = require("./rules/KnownTypeNamesRule.js");

var _FragmentsOnCompositeTypesRule = require("./rules/FragmentsOnCompositeTypesRule.js");

var _VariablesAreInputTypesRule = require("./rules/VariablesAreInputTypesRule.js");

var _ScalarLeafsRule = require("./rules/ScalarLeafsRule.js");

var _FieldsOnCorrectTypeRule = require("./rules/FieldsOnCorrectTypeRule.js");

var _UniqueFragmentNamesRule = require("./rules/UniqueFragmentNamesRule.js");

var _KnownFragmentNamesRule = require("./rules/KnownFragmentNamesRule.js");

var _NoUnusedFragmentsRule = require("./rules/NoUnusedFragmentsRule.js");

var _PossibleFragmentSpreadsRule = require("./rules/PossibleFragmentSpreadsRule.js");

var _NoFragmentCyclesRule = require("./rules/NoFragmentCyclesRule.js");

var _UniqueVariableNamesRule = require("./rules/UniqueVariableNamesRule.js");

var _NoUndefinedVariablesRule = require("./rules/NoUndefinedVariablesRule.js");

var _NoUnusedVariablesRule = require("./rules/NoUnusedVariablesRule.js");

var _KnownDirectivesRule = require("./rules/KnownDirectivesRule.js");

var _UniqueDirectivesPerLocationRule = require("./rules/UniqueDirectivesPerLocationRule.js");

var _KnownArgumentNamesRule = require("./rules/KnownArgumentNamesRule.js");

var _UniqueArgumentNamesRule = require("./rules/UniqueArgumentNamesRule.js");

var _ValuesOfCorrectTypeRule = require("./rules/ValuesOfCorrectTypeRule.js");

var _ProvidedRequiredArgumentsRule = require("./rules/ProvidedRequiredArgumentsRule.js");

var _VariablesInAllowedPositionRule = require("./rules/VariablesInAllowedPositionRule.js");

var _OverlappingFieldsCanBeMergedRule = require("./rules/OverlappingFieldsCanBeMergedRule.js");

var _UniqueInputFieldNamesRule = require("./rules/UniqueInputFieldNamesRule.js");

var _LoneSchemaDefinitionRule = require("./rules/LoneSchemaDefinitionRule.js");

var _UniqueOperationTypesRule = require("./rules/UniqueOperationTypesRule.js");

var _UniqueTypeNamesRule = require("./rules/UniqueTypeNamesRule.js");

var _UniqueEnumValueNamesRule = require("./rules/UniqueEnumValueNamesRule.js");

var _UniqueFieldDefinitionNamesRule = require("./rules/UniqueFieldDefinitionNamesRule.js");

var _UniqueDirectiveNamesRule = require("./rules/UniqueDirectiveNamesRule.js");

var _PossibleTypeExtensionsRule = require("./rules/PossibleTypeExtensionsRule.js");

// Spec Section: "Executable Definitions"
// Spec Section: "Operation Name Uniqueness"
// Spec Section: "Lone Anonymous Operation"
// Spec Section: "Subscriptions with Single Root Field"
// Spec Section: "Fragment Spread Type Existence"
// Spec Section: "Fragments on Composite Types"
// Spec Section: "Variables are Input Types"
// Spec Section: "Leaf Field Selections"
// Spec Section: "Field Selections on Objects, Interfaces, and Unions Types"
// Spec Section: "Fragment Name Uniqueness"
// Spec Section: "Fragment spread target defined"
// Spec Section: "Fragments must be used"
// Spec Section: "Fragment spread is possible"
// Spec Section: "Fragments must not form cycles"
// Spec Section: "Variable Uniqueness"
// Spec Section: "All Variable Used Defined"
// Spec Section: "All Variables Used"
// Spec Section: "Directives Are Defined"
// Spec Section: "Directives Are Unique Per Location"
// Spec Section: "Argument Names"
// Spec Section: "Argument Uniqueness"
// Spec Section: "Value Type Correctness"
// Spec Section: "Argument Optionality"
// Spec Section: "All Variable Usages Are Allowed"
// Spec Section: "Field Selection Merging"
// Spec Section: "Input Object Field Uniqueness"
// SDL-specific validation rules

/**
 * This set includes all validation rules defined by the GraphQL spec.
 *
 * The order of the rules in this list has been adjusted to lead to the
 * most clear output when encountering multiple validation errors.
 */
var specifiedRules = Object.freeze([_ExecutableDefinitionsRule.ExecutableDefinitionsRule, _UniqueOperationNamesRule.UniqueOperationNamesRule, _LoneAnonymousOperationRule.LoneAnonymousOperationRule, _SingleFieldSubscriptionsRule.SingleFieldSubscriptionsRule, _KnownTypeNamesRule.KnownTypeNamesRule, _FragmentsOnCompositeTypesRule.FragmentsOnCompositeTypesRule, _VariablesAreInputTypesRule.VariablesAreInputTypesRule, _ScalarLeafsRule.ScalarLeafsRule, _FieldsOnCorrectTypeRule.FieldsOnCorrectTypeRule, _UniqueFragmentNamesRule.UniqueFragmentNamesRule, _KnownFragmentNamesRule.KnownFragmentNamesRule, _NoUnusedFragmentsRule.NoUnusedFragmentsRule, _PossibleFragmentSpreadsRule.PossibleFragmentSpreadsRule, _NoFragmentCyclesRule.NoFragmentCyclesRule, _UniqueVariableNamesRule.UniqueVariableNamesRule, _NoUndefinedVariablesRule.NoUndefinedVariablesRule, _NoUnusedVariablesRule.NoUnusedVariablesRule, _KnownDirectivesRule.KnownDirectivesRule, _UniqueDirectivesPerLocationRule.UniqueDirectivesPerLocationRule, _KnownArgumentNamesRule.KnownArgumentNamesRule, _UniqueArgumentNamesRule.UniqueArgumentNamesRule, _ValuesOfCorrectTypeRule.ValuesOfCorrectTypeRule, _ProvidedRequiredArgumentsRule.ProvidedRequiredArgumentsRule, _VariablesInAllowedPositionRule.VariablesInAllowedPositionRule, _OverlappingFieldsCanBeMergedRule.OverlappingFieldsCanBeMergedRule, _UniqueInputFieldNamesRule.UniqueInputFieldNamesRule]);
/**
 * @internal
 */

exports.specifiedRules = specifiedRules;
var specifiedSDLRules = Object.freeze([_LoneSchemaDefinitionRule.LoneSchemaDefinitionRule, _UniqueOperationTypesRule.UniqueOperationTypesRule, _UniqueTypeNamesRule.UniqueTypeNamesRule, _UniqueEnumValueNamesRule.UniqueEnumValueNamesRule, _UniqueFieldDefinitionNamesRule.UniqueFieldDefinitionNamesRule, _UniqueDirectiveNamesRule.UniqueDirectiveNamesRule, _KnownTypeNamesRule.KnownTypeNamesRule, _KnownDirectivesRule.KnownDirectivesRule, _UniqueDirectivesPerLocationRule.UniqueDirectivesPerLocationRule, _PossibleTypeExtensionsRule.PossibleTypeExtensionsRule, _KnownArgumentNamesRule.KnownArgumentNamesOnDirectivesRule, _UniqueArgumentNamesRule.UniqueArgumentNamesRule, _UniqueInputFieldNamesRule.UniqueInputFieldNamesRule, _ProvidedRequiredArgumentsRule.ProvidedRequiredArgumentsOnDirectivesRule]);
exports.specifiedSDLRules = specifiedSDLRules;
