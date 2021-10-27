import { Maybe } from '../jsutils/Maybe';

import { ASTNode } from '../language/ast';
import { Source } from '../language/source';
import { SourceLocation } from '../language/location';

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLErrorExtensions {
  [attributeName: string]: any;
}

/**
 * A GraphQLError describes an Error found during the parse, validate, or
 * execute phases of performing a GraphQL operation. In addition to a message
 * and stack trace, it also includes information about the locations in a
 * GraphQL document and/or execution result that correspond to the Error.
 */
export class GraphQLError extends Error {
  constructor(
    message: string,
    nodes?: Maybe<ReadonlyArray<ASTNode> | ASTNode>,
    source?: Maybe<Source>,
    positions?: Maybe<ReadonlyArray<number>>,
    path?: Maybe<ReadonlyArray<string | number>>,
    originalError?: Maybe<Error>,
    extensions?: Maybe<GraphQLErrorExtensions>,
  );

  /**
   * An array of { line, column } locations within the source GraphQL document
   * which correspond to this error.
   *
   * Errors during validation often contain multiple locations, for example to
   * point out two things with the same name. Errors during execution include a
   * single location, the field which produced the error.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  readonly locations: ReadonlyArray<SourceLocation> | undefined;

  /**
   * An array describing the JSON-path into the execution response which
   * corresponds to this error. Only included for errors during execution.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  readonly path: ReadonlyArray<string | number> | undefined;

  /**
   * An array of GraphQL AST Nodes corresponding to this error.
   */
  readonly nodes: ReadonlyArray<ASTNode> | undefined;

  /**
   * The source GraphQL document corresponding to this error.
   *
   * Note that if this Error represents more than one node, the source may not
   * represent nodes after the first node.
   */
  readonly source: Source | undefined;

  /**
   * An array of character offsets within the source GraphQL document
   * which correspond to this error.
   */
  readonly positions: ReadonlyArray<number> | undefined;

  /**
   * The original error thrown from a field resolver during execution.
   */
  readonly originalError: Error | undefined | null;

  /**
   * Extension fields to add to the formatted error.
   */
  readonly extensions: { [key: string]: any };
}

/**
 * Prints a GraphQLError to a string, representing useful location information
 * about the error's position in the source.
 */
export function printError(error: GraphQLError): string;
