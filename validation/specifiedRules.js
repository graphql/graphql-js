'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.specifiedSDLRules = exports.specifiedRules = void 0;
// Spec Section: "Defer And Stream Directive Labels Are Unique"
const DeferStreamDirectiveLabelRule_js_1 = require('./rules/DeferStreamDirectiveLabelRule.js');
// Spec Section: "Defer And Stream Directives Are Used On Valid Root Field"
const DeferStreamDirectiveOnRootFieldRule_js_1 = require('./rules/DeferStreamDirectiveOnRootFieldRule.js');
// Spec Section: "Defer And Stream Directives Are Used On Valid Operations"
const DeferStreamDirectiveOnValidOperationsRule_js_1 = require('./rules/DeferStreamDirectiveOnValidOperationsRule.js');
// Spec Section: "Executable Definitions"
const ExecutableDefinitionsRule_js_1 = require('./rules/ExecutableDefinitionsRule.js');
// Spec Section: "Field Selections on Objects, Interfaces, and Unions Types"
const FieldsOnCorrectTypeRule_js_1 = require('./rules/FieldsOnCorrectTypeRule.js');
// Spec Section: "Fragments on Composite Types"
const FragmentsOnCompositeTypesRule_js_1 = require('./rules/FragmentsOnCompositeTypesRule.js');
// Spec Section: "Argument Names"
const KnownArgumentNamesRule_js_1 = require('./rules/KnownArgumentNamesRule.js');
// Spec Section: "Directives Are Defined"
const KnownDirectivesRule_js_1 = require('./rules/KnownDirectivesRule.js');
// Spec Section: "Fragment spread target defined"
const KnownFragmentNamesRule_js_1 = require('./rules/KnownFragmentNamesRule.js');
// Spec Section: "Fragment Spread Type Existence"
const KnownTypeNamesRule_js_1 = require('./rules/KnownTypeNamesRule.js');
// Spec Section: "Lone Anonymous Operation"
const LoneAnonymousOperationRule_js_1 = require('./rules/LoneAnonymousOperationRule.js');
// SDL-specific validation rules
const LoneSchemaDefinitionRule_js_1 = require('./rules/LoneSchemaDefinitionRule.js');
// Spec Section: "Fragments must not form cycles"
const NoFragmentCyclesRule_js_1 = require('./rules/NoFragmentCyclesRule.js');
// Spec Section: "All Variable Used Defined"
const NoUndefinedVariablesRule_js_1 = require('./rules/NoUndefinedVariablesRule.js');
// Spec Section: "Fragments must be used"
const NoUnusedFragmentsRule_js_1 = require('./rules/NoUnusedFragmentsRule.js');
// Spec Section: "All Variables Used"
const NoUnusedVariablesRule_js_1 = require('./rules/NoUnusedVariablesRule.js');
// Spec Section: "Field Selection Merging"
const OverlappingFieldsCanBeMergedRule_js_1 = require('./rules/OverlappingFieldsCanBeMergedRule.js');
// Spec Section: "Fragment spread is possible"
const PossibleFragmentSpreadsRule_js_1 = require('./rules/PossibleFragmentSpreadsRule.js');
const PossibleTypeExtensionsRule_js_1 = require('./rules/PossibleTypeExtensionsRule.js');
// Spec Section: "Argument Optionality"
const ProvidedRequiredArgumentsRule_js_1 = require('./rules/ProvidedRequiredArgumentsRule.js');
// Spec Section: "Leaf Field Selections"
const ScalarLeafsRule_js_1 = require('./rules/ScalarLeafsRule.js');
// Spec Section: "Subscriptions with Single Root Field"
const SingleFieldSubscriptionsRule_js_1 = require('./rules/SingleFieldSubscriptionsRule.js');
// Spec Section: "Stream Directives Are Used On List Fields"
const StreamDirectiveOnListFieldRule_js_1 = require('./rules/StreamDirectiveOnListFieldRule.js');
const UniqueArgumentDefinitionNamesRule_js_1 = require('./rules/UniqueArgumentDefinitionNamesRule.js');
// Spec Section: "Argument Uniqueness"
const UniqueArgumentNamesRule_js_1 = require('./rules/UniqueArgumentNamesRule.js');
const UniqueDirectiveNamesRule_js_1 = require('./rules/UniqueDirectiveNamesRule.js');
// Spec Section: "Directives Are Unique Per Location"
const UniqueDirectivesPerLocationRule_js_1 = require('./rules/UniqueDirectivesPerLocationRule.js');
const UniqueEnumValueNamesRule_js_1 = require('./rules/UniqueEnumValueNamesRule.js');
const UniqueFieldDefinitionNamesRule_js_1 = require('./rules/UniqueFieldDefinitionNamesRule.js');
// Spec Section: "Fragment Name Uniqueness"
const UniqueFragmentNamesRule_js_1 = require('./rules/UniqueFragmentNamesRule.js');
// Spec Section: "Input Object Field Uniqueness"
const UniqueInputFieldNamesRule_js_1 = require('./rules/UniqueInputFieldNamesRule.js');
// Spec Section: "Operation Name Uniqueness"
const UniqueOperationNamesRule_js_1 = require('./rules/UniqueOperationNamesRule.js');
const UniqueOperationTypesRule_js_1 = require('./rules/UniqueOperationTypesRule.js');
const UniqueTypeNamesRule_js_1 = require('./rules/UniqueTypeNamesRule.js');
// Spec Section: "Variable Uniqueness"
const UniqueVariableNamesRule_js_1 = require('./rules/UniqueVariableNamesRule.js');
// Spec Section: "Value Type Correctness"
const ValuesOfCorrectTypeRule_js_1 = require('./rules/ValuesOfCorrectTypeRule.js');
// Spec Section: "Variables are Input Types"
const VariablesAreInputTypesRule_js_1 = require('./rules/VariablesAreInputTypesRule.js');
// Spec Section: "All Variable Usages Are Allowed"
const VariablesInAllowedPositionRule_js_1 = require('./rules/VariablesInAllowedPositionRule.js');
/**
 * This set includes all validation rules defined by the GraphQL spec.
 *
 * The order of the rules in this list has been adjusted to lead to the
 * most clear output when encountering multiple validation errors.
 */
