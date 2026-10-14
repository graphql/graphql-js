import { mapValue } from "../jsutils/mapValue.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import { QueryDocumentKeys } from "../language/ast.mjs";
import { visit, visitInParallel } from "../language/visitor.mjs";
import { assertValidSchema } from "../type/validate.mjs";
import { TypeInfo, visitWithTypeInfo } from "../utilities/TypeInfo.mjs";
import { shouldTrace, validateChannel } from "../diagnostics.mjs";
import { specifiedRules, specifiedSDLRules } from "./specifiedRules.mjs";
import { SDLValidationContext, ValidationContext, } from "./ValidationContext.mjs";
const QueryDocumentKeysToValidate = mapValue(QueryDocumentKeys, (keys) => keys.filter((key) => key !== 'description'));
const tooManyValidationErrorsError = new GraphQLError('Too many validation errors, error limit reached. Validation aborted.');
export function validate(schema, documentAST, rules = specifiedRules, options) {
    return shouldTrace(validateChannel)
        ? validateChannel.traceSync(() => validateImpl(schema, documentAST, rules, options), { schema, document: documentAST })
        : validateImpl(schema, documentAST, rules, options);
}
function validateImpl(schema, documentAST, rules, options) {
    const maxErrors = options?.maxErrors ?? 100;
    const hideSuggestions = options?.hideSuggestions ?? false;
    const allowEmptySelectionSets = options?.allowEmptySelectionSets ?? true;
    assertValidSchema(schema);
    const errors = [];
    const typeInfo = new TypeInfo(schema);
    const context = new ValidationContext(schema, documentAST, typeInfo, (error) => {
        if (errors.length >= maxErrors) {
            throw tooManyValidationErrorsError;
        }
        errors.push(error);
    }, { hideSuggestions, allowEmptySelectionSets });
    const visitor = visitInParallel(rules.map((rule) => rule(context)));
    try {
        visit(documentAST, visitWithTypeInfo(typeInfo, visitor), QueryDocumentKeysToValidate);
    }
    catch (e) {
        if (e === tooManyValidationErrorsError) {
            errors.push(tooManyValidationErrorsError);
        }
        else {
            throw e;
        }
    }
    return errors;
}
export function validateSDL(documentAST, schemaToExtend, rules = specifiedSDLRules) {
    const errors = [];
    const context = new SDLValidationContext(documentAST, schemaToExtend, (error) => {
        errors.push(error);
    });
    const visitors = rules.map((rule) => rule(context));
    visit(documentAST, visitInParallel(visitors));
    return errors;
}
export function assertValidSDL(documentAST) {
    const errors = validateSDL(documentAST);
    if (errors.length !== 0) {
        throw new Error(errors.map((error) => error.message).join('\n\n'));
    }
}
export function assertValidSDLExtension(documentAST, schema) {
    const errors = validateSDL(documentAST, schema);
    if (errors.length !== 0) {
        throw new Error(errors.map((error) => error.message).join('\n\n'));
    }
}
//# sourceMappingURL=validate.js.map