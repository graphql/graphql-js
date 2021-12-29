// Spec Section: "Executable Definitions"
import { ExecutableDefinitionsRule } from './rules/ExecutableDefinitionsRule';
// Spec Section: "Field Selections on Objects, Interfaces, and Unions Types"
import { FieldsOnCorrectTypeRule } from './rules/FieldsOnCorrectTypeRule';
// Spec Section: "Fragments on Composite Types"
import { FragmentsOnCompositeTypesRule } from './rules/FragmentsOnCompositeTypesRule';
// Spec Section: "Argument Names"
import {
  KnownArgumentNamesOnDirectivesRule,
  KnownArgumentNamesRule,
} from './rules/KnownArgumentNamesRule';
// Spec Section: "Directives Are Defined"
import { KnownDirectivesRule } from './rules/KnownDirectivesRule';
// Spec Section: "Fragment spread target defined"
import { KnownFragmentNamesRule } from './rules/KnownFragmentNamesRule';
// Spec Section: "Fragment Spread Type Existence"
import { KnownTypeNamesRule } from './rules/KnownTypeNamesRule';
// Spec Section: "Lone Anonymous Operation"
import { LoneAnonymousOperationRule } from './rules/LoneAnonymousOperationRule';
// SDL-specific validation rules
import { LoneSchemaDefinitionRule } from './rules/LoneSchemaDefinitionRule';
// Spec Section: "Fragments must not form cycles"
import { NoFragmentCyclesRule } from './rules/NoFragmentCyclesRule';
// Spec Section: "All Variable Used Defined"
import { NoUndefinedVariablesRule } from './rules/NoUndefinedVariablesRule';
// Spec Section: "Fragments must be used"
import { NoUnusedFragmentsRule } from './rules/NoUnusedFragmentsRule';
// Spec Section: "All Variables Used"
import { NoUnusedVariablesRule } from './rules/NoUnusedVariablesRule';
// Spec Section: "Field Selection Merging"
import { OverlappingFieldsCanBeMergedRule } from './rules/OverlappingFieldsCanBeMergedRule';
// Spec Section: "Fragment spread is possible"
import { PossibleFragmentSpreadsRule } from './rules/PossibleFragmentSpreadsRule';
import { PossibleTypeExtensionsRule } from './rules/PossibleTypeExtensionsRule';
// Spec Section: "Argument Optionality"
import {
  ProvidedRequiredArgumentsOnDirectivesRule,
  ProvidedRequiredArgumentsRule,
} from './rules/ProvidedRequiredArgumentsRule';
// Spec Section: "Leaf Field Selections"
import { ScalarLeafsRule } from './rules/ScalarLeafsRule';
// Spec Section: "Subscriptions with Single Root Field"
import { SingleFieldSubscriptionsRule } from './rules/SingleFieldSubscriptionsRule';
import { UniqueArgumentDefinitionNamesRule } from './rules/UniqueArgumentDefinitionNamesRule';
// Spec Section: "Argument Uniqueness"
import { UniqueArgumentNamesRule } from './rules/UniqueArgumentNamesRule';
import { UniqueDirectiveNamesRule } from './rules/UniqueDirectiveNamesRule';
// Spec Section: "Directives Are Unique Per Location"
import { UniqueDirectivesPerLocationRule } from './rules/UniqueDirectivesPerLocationRule';
import { UniqueEnumValueNamesRule } from './rules/UniqueEnumValueNamesRule';
import { UniqueFieldDefinitionNamesRule } from './rules/UniqueFieldDefinitionNamesRule';
// Spec Section: "Fragment Name Uniqueness"
import { UniqueFragmentNamesRule } from './rules/UniqueFragmentNamesRule';
// Spec Section: "Input Object Field Uniqueness"
import { UniqueInputFieldNamesRule } from './rules/UniqueInputFieldNamesRule';
// Spec Section: "Operation Name Uniqueness"
import { UniqueOperationNamesRule } from './rules/UniqueOperationNamesRule';
import { UniqueOperationTypesRule } from './rules/UniqueOperationTypesRule';
import { UniqueTypeNamesRule } from './rules/UniqueTypeNamesRule';
// Spec Section: "Variable Uniqueness"
import { UniqueVariableNamesRule } from './rules/UniqueVariableNamesRule';
// Spec Section: "Value Type Correctness"
import { ValuesOfCorrectTypeRule } from './rules/ValuesOfCorrectTypeRule';
// Spec Section: "Variables are Input Types"
import { VariablesAreInputTypesRule } from './rules/VariablesAreInputTypesRule';
// Spec Section: "All Variable Usages Are Allowed"
import { VariablesInAllowedPositionRule } from './rules/VariablesInAllowedPositionRule';
import type { SDLValidationRule, ValidationRule } from './ValidationContext';

/**
 * This set includes all validation rules defined by the GraphQL spec.
 *
 * The order of the rules in this list has been adjusted to lead to the
 * most clear output when encountering multiple validation errors.
 */
export const specifiedRules: ReadonlyArray<ValidationRule> = Object.freeze([
  ExecutableDefinitionsRule,
  UniqueOperationNamesRule,
  LoneAnonymousOperationRule,
  SingleFieldSubscriptionsRule,
  KnownTypeNamesRule,
  FragmentsOnCompositeTypesRule,
  VariablesAreInputTypesRule,
  ScalarLeafsRule,
  FieldsOnCorrectTypeRule,
  UniqueFragmentNamesRule,
  KnownFragmentNamesRule,
  NoUnusedFragmentsRule,
  PossibleFragmentSpreadsRule,
  NoFragmentCyclesRule,
  UniqueVariableNamesRule,
  NoUndefinedVariablesRule,
  NoUnusedVariablesRule,
  KnownDirectivesRule,
  UniqueDirectivesPerLocationRule,
  KnownArgumentNamesRule,
  UniqueArgumentNamesRule,
  ValuesOfCorrectTypeRule,
  ProvidedRequiredArgumentsRule,
  VariablesInAllowedPositionRule,
  OverlappingFieldsCanBeMergedRule,
  UniqueInputFieldNamesRule,
]);

/**
 * @internal
 */
export const specifiedSDLRules: ReadonlyArray<SDLValidationRule> =
  Object.freeze([
    LoneSchemaDefinitionRule,
    UniqueOperationTypesRule,
    UniqueTypeNamesRule,
    UniqueEnumValueNamesRule,
    UniqueFieldDefinitionNamesRule,
    UniqueArgumentDefinitionNamesRule,
    UniqueDirectiveNamesRule,
    KnownTypeNamesRule,
    KnownDirectivesRule,
    UniqueDirectivesPerLocationRule,
    PossibleTypeExtensionsRule,
    KnownArgumentNamesOnDirectivesRule,
    UniqueArgumentNamesRule,
    UniqueInputFieldNamesRule,
    ProvidedRequiredArgumentsOnDirectivesRule,
  ]);