exports.specifiedRules = Object.freeze([
  ExecutableDefinitionsRule_js_1.ExecutableDefinitionsRule,
  UniqueOperationNamesRule_js_1.UniqueOperationNamesRule,
  LoneAnonymousOperationRule_js_1.LoneAnonymousOperationRule,
  SingleFieldSubscriptionsRule_js_1.SingleFieldSubscriptionsRule,
  KnownTypeNamesRule_js_1.KnownTypeNamesRule,
  FragmentsOnCompositeTypesRule_js_1.FragmentsOnCompositeTypesRule,
  VariablesAreInputTypesRule_js_1.VariablesAreInputTypesRule,
  ScalarLeafsRule_js_1.ScalarLeafsRule,
  FieldsOnCorrectTypeRule_js_1.FieldsOnCorrectTypeRule,
  UniqueFragmentNamesRule_js_1.UniqueFragmentNamesRule,
  KnownFragmentNamesRule_js_1.KnownFragmentNamesRule,
  NoUnusedFragmentsRule_js_1.NoUnusedFragmentsRule,
  PossibleFragmentSpreadsRule_js_1.PossibleFragmentSpreadsRule,
  NoFragmentCyclesRule_js_1.NoFragmentCyclesRule,
  UniqueVariableNamesRule_js_1.UniqueVariableNamesRule,
  NoUndefinedVariablesRule_js_1.NoUndefinedVariablesRule,
  NoUnusedVariablesRule_js_1.NoUnusedVariablesRule,
  KnownDirectivesRule_js_1.KnownDirectivesRule,
  UniqueDirectivesPerLocationRule_js_1.UniqueDirectivesPerLocationRule,
  DeferStreamDirectiveOnRootFieldRule_js_1.DeferStreamDirectiveOnRootFieldRule,
  DeferStreamDirectiveOnValidOperationsRule_js_1.DeferStreamDirectiveOnValidOperationsRule,
  DeferStreamDirectiveLabelRule_js_1.DeferStreamDirectiveLabelRule,
  StreamDirectiveOnListFieldRule_js_1.StreamDirectiveOnListFieldRule,
  KnownArgumentNamesRule_js_1.KnownArgumentNamesRule,
  UniqueArgumentNamesRule_js_1.UniqueArgumentNamesRule,
  ValuesOfCorrectTypeRule_js_1.ValuesOfCorrectTypeRule,
  ProvidedRequiredArgumentsRule_js_1.ProvidedRequiredArgumentsRule,
  VariablesInAllowedPositionRule_js_1.VariablesInAllowedPositionRule,
  OverlappingFieldsCanBeMergedRule_js_1.OverlappingFieldsCanBeMergedRule,
  UniqueInputFieldNamesRule_js_1.UniqueInputFieldNamesRule,
]);
/**
 * @internal
 */
exports.specifiedSDLRules = Object.freeze([
  LoneSchemaDefinitionRule_js_1.LoneSchemaDefinitionRule,
  UniqueOperationTypesRule_js_1.UniqueOperationTypesRule,
  UniqueTypeNamesRule_js_1.UniqueTypeNamesRule,
  UniqueEnumValueNamesRule_js_1.UniqueEnumValueNamesRule,
  UniqueFieldDefinitionNamesRule_js_1.UniqueFieldDefinitionNamesRule,
  UniqueArgumentDefinitionNamesRule_js_1.UniqueArgumentDefinitionNamesRule,
  UniqueDirectiveNamesRule_js_1.UniqueDirectiveNamesRule,
  KnownTypeNamesRule_js_1.KnownTypeNamesRule,
  KnownDirectivesRule_js_1.KnownDirectivesRule,
  UniqueDirectivesPerLocationRule_js_1.UniqueDirectivesPerLocationRule,
  PossibleTypeExtensionsRule_js_1.PossibleTypeExtensionsRule,
  KnownArgumentNamesRule_js_1.KnownArgumentNamesOnDirectivesRule,
  UniqueArgumentNamesRule_js_1.UniqueArgumentNamesRule,
  UniqueInputFieldNamesRule_js_1.UniqueInputFieldNamesRule,
  ProvidedRequiredArgumentsRule_js_1.ProvidedRequiredArgumentsOnDirectivesRule,
]);
