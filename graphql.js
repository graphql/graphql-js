"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphql = graphql;
exports.graphqlSync = graphqlSync;
const isPromise_ts_1 = require("./jsutils/isPromise.js");
const ensureGraphQLError_ts_1 = require("./error/ensureGraphQLError.js");
const validate_ts_1 = require("./type/validate.js");
const harness_ts_1 = require("./harness.js");
function graphql(args) {
    return new Promise((resolve) => resolve(graphqlImpl(args)));
}
function graphqlSync(args) {
    const result = graphqlImpl(args);
    if ((0, isPromise_ts_1.isPromiseLike)(result)) {
        throw new Error('GraphQL execution failed to complete synchronously.');
    }
    return result;
}
function graphqlImpl(args) {
    const harness = args.harness ?? harness_ts_1.defaultHarness;
    const { schema, source } = args;
    const schemaValidationErrors = (0, validate_ts_1.validateSchema)(schema);
    if (schemaValidationErrors.length > 0) {
        return { errors: schemaValidationErrors };
    }
    let document;
    try {
        document = harness.parse(source, args);
    }
    catch (syntaxError) {
        return { errors: [(0, ensureGraphQLError_ts_1.ensureGraphQLError)(syntaxError)] };
    }
    if ((0, isPromise_ts_1.isPromiseLike)(document)) {
        return document.then((resolvedDocument) => validateAndExecute(harness, args, schema, resolvedDocument), (syntaxError) => ({ errors: [(0, ensureGraphQLError_ts_1.ensureGraphQLError)(syntaxError)] }));
    }
    return validateAndExecute(harness, args, schema, document);
}
function validateAndExecute(harness, args, schema, document) {
    const validationResult = harness.validate(schema, document, args.rules, args);
    if ((0, isPromise_ts_1.isPromiseLike)(validationResult)) {
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
//# sourceMappingURL=graphql.js.map