'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.assertValidSDLExtension =
  exports.assertValidSDL =
  exports.validateSDL =
  exports.validate =
    void 0;
const GraphQLError_js_1 = require('../error/GraphQLError.js');
const visitor_js_1 = require('../language/visitor.js');
const validate_js_1 = require('../type/validate.js');
const TypeInfo_js_1 = require('../utilities/TypeInfo.js');
const specifiedRules_js_1 = require('./specifiedRules.js');
const ValidationContext_js_1 = require('./ValidationContext.js');
/**
 * Implements the "Validation" section of the spec.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the document is valid.
 *
 * A list of specific validation rules may be provided. If not provided, the
 * default list of rules defined by the GraphQL specification will be used.
 *
 * Each validation rules is a function which returns a visitor
 * (see the language/visitor API). Visitor methods are expected to return
 * GraphQLErrors, or Arrays of GraphQLErrors when invalid.
 *
 * Validate will stop validation after a `maxErrors` limit has been reached.
 * Attackers can send pathologically invalid queries to induce a DoS attack,
 * so by default `maxErrors` set to 100 errors.
 *
 * Optionally a custom TypeInfo instance may be provided. If not provided, one
 * will be created from the provided schema.
 */
function validate(
  schema,
  documentAST,
  rules = specifiedRules_js_1.specifiedRules,
  options,
  /** @deprecated will be removed in 17.0.0 */
  typeInfo = new TypeInfo_js_1.TypeInfo(schema),
) {
  const maxErrors = options?.maxErrors ?? 100;
  // If the schema used for validation is invalid, throw an error.
  (0, validate_js_1.assertValidSchema)(schema);
  const abortError = new GraphQLError_js_1.GraphQLError(
    'Too many validation errors, error limit reached. Validation aborted.',
  );
  const errors = [];
  const context = new ValidationContext_js_1.ValidationContext(
    schema,
    documentAST,
    typeInfo,
    (error) => {
      if (errors.length >= maxErrors) {
        throw abortError;
      }
      errors.push(error);
    },
  );
  // This uses a specialized visitor which runs multiple visitors in parallel,
  // while maintaining the visitor skip and break API.
  const visitor = (0, visitor_js_1.visitInParallel)(
    rules.map((rule) => rule(context)),
  );
  // Visit the whole document with each instance of all provided rules.
  try {
    (0, visitor_js_1.visit)(
      documentAST,
      (0, TypeInfo_js_1.visitWithTypeInfo)(typeInfo, visitor),
    );
  } catch (e) {
    if (e === abortError) {
      errors.push(abortError);
    } else {
      throw e;
    }
  }
  return errors;
}
exports.validate = validate;
/**
 * @internal
 */
function validateSDL(
  documentAST,
  schemaToExtend,
  rules = specifiedRules_js_1.specifiedSDLRules,
) {
  const errors = [];
  const context = new ValidationContext_js_1.SDLValidationContext(
    documentAST,
    schemaToExtend,
    (error) => {
      errors.push(error);
    },
  );
  const visitors = rules.map((rule) => rule(context));
  (0, visitor_js_1.visit)(
    documentAST,
    (0, visitor_js_1.visitInParallel)(visitors),
  );
  return errors;
}
exports.validateSDL = validateSDL;
/**
 * Utility function which asserts a SDL document is valid by throwing an error
 * if it is invalid.
 *
 * @internal
 */
function assertValidSDL(documentAST) {
  const errors = validateSDL(documentAST);
  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }
}
exports.assertValidSDL = assertValidSDL;
/**
 * Utility function which asserts a SDL document is valid by throwing an error
 * if it is invalid.
 *
 * @internal
 */
function assertValidSDLExtension(documentAST, schema) {
  const errors = validateSDL(documentAST, schema);
  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }
}
exports.assertValidSDLExtension = assertValidSDLExtension;
