import { isPromiseLike } from "./jsutils/isPromise.mjs";
import { ensureGraphQLError } from "./error/ensureGraphQLError.mjs";
import { validateSchema } from "./type/validate.mjs";
import { defaultHarness } from "./harness.mjs";
export function graphql(args) {
    return new Promise((resolve) => resolve(graphqlImpl(args)));
}
export function graphqlSync(args) {
    const result = graphqlImpl(args);
    if (isPromiseLike(result)) {
        throw new Error('GraphQL execution failed to complete synchronously.');
    }
    return result;
}
function graphqlImpl(args) {
    const harness = args.harness ?? defaultHarness;
    const { schema, source } = args;
    const schemaValidationErrors = validateSchema(schema);
    if (schemaValidationErrors.length > 0) {
        return { errors: schemaValidationErrors };
    }
    let document;
    try {
        document = harness.parse(source, args);
    }
    catch (syntaxError) {
        return { errors: [ensureGraphQLError(syntaxError)] };
    }
    if (isPromiseLike(document)) {
        return document.then((resolvedDocument) => validateAndExecute(harness, args, schema, resolvedDocument), (syntaxError) => ({ errors: [ensureGraphQLError(syntaxError)] }));
    }
    return validateAndExecute(harness, args, schema, document);
}
function validateAndExecute(harness, args, schema, document) {
    const validationResult = harness.validate(schema, document, args.rules, args);
    if (isPromiseLike(validationResult)) {
        return validationResult.then((resolvedValidationResult) => checkValidationAndExecute(harness, args, resolvedValidationResult, document));
    }
    return checkValidationAndExecute(harness, args, validationResult, document);
}
function checkValidationAndExecute(harness, args, validationResult, document) {
    if (validationResult.length > 0) {
        return { errors: validationResult };
    }
    return harness.execute({ ...args, document });
}
//# sourceMappingURL=graphql.mjs.map