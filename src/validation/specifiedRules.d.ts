import { ValidationRule, SDLValidationRule } from './ValidationContext';

/**
 * Technically these aren't part of the spec but they are strongly encouraged
 * validation rules.
 */
export const recommendedRules: ReadonlyArray<ValidationRule>;

/**
 * This set includes all validation rules defined by the GraphQL spec.
 *
 * The order of the rules in this list has been adjusted to lead to the
 * most clear output when encountering multiple validation errors.
 */
export const specifiedRules: ReadonlyArray<ValidationRule>;

/**
 * @internal
 */
export const specifiedSDLRules: ReadonlyArray<SDLValidationRule>;
