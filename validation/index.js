'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.NoSchemaIntrospectionCustomRule =
  exports.NoDeprecatedCustomRule =
  exports.PossibleTypeExtensionsRule =
  exports.UniqueDirectiveNamesRule =
  exports.UniqueArgumentDefinitionNamesRule =
  exports.UniqueFieldDefinitionNamesRule =
  exports.UniqueEnumValueNamesRule =
  exports.UniqueTypeNamesRule =
  exports.UniqueOperationTypesRule =
  exports.LoneSchemaDefinitionRule =
  exports.VariablesInAllowedPositionRule =
  exports.VariablesAreInputTypesRule =
  exports.ValuesOfCorrectTypeRule =
  exports.UniqueVariableNamesRule =
  exports.UniqueOperationNamesRule =
  exports.UniqueInputFieldNamesRule =
  exports.UniqueFragmentNamesRule =
  exports.UniqueDirectivesPerLocationRule =
  exports.UniqueArgumentNamesRule =
  exports.StreamDirectiveOnListFieldRule =
  exports.SingleFieldSubscriptionsRule =
  exports.ScalarLeafsRule =
  exports.ProvidedRequiredArgumentsRule =
  exports.PossibleFragmentSpreadsRule =
  exports.OverlappingFieldsCanBeMergedRule =
  exports.NoUnusedVariablesRule =
  exports.NoUnusedFragmentsRule =
  exports.NoUndefinedVariablesRule =
  exports.NoFragmentCyclesRule =
  exports.LoneAnonymousOperationRule =
  exports.KnownTypeNamesRule =
  exports.KnownFragmentNamesRule =
  exports.KnownDirectivesRule =
  exports.KnownArgumentNamesRule =
  exports.FragmentsOnCompositeTypesRule =
  exports.FieldsOnCorrectTypeRule =
  exports.ExecutableDefinitionsRule =
  exports.DeferStreamDirectiveOnValidOperationsRule =
  exports.DeferStreamDirectiveOnRootFieldRule =
  exports.DeferStreamDirectiveLabelRule =
  exports.specifiedRules =
  exports.ValidationContext =
  exports.validate =
    void 0;
