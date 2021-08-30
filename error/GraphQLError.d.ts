import type { Maybe } from '../jsutils/Maybe';
import type { ASTNode } from '../language/ast';
import type { Source } from '../language/source';
import type { SourceLocation } from '../language/location';
/**
 * A GraphQLError describes an Error found during the parse, validate, or
 * execute phases of performing a GraphQL operation. In addition to a message
 * and stack trace, it also includes information about the locations in a
 * GraphQL document and/or execution result that correspond to the Error.
 */
export declare class GraphQLError extends Error {
  /**
   * An array of `{ line, column }` locations within the source GraphQL document
   * which correspond to this error.
   *
   * Errors during validation often contain multiple locations, for example to
   * point out two things with the same name. Errors during execution include a
   * single location, the field which produced the error.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  readonly locations?: ReadonlyArray<SourceLocation>;
  /**
   * An array describing the JSON-path into the execution response which
   * corresponds to this error. Only included for errors during execution.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  readonly path?: ReadonlyArray<string | number>;
  /**
   * An array of GraphQL AST Nodes corresponding to this error.
   */
  readonly nodes?: ReadonlyArray<ASTNode>;
  /**
   * The source GraphQL document for the first location of this error.
   *
   * Note that if this Error represents more than one node, the source may not
   * represent nodes after the first node.
   */
  readonly source?: Source;
  /**
   * An array of character offsets within the source GraphQL document
   * which correspond to this error.
   */
  readonly positions?: ReadonlyArray<number>;
  /**
   * The original error thrown from a field resolver during execution.
   */
  readonly originalError: Maybe<Error>;
  /**
   * Extension fields to add to the formatted error.
   */
  readonly extensions?: {
    [key: string]: unknown;
  };
  constructor(
    message: string,
    nodes?: ReadonlyArray<ASTNode> | ASTNode | null,
    source?: Maybe<Source>,
    positions?: Maybe<ReadonlyArray<number>>,
    path?: Maybe<ReadonlyArray<string | number>>,
    originalError?: Maybe<
      Error & {
        readonly extensions?: unknown;
      }
    >,
    extensions?: Maybe<{
      [key: string]: unknown;
    }>,
  );
  toString(): string;
  get [Symbol.toStringTag](): string;
}
/**
 * Prints a GraphQLError to a string, representing useful location information
 * about the error's position in the source.
 *
 * @deprecated Please use `error.toString` instead. Will be removed in v17
 */
export declare function printError(error: GraphQLError): string;
