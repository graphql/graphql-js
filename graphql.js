import { devAssert } from './jsutils/devAssert.js';
import { isPromise } from './jsutils/isPromise.js';
import { parse } from './language/parser.js';
import { validateSchema } from './type/validate.js';
import { validate } from './validation/validate.js';
import { execute } from './execution/execute.js';
export function graphql(args) {
  // Always return a Promise for a consistent API.
  return new Promise((resolve) => resolve(graphqlImpl(args)));
}
/**
 * The graphqlSync function also fulfills GraphQL operations by parsing,
 * validating, and executing a GraphQL document along side a GraphQL schema.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
export function graphqlSync(args) {
  const result = graphqlImpl(args);
  // Assert that the execution was synchronous.
  if (isPromise(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }
  return result;
}
function graphqlImpl(args) {
  // Temporary for v15 to v16 migration. Remove in v17
  arguments.length < 2 ||
    devAssert(
      false,
      'graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead.',
    );
  const {
    schema,
    source,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  } = args;
  // Validate Schema
  const schemaValidationErrors = validateSchema(schema);
  if (schemaValidationErrors.length > 0) {
    return { errors: schemaValidationErrors };
  }
  // Parse
  let document;
  try {
    document = parse(source);
  } catch (syntaxError) {
    return { errors: [syntaxError] };
  }
  // Validate
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    return { errors: validationErrors };
  }
  // Execute
  return execute({
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  });
}