var validate_js_1 = require('./validate.js');
Object.defineProperty(exports, 'validate', {
  enumerable: true,
  get: function () {
    return validate_js_1.validate;
  },
});
var ValidationContext_js_1 = require('./ValidationContext.js');
Object.defineProperty(exports, 'ValidationContext', {
  enumerable: true,
  get: function () {
    return ValidationContext_js_1.ValidationContext;
  },
});
// All validation rules in the GraphQL Specification.
var specifiedRules_js_1 = require('./specifiedRules.js');
Object.defineProperty(exports, 'specifiedRules', {
  enumerable: true,
  get: function () {
    return specifiedRules_js_1.specifiedRules;
  },
});
// Spec Section: "Defer And Stream Directive Labels Are Unique"
var DeferStreamDirectiveLabelRule_js_1 = require('./rules/DeferStreamDirectiveLabelRule.js');
Object.defineProperty(exports, 'DeferStreamDirectiveLabelRule', {
  enumerable: true,
  get: function () {
    return DeferStreamDirectiveLabelRule_js_1.DeferStreamDirectiveLabelRule;
  },
});
// Spec Section: "Defer And Stream Directives Are Used On Valid Root Field"
var DeferStreamDirectiveOnRootFieldRule_js_1 = require('./rules/DeferStreamDirectiveOnRootFieldRule.js');
Object.defineProperty(exports, 'DeferStreamDirectiveOnRootFieldRule', {
  enumerable: true,
  get: function () {
    return DeferStreamDirectiveOnRootFieldRule_js_1.DeferStreamDirectiveOnRootFieldRule;
  },
});
// Spec Section: "Defer And Stream Directives Are Used On Valid Operations"
var DeferStreamDirectiveOnValidOperationsRule_js_1 = require('./rules/DeferStreamDirectiveOnValidOperationsRule.js');
Object.defineProperty(exports, 'DeferStreamDirectiveOnValidOperationsRule', {
  enumerable: true,
  get: function () {
    return DeferStreamDirectiveOnValidOperationsRule_js_1.DeferStreamDirectiveOnValidOperationsRule;
  },
});
// Spec Section: "Executable Definitions"
var ExecutableDefinitionsRule_js_1 = require('./rules/ExecutableDefinitionsRule.js');
Object.defineProperty(exports, 'ExecutableDefinitionsRule', {
  enumerable: true,
  get: function () {
    return ExecutableDefinitionsRule_js_1.ExecutableDefinitionsRule;
  },
});
// Spec Section: "Field Selections on Objects, Interfaces, and Unions Types"
var FieldsOnCorrectTypeRule_js_1 = require('./rules/FieldsOnCorrectTypeRule.js');
Object.defineProperty(exports, 'FieldsOnCorrectTypeRule', {
  enumerable: true,
  get: function () {
    return FieldsOnCorrectTypeRule_js_1.FieldsOnCorrectTypeRule;
  },
});
// Spec Section: "Fragments on Composite Types"
var FragmentsOnCompositeTypesRule_js_1 = require('./rules/FragmentsOnCompositeTypesRule.js');
Object.defineProperty(exports, 'FragmentsOnCompositeTypesRule', {
  enumerable: true,
  get: function () {
    return FragmentsOnCompositeTypesRule_js_1.FragmentsOnCompositeTypesRule;
  },
});
// Spec Section: "Argument Names"
var KnownArgumentNamesRule_js_1 = require('./rules/KnownArgumentNamesRule.js');
Object.defineProperty(exports, 'KnownArgumentNamesRule', {
  enumerable: true,
  get: function () {
    return KnownArgumentNamesRule_js_1.KnownArgumentNamesRule;
  },
});
// Spec Section: "Directives Are Defined"
var KnownDirectivesRule_js_1 = require('./rules/KnownDirectivesRule.js');
Object.defineProperty(exports, 'KnownDirectivesRule', {
  enumerable: true,
  get: function () {
    return KnownDirectivesRule_js_1.KnownDirectivesRule;
  },
});
// Spec Section: "Fragment spread target defined"
var KnownFragmentNamesRule_js_1 = require('./rules/KnownFragmentNamesRule.js');
Object.defineProperty(exports, 'KnownFragmentNamesRule', {
  enumerable: true,
  get: function () {
    return KnownFragmentNamesRule_js_1.KnownFragmentNamesRule;
  },
});
// Spec Section: "Fragment Spread Type Existence"
var KnownTypeNamesRule_js_1 = require('./rules/KnownTypeNamesRule.js');
Object.defineProperty(exports, 'KnownTypeNamesRule', {
  enumerable: true,
  get: function () {
    return KnownTypeNamesRule_js_1.KnownTypeNamesRule;
  },
});
// Spec Section: "Lone Anonymous Operation"
var LoneAnonymousOperationRule_js_1 = require('./rules/LoneAnonymousOperationRule.js');
Object.defineProperty(exports, 'LoneAnonymousOperationRule', {
  enumerable: true,
  get: function () {
    return LoneAnonymousOperationRule_js_1.LoneAnonymousOperationRule;
  },
});
// Spec Section: "Fragments must not form cycles"
var NoFragmentCyclesRule_js_1 = require('./rules/NoFragmentCyclesRule.js');
Object.defineProperty(exports, 'NoFragmentCyclesRule', {
  enumerable: true,
  get: function () {
    return NoFragmentCyclesRule_js_1.NoFragmentCyclesRule;
  },
});
// Spec Section: "All Variable Used Defined"
var NoUndefinedVariablesRule_js_1 = require('./rules/NoUndefinedVariablesRule.js');
Object.defineProperty(exports, 'NoUndefinedVariablesRule', {
  enumerable: true,
  get: function () {
    return NoUndefinedVariablesRule_js_1.NoUndefinedVariablesRule;
  },
});
// Spec Section: "Fragments must be used"
var NoUnusedFragmentsRule_js_1 = require('./rules/NoUnusedFragmentsRule.js');
Object.defineProperty(exports, 'NoUnusedFragmentsRule', {
  enumerable: true,
  get: function () {
    return NoUnusedFragmentsRule_js_1.NoUnusedFragmentsRule;
  },
});
// Spec Section: "All Variables Used"
var NoUnusedVariablesRule_js_1 = require('./rules/NoUnusedVariablesRule.js');
Object.defineProperty(exports, 'NoUnusedVariablesRule', {
  enumerable: true,
  get: function () {
    return NoUnusedVariablesRule_js_1.NoUnusedVariablesRule;
  },
});
// Spec Section: "Field Selection Merging"
var OverlappingFieldsCanBeMergedRule_js_1 = require('./rules/OverlappingFieldsCanBeMergedRule.js');
Object.defineProperty(exports, 'OverlappingFieldsCanBeMergedRule', {
  enumerable: true,
  get: function () {
    return OverlappingFieldsCanBeMergedRule_js_1.OverlappingFieldsCanBeMergedRule;
  },
});
// Spec Section: "Fragment spread is possible"
var PossibleFragmentSpreadsRule_js_1 = require('./rules/PossibleFragmentSpreadsRule.js');
Object.defineProperty(exports, 'PossibleFragmentSpreadsRule', {
  enumerable: true,
  get: function () {
    return PossibleFragmentSpreadsRule_js_1.PossibleFragmentSpreadsRule;
  },
});
// Spec Section: "Argument Optionality"
var ProvidedRequiredArgumentsRule_js_1 = require('./rules/ProvidedRequiredArgumentsRule.js');
Object.defineProperty(exports, 'ProvidedRequiredArgumentsRule', {
  enumerable: true,
  get: function () {
    return ProvidedRequiredArgumentsRule_js_1.ProvidedRequiredArgumentsRule;
  },
});
// Spec Section: "Leaf Field Selections"
var ScalarLeafsRule_js_1 = require('./rules/ScalarLeafsRule.js');
Object.defineProperty(exports, 'ScalarLeafsRule', {
  enumerable: true,
  get: function () {
    return ScalarLeafsRule_js_1.ScalarLeafsRule;
  },
});
// Spec Section: "Subscriptions with Single Root Field"
var SingleFieldSubscriptionsRule_js_1 = require('./rules/SingleFieldSubscriptionsRule.js');
Object.defineProperty(exports, 'SingleFieldSubscriptionsRule', {
  enumerable: true,
  get: function () {
    return SingleFieldSubscriptionsRule_js_1.SingleFieldSubscriptionsRule;
  },
});
// Spec Section: "Stream Directives Are Used On List Fields"
var StreamDirectiveOnListFieldRule_js_1 = require('./rules/StreamDirectiveOnListFieldRule.js');
Object.defineProperty(exports, 'StreamDirectiveOnListFieldRule', {
  enumerable: true,
  get: function () {
    return StreamDirectiveOnListFieldRule_js_1.StreamDirectiveOnListFieldRule;
  },
});
// Spec Section: "Argument Uniqueness"
var UniqueArgumentNamesRule_js_1 = require('./rules/UniqueArgumentNamesRule.js');
Object.defineProperty(exports, 'UniqueArgumentNamesRule', {
  enumerable: true,
  get: function () {
    return UniqueArgumentNamesRule_js_1.UniqueArgumentNamesRule;
  },
});
// Spec Section: "Directives Are Unique Per Location"
var UniqueDirectivesPerLocationRule_js_1 = require('./rules/UniqueDirectivesPerLocationRule.js');
Object.defineProperty(exports, 'UniqueDirectivesPerLocationRule', {
  enumerable: true,
  get: function () {
    return UniqueDirectivesPerLocationRule_js_1.UniqueDirectivesPerLocationRule;
  },
});
// Spec Section: "Fragment Name Uniqueness"
var UniqueFragmentNamesRule_js_1 = require('./rules/UniqueFragmentNamesRule.js');
Object.defineProperty(exports, 'UniqueFragmentNamesRule', {
  enumerable: true,
  get: function () {
    return UniqueFragmentNamesRule_js_1.UniqueFragmentNamesRule;
  },
});
// Spec Section: "Input Object Field Uniqueness"
var UniqueInputFieldNamesRule_js_1 = require('./rules/UniqueInputFieldNamesRule.js');
Object.defineProperty(exports, 'UniqueInputFieldNamesRule', {
  enumerable: true,
  get: function () {
    return UniqueInputFieldNamesRule_js_1.UniqueInputFieldNamesRule;
  },
});
// Spec Section: "Operation Name Uniqueness"
var UniqueOperationNamesRule_js_1 = require('./rules/UniqueOperationNamesRule.js');
Object.defineProperty(exports, 'UniqueOperationNamesRule', {
  enumerable: true,
  get: function () {
    return UniqueOperationNamesRule_js_1.UniqueOperationNamesRule;
  },
});
// Spec Section: "Variable Uniqueness"
var UniqueVariableNamesRule_js_1 = require('./rules/UniqueVariableNamesRule.js');
Object.defineProperty(exports, 'UniqueVariableNamesRule', {
  enumerable: true,
  get: function () {
    return UniqueVariableNamesRule_js_1.UniqueVariableNamesRule;
  },
});
// Spec Section: "Values Type Correctness"
var ValuesOfCorrectTypeRule_js_1 = require('./rules/ValuesOfCorrectTypeRule.js');
Object.defineProperty(exports, 'ValuesOfCorrectTypeRule', {
  enumerable: true,
  get: function () {
    return ValuesOfCorrectTypeRule_js_1.ValuesOfCorrectTypeRule;
  },
});
// Spec Section: "Variables are Input Types"
var VariablesAreInputTypesRule_js_1 = require('./rules/VariablesAreInputTypesRule.js');
Object.defineProperty(exports, 'VariablesAreInputTypesRule', {
  enumerable: true,
  get: function () {
    return VariablesAreInputTypesRule_js_1.VariablesAreInputTypesRule;
  },
});
// Spec Section: "All Variable Usages Are Allowed"
var VariablesInAllowedPositionRule_js_1 = require('./rules/VariablesInAllowedPositionRule.js');
Object.defineProperty(exports, 'VariablesInAllowedPositionRule', {
  enumerable: true,
  get: function () {
    return VariablesInAllowedPositionRule_js_1.VariablesInAllowedPositionRule;
  },
});
// SDL-specific validation rules
var LoneSchemaDefinitionRule_js_1 = require('./rules/LoneSchemaDefinitionRule.js');
Object.defineProperty(exports, 'LoneSchemaDefinitionRule', {
  enumerable: true,
  get: function () {
    return LoneSchemaDefinitionRule_js_1.LoneSchemaDefinitionRule;
  },
});
var UniqueOperationTypesRule_js_1 = require('./rules/UniqueOperationTypesRule.js');
Object.defineProperty(exports, 'UniqueOperationTypesRule', {
  enumerable: true,
  get: function () {
    return UniqueOperationTypesRule_js_1.UniqueOperationTypesRule;
  },
});
var UniqueTypeNamesRule_js_1 = require('./rules/UniqueTypeNamesRule.js');
Object.defineProperty(exports, 'UniqueTypeNamesRule', {
  enumerable: true,
  get: function () {
    return UniqueTypeNamesRule_js_1.UniqueTypeNamesRule;
  },
});
var UniqueEnumValueNamesRule_js_1 = require('./rules/UniqueEnumValueNamesRule.js');
Object.defineProperty(exports, 'UniqueEnumValueNamesRule', {
  enumerable: true,
  get: function () {
    return UniqueEnumValueNamesRule_js_1.UniqueEnumValueNamesRule;
  },
});
var UniqueFieldDefinitionNamesRule_js_1 = require('./rules/UniqueFieldDefinitionNamesRule.js');
Object.defineProperty(exports, 'UniqueFieldDefinitionNamesRule', {
  enumerable: true,
  get: function () {
    return UniqueFieldDefinitionNamesRule_js_1.UniqueFieldDefinitionNamesRule;
  },
});
var UniqueArgumentDefinitionNamesRule_js_1 = require('./rules/UniqueArgumentDefinitionNamesRule.js');
Object.defineProperty(exports, 'UniqueArgumentDefinitionNamesRule', {
  enumerable: true,
  get: function () {
    return UniqueArgumentDefinitionNamesRule_js_1.UniqueArgumentDefinitionNamesRule;
  },
});
var UniqueDirectiveNamesRule_js_1 = require('./rules/UniqueDirectiveNamesRule.js');
Object.defineProperty(exports, 'UniqueDirectiveNamesRule', {
  enumerable: true,
  get: function () {
    return UniqueDirectiveNamesRule_js_1.UniqueDirectiveNamesRule;
  },
});
var PossibleTypeExtensionsRule_js_1 = require('./rules/PossibleTypeExtensionsRule.js');
Object.defineProperty(exports, 'PossibleTypeExtensionsRule', {
  enumerable: true,
  get: function () {
    return PossibleTypeExtensionsRule_js_1.PossibleTypeExtensionsRule;
  },
});
// Optional rules not defined by the GraphQL Specification
var NoDeprecatedCustomRule_js_1 = require('./rules/custom/NoDeprecatedCustomRule.js');
Object.defineProperty(exports, 'NoDeprecatedCustomRule', {
  enumerable: true,
  get: function () {
    return NoDeprecatedCustomRule_js_1.NoDeprecatedCustomRule;
  },
});
var NoSchemaIntrospectionCustomRule_js_1 = require('./rules/custom/NoSchemaIntrospectionCustomRule.js');
Object.defineProperty(exports, 'NoSchemaIntrospectionCustomRule', {
  enumerable: true,
  get: function () {
    return NoSchemaIntrospectionCustomRule_js_1.NoSchemaIntrospectionCustomRule;
  },
});
