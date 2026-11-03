import { DeferStreamDirectiveLabelRule } from "./rules/DeferStreamDirectiveLabelRule.mjs";
import { DeferStreamDirectiveOnRootFieldRule } from "./rules/DeferStreamDirectiveOnRootFieldRule.mjs";
import { DeferStreamDirectiveOnValidOperationsRule } from "./rules/DeferStreamDirectiveOnValidOperationsRule.mjs";
import { ExecutableDefinitionsRule } from "./rules/ExecutableDefinitionsRule.mjs";
import { FieldsOnCorrectTypeRule } from "./rules/FieldsOnCorrectTypeRule.mjs";
import { FragmentsOnCompositeTypesRule } from "./rules/FragmentsOnCompositeTypesRule.mjs";
import { KnownArgumentNamesOnDirectivesRule, KnownArgumentNamesRule, } from "./rules/KnownArgumentNamesRule.mjs";
import { KnownDirectivesRule } from "./rules/KnownDirectivesRule.mjs";
import { KnownFragmentNamesRule } from "./rules/KnownFragmentNamesRule.mjs";
import { KnownOperationTypesRule } from "./rules/KnownOperationTypesRule.mjs";
import { KnownTypeNamesRule } from "./rules/KnownTypeNamesRule.mjs";
import { LoneAnonymousOperationRule } from "./rules/LoneAnonymousOperationRule.mjs";
import { LoneSchemaDefinitionRule } from "./rules/LoneSchemaDefinitionRule.mjs";
import { MaxIntrospectionDepthRule } from "./rules/MaxIntrospectionDepthRule.mjs";
import { NoFragmentCyclesRule } from "./rules/NoFragmentCyclesRule.mjs";
import { NoUndefinedVariablesRule } from "./rules/NoUndefinedVariablesRule.mjs";
import { NoUnusedFragmentsRule } from "./rules/NoUnusedFragmentsRule.mjs";
import { NoUnusedVariablesRule } from "./rules/NoUnusedVariablesRule.mjs";
import { OverlappingFieldsCanBeMergedRule } from "./rules/OverlappingFieldsCanBeMergedRule.mjs";
import { PossibleFragmentSpreadsRule } from "./rules/PossibleFragmentSpreadsRule.mjs";
import { PossibleTypeExtensionsRule } from "./rules/PossibleTypeExtensionsRule.mjs";
import { ProvidedRequiredArgumentsOnDirectivesRule, ProvidedRequiredArgumentsRule, } from "./rules/ProvidedRequiredArgumentsRule.mjs";
import { ScalarLeafsRule } from "./rules/ScalarLeafsRule.mjs";
import { SingleFieldSubscriptionsRule } from "./rules/SingleFieldSubscriptionsRule.mjs";
import { StreamDirectiveOnListFieldRule } from "./rules/StreamDirectiveOnListFieldRule.mjs";
import { UniqueArgumentDefinitionNamesRule } from "./rules/UniqueArgumentDefinitionNamesRule.mjs";
import { UniqueArgumentNamesRule } from "./rules/UniqueArgumentNamesRule.mjs";
import { UniqueDirectiveNamesRule } from "./rules/UniqueDirectiveNamesRule.mjs";
import { UniqueDirectivesPerLocationRule } from "./rules/UniqueDirectivesPerLocationRule.mjs";
import { UniqueEnumValueNamesRule } from "./rules/UniqueEnumValueNamesRule.mjs";
import { UniqueFieldDefinitionNamesRule } from "./rules/UniqueFieldDefinitionNamesRule.mjs";
import { UniqueFragmentNamesRule } from "./rules/UniqueFragmentNamesRule.mjs";
import { UniqueInputFieldNamesRule } from "./rules/UniqueInputFieldNamesRule.mjs";
import { UniqueOperationNamesRule } from "./rules/UniqueOperationNamesRule.mjs";
import { UniqueOperationTypesRule } from "./rules/UniqueOperationTypesRule.mjs";
import { UniqueTypeNamesRule } from "./rules/UniqueTypeNamesRule.mjs";
import { UniqueVariableNamesRule } from "./rules/UniqueVariableNamesRule.mjs";
import { ValuesOfCorrectTypeRule } from "./rules/ValuesOfCorrectTypeRule.mjs";
import { VariablesAreInputTypesRule } from "./rules/VariablesAreInputTypesRule.mjs";
import { VariablesInAllowedPositionRule } from "./rules/VariablesInAllowedPositionRule.mjs";
export const recommendedRules = Object.freeze([
    MaxIntrospectionDepthRule,
]);
export const specifiedRules = Object.freeze([
    ExecutableDefinitionsRule,
    KnownOperationTypesRule,
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
    DeferStreamDirectiveOnRootFieldRule,
    DeferStreamDirectiveOnValidOperationsRule,
    DeferStreamDirectiveLabelRule,
    StreamDirectiveOnListFieldRule,
    KnownArgumentNamesRule,
    UniqueArgumentNamesRule,
    ValuesOfCorrectTypeRule,
    ProvidedRequiredArgumentsRule,
    VariablesInAllowedPositionRule,
    OverlappingFieldsCanBeMergedRule,
    UniqueInputFieldNamesRule,
    ...recommendedRules,
]);
export const specifiedSDLRules = Object.freeze([
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
//# sourceMappingURL=specifiedRules.mjs.map