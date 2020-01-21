// Spec Section: "Executable Definitions"
import { ExecutableDefinitions } from "./rules/ExecutableDefinitions.mjs"; // Spec Section: "Operation Name Uniqueness"

import { UniqueOperationNames } from "./rules/UniqueOperationNames.mjs"; // Spec Section: "Lone Anonymous Operation"

import { LoneAnonymousOperation } from "./rules/LoneAnonymousOperation.mjs"; // Spec Section: "Subscriptions with Single Root Field"

import { SingleFieldSubscriptions } from "./rules/SingleFieldSubscriptions.mjs"; // Spec Section: "Fragment Spread Type Existence"

import { KnownTypeNames } from "./rules/KnownTypeNames.mjs"; // Spec Section: "Fragments on Composite Types"

import { FragmentsOnCompositeTypes } from "./rules/FragmentsOnCompositeTypes.mjs"; // Spec Section: "Variables are Input Types"

import { VariablesAreInputTypes } from "./rules/VariablesAreInputTypes.mjs"; // Spec Section: "Leaf Field Selections"

import { ScalarLeafs } from "./rules/ScalarLeafs.mjs"; // Spec Section: "Field Selections on Objects, Interfaces, and Unions Types"

import { FieldsOnCorrectType } from "./rules/FieldsOnCorrectType.mjs"; // Spec Section: "Fragment Name Uniqueness"

import { UniqueFragmentNames } from "./rules/UniqueFragmentNames.mjs"; // Spec Section: "Fragment spread target defined"

import { KnownFragmentNames } from "./rules/KnownFragmentNames.mjs"; // Spec Section: "Fragments must be used"

import { NoUnusedFragments } from "./rules/NoUnusedFragments.mjs"; // Spec Section: "Fragment spread is possible"

import { PossibleFragmentSpreads } from "./rules/PossibleFragmentSpreads.mjs"; // Spec Section: "Fragments must not form cycles"

import { NoFragmentCycles } from "./rules/NoFragmentCycles.mjs"; // Spec Section: "Variable Uniqueness"

import { UniqueVariableNames } from "./rules/UniqueVariableNames.mjs"; // Spec Section: "All Variable Used Defined"

import { NoUndefinedVariables } from "./rules/NoUndefinedVariables.mjs"; // Spec Section: "All Variables Used"

import { NoUnusedVariables } from "./rules/NoUnusedVariables.mjs"; // Spec Section: "Directives Are Defined"

import { KnownDirectives } from "./rules/KnownDirectives.mjs"; // Spec Section: "Directives Are Unique Per Location"

import { UniqueDirectivesPerLocation } from "./rules/UniqueDirectivesPerLocation.mjs"; // Spec Section: "Argument Names"

import { KnownArgumentNames, KnownArgumentNamesOnDirectives } from "./rules/KnownArgumentNames.mjs"; // Spec Section: "Argument Uniqueness"

import { UniqueArgumentNames } from "./rules/UniqueArgumentNames.mjs"; // Spec Section: "Value Type Correctness"

import { ValuesOfCorrectType } from "./rules/ValuesOfCorrectType.mjs"; // Spec Section: "Argument Optionality"

import { ProvidedRequiredArguments, ProvidedRequiredArgumentsOnDirectives } from "./rules/ProvidedRequiredArguments.mjs"; // Spec Section: "All Variable Usages Are Allowed"

import { VariablesInAllowedPosition } from "./rules/VariablesInAllowedPosition.mjs"; // Spec Section: "Field Selection Merging"

import { OverlappingFieldsCanBeMerged } from "./rules/OverlappingFieldsCanBeMerged.mjs"; // Spec Section: "Input Object Field Uniqueness"

import { UniqueInputFieldNames } from "./rules/UniqueInputFieldNames.mjs"; // SDL-specific validation rules

import { LoneSchemaDefinition } from "./rules/LoneSchemaDefinition.mjs";
import { UniqueOperationTypes } from "./rules/UniqueOperationTypes.mjs";
import { UniqueTypeNames } from "./rules/UniqueTypeNames.mjs";
import { UniqueEnumValueNames } from "./rules/UniqueEnumValueNames.mjs";
import { UniqueFieldDefinitionNames } from "./rules/UniqueFieldDefinitionNames.mjs";
import { UniqueDirectiveNames } from "./rules/UniqueDirectiveNames.mjs";
import { PossibleTypeExtensions } from "./rules/PossibleTypeExtensions.mjs";
/**
 * This set includes all validation rules defined by the GraphQL spec.
 *
 * The order of the rules in this list has been adjusted to lead to the
 * most clear output when encountering multiple validation errors.
 */

export var specifiedRules = Object.freeze([ExecutableDefinitions, UniqueOperationNames, LoneAnonymousOperation, SingleFieldSubscriptions, KnownTypeNames, FragmentsOnCompositeTypes, VariablesAreInputTypes, ScalarLeafs, FieldsOnCorrectType, UniqueFragmentNames, KnownFragmentNames, NoUnusedFragments, PossibleFragmentSpreads, NoFragmentCycles, UniqueVariableNames, NoUndefinedVariables, NoUnusedVariables, KnownDirectives, UniqueDirectivesPerLocation, KnownArgumentNames, UniqueArgumentNames, ValuesOfCorrectType, ProvidedRequiredArguments, VariablesInAllowedPosition, OverlappingFieldsCanBeMerged, UniqueInputFieldNames]);
/**
 * @internal
 */

export var specifiedSDLRules = Object.freeze([LoneSchemaDefinition, UniqueOperationTypes, UniqueTypeNames, UniqueEnumValueNames, UniqueFieldDefinitionNames, UniqueDirectiveNames, KnownTypeNames, KnownDirectives, UniqueDirectivesPerLocation, PossibleTypeExtensions, KnownArgumentNamesOnDirectives, UniqueArgumentNames, UniqueInputFieldNames, ProvidedRequiredArgumentsOnDirectives]);
