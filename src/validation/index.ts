export { validate } from './validate.js';

export { ValidationContext } from './ValidationContext.js';
export type { ValidationRule } from './ValidationContext.js';

// All validation rules in the GraphQL Specification.
export { specifiedRules, recommendedRules } from './specifiedRules.js';

// Spec Section: "Defer And Stream Directive Labels Are Unique"
export { DeferStreamDirectiveLabelRule } from './rules/DeferStreamDirectiveLabelRule.js';

// Spec Section: "Defer And Stream Directives Are Used On Valid Root Field"
export { DeferStreamDirectiveOnRootFieldRule } from './rules/DeferStreamDirectiveOnRootFieldRule.js';

// Spec Section: "Defer And Stream Directives Are Used On Valid Operations"
export { DeferStreamDirectiveOnValidOperationsRule } from './rules/DeferStreamDirectiveOnValidOperationsRule.js';

// Spec Section: "Executable Definitions"
export { ExecutableDefinitionsRule } from './rules/ExecutableDefinitionsRule.js';

// Spec Section: "Field Selections on Objects, Interfaces, and Unions Types"
export { FieldsOnCorrectTypeRule } from './rules/FieldsOnCorrectTypeRule.js';

// Spec Section: "Fragments on Composite Types"
export { FragmentsOnCompositeTypesRule } from './rules/FragmentsOnCompositeTypesRule.js';

// Spec Section: "Argument Names"
export { KnownArgumentNamesRule } from './rules/KnownArgumentNamesRule.js';

// Spec Section: "Directives Are Defined"
export { KnownDirectivesRule } from './rules/KnownDirectivesRule.js';

// Spec Section: "Fragment spread target defined"
export { KnownFragmentNamesRule } from './rules/KnownFragmentNamesRule.js';

// Spec Section: "Operation Type Existence"
export { KnownOperationTypesRule } from './rules/KnownOperationTypesRule.js';

// Spec Section: "Fragment Spread Type Existence"
export { KnownTypeNamesRule } from './rules/KnownTypeNamesRule.js';

// Spec Section: "Lone Anonymous Operation"
export { LoneAnonymousOperationRule } from './rules/LoneAnonymousOperationRule.js';

// Spec Section: "Fragments must not form cycles"
export { NoFragmentCyclesRule } from './rules/NoFragmentCyclesRule.js';

// Spec Section: "All Variable Used Defined"
export { NoUndefinedVariablesRule } from './rules/NoUndefinedVariablesRule.js';

// Spec Section: "Fragments must be used"
export { NoUnusedFragmentsRule } from './rules/NoUnusedFragmentsRule.js';

// Spec Section: "All Variables Used"
export { NoUnusedVariablesRule } from './rules/NoUnusedVariablesRule.js';

// Spec Section: "Field Selection Merging"
export { OverlappingFieldsCanBeMergedRule } from './rules/OverlappingFieldsCanBeMergedRule.js';

// Spec Section: "Fragment spread is possible"
export { PossibleFragmentSpreadsRule } from './rules/PossibleFragmentSpreadsRule.js';

// Spec Section: "Argument Optionality"
export { ProvidedRequiredArgumentsRule } from './rules/ProvidedRequiredArgumentsRule.js';

// Spec Section: "Leaf Field Selections"
export { ScalarLeafsRule } from './rules/ScalarLeafsRule.js';

// Spec Section: "Subscriptions with Single Root Field"
export { SingleFieldSubscriptionsRule } from './rules/SingleFieldSubscriptionsRule.js';

// Spec Section: "Stream Directives Are Used On List Fields"
export { StreamDirectiveOnListFieldRule } from './rules/StreamDirectiveOnListFieldRule.js';

// Spec Section: "Argument Uniqueness"
export { UniqueArgumentNamesRule } from './rules/UniqueArgumentNamesRule.js';

// Spec Section: "Directives Are Unique Per Location"
export { UniqueDirectivesPerLocationRule } from './rules/UniqueDirectivesPerLocationRule.js';

// Spec Section: "Fragment Name Uniqueness"
export { UniqueFragmentNamesRule } from './rules/UniqueFragmentNamesRule.js';

// Spec Section: "Input Object Field Uniqueness"
export { UniqueInputFieldNamesRule } from './rules/UniqueInputFieldNamesRule.js';

// Spec Section: "Operation Name Uniqueness"
export { UniqueOperationNamesRule } from './rules/UniqueOperationNamesRule.js';

// Spec Section: "Variable Uniqueness"
export { UniqueVariableNamesRule } from './rules/UniqueVariableNamesRule.js';

// Spec Section: "Values Type Correctness"
export { ValuesOfCorrectTypeRule } from './rules/ValuesOfCorrectTypeRule.js';

// Spec Section: "Variables are Input Types"
export { VariablesAreInputTypesRule } from './rules/VariablesAreInputTypesRule.js';

// Spec Section: "All Variable Usages Are Allowed"
export { VariablesInAllowedPositionRule } from './rules/VariablesInAllowedPositionRule.js';

export { MaxIntrospectionDepthRule } from './rules/MaxIntrospectionDepthRule.js';

// SDL-specific validation rules
export { LoneSchemaDefinitionRule } from './rules/LoneSchemaDefinitionRule.js';
export { UniqueOperationTypesRule } from './rules/UniqueOperationTypesRule.js';
export { UniqueTypeNamesRule } from './rules/UniqueTypeNamesRule.js';
export { UniqueEnumValueNamesRule } from './rules/UniqueEnumValueNamesRule.js';
export { UniqueFieldDefinitionNamesRule } from './rules/UniqueFieldDefinitionNamesRule.js';
export { UniqueArgumentDefinitionNamesRule } from './rules/UniqueArgumentDefinitionNamesRule.js';
export { UniqueDirectiveNamesRule } from './rules/UniqueDirectiveNamesRule.js';
export { PossibleTypeExtensionsRule } from './rules/PossibleTypeExtensionsRule.js';

// Optional rules not defined by the GraphQL Specification
export { NoDeprecatedCustomRule } from './rules/custom/NoDeprecatedCustomRule.js';
export { NoSchemaIntrospectionCustomRule } from './rules/custom/NoSchemaIntrospectionCustomRule.js';
