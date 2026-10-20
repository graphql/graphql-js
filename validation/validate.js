"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
exports.validateSDL = validateSDL;
exports.assertValidSDL = assertValidSDL;
exports.assertValidSDLExtension = assertValidSDLExtension;
const mapValue_ts_1 = require("../jsutils/mapValue.js");
const GraphQLError_ts_1 = require("../error/GraphQLError.js");
const ast_ts_1 = require("../language/ast.js");
const visitor_ts_1 = require("../language/visitor.js");
const validate_ts_1 = require("../type/validate.js");
const TypeInfo_ts_1 = require("../utilities/TypeInfo.js");
const diagnostics_ts_1 = require("../diagnostics.js");
const specifiedRules_ts_1 = require("./specifiedRules.js");
const validationAbortedError_ts_1 = require("./validationAbortedError.js");
const ValidationContext_ts_1 = require("./ValidationContext.js");
const QueryDocumentKeysToValidate = (0, mapValue_ts_1.mapValue)(ast_ts_1.QueryDocumentKeys, (keys) => keys.filter((key) => key !== 'description'));
const tooManyValidationErrorsError = new GraphQLError_ts_1.GraphQLError('Too many validation errors, error limit reached. Validation aborted.');
function validate(schema, documentAST, rules = specifiedRules_ts_1.specifiedRules, options) {
    return (0, diagnostics_ts_1.shouldTrace)(diagnostics_ts_1.validateChannel)
        ? diagnostics_ts_1.validateChannel.traceSync(() => validateImpl(schema, documentAST, rules, options), { schema, document: documentAST })
        : validateImpl(schema, documentAST, rules, options);
}
function validateImpl(schema, documentAST, rules, options) {
    const maxErrors = options?.maxErrors ?? 100;
    const hideSuggestions = options?.hideSuggestions ?? false;
    const allowEmptySelectionSets = options?.allowEmptySelectionSets ?? true;
    (0, validate_ts_1.assertValidSchema)(schema);
    const errors = [];
    const typeInfo = new TypeInfo_ts_1.TypeInfo(schema);
    const context = new ValidationContext_ts_1.ValidationContext(schema, documentAST, typeInfo, (error) => {
        if (errors.length >= maxErrors) {
            throw tooManyValidationErrorsError;
        }
        errors.push(error);
    }, { hideSuggestions, allowEmptySelectionSets });
    const visitor = (0, visitor_ts_1.visitInParallel)(rules.map((rule) => rule(context)));
    try {
        (0, visitor_ts_1.visit)(documentAST, (0, TypeInfo_ts_1.visitWithTypeInfo)(typeInfo, visitor), QueryDocumentKeysToValidate);
    }
    catch (e) {
        if (e === tooManyValidationErrorsError || e === validationAbortedError_ts_1.validationAbortedError) {
            errors.push(e);
        }
        else {
            throw e;
        }
    }
    return errors;
}
function validateSDL(documentAST, schemaToExtend, rules = specifiedRules_ts_1.specifiedSDLRules) {
    const errors = [];
    const context = new ValidationContext_ts_1.SDLValidationContext(documentAST, schemaToExtend, (error) => {
        errors.push(error);
    });
    const visitors = rules.map((rule) => rule(context));
    (0, visitor_ts_1.visit)(documentAST, (0, visitor_ts_1.visitInParallel)(visitors));
    return errors;
}
function assertValidSDL(documentAST) {
    const errors = validateSDL(documentAST);
    if (errors.length !== 0) {
        throw new Error(errors.map((error) => error.message).join('\n\n'));
    }
}
function assertValidSDLExtension(documentAST, schema) {
    const errors = validateSDL(documentAST, schema);
    if (errors.length !== 0) {
        throw new Error(errors.map((error) => error.message).join('\n\n'));
    }
}
//# sourceMappingURL=validate.js.map