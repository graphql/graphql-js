/**
 * An exported enum describing the different kinds of tokens that the
 * lexer emits.
 */
 export const Optionality = Object.freeze({
    DEFAULT: 'DEFAULT',
    REQUIRED: 'REQUIRED',
    OPTIONAL: 'OPTIONAL',
  });
  
  /**
   * The enum type representing the token kinds values.
   */
  export type OptionalityEnum = $Values<typeof Optionality>;