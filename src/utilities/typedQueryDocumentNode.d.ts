import { DocumentNode, ExecutableDefinitionNode } from '../language/ast';

/**
 * Wrapper type that contains DocumentNode and types that can be deduced from it.
 */
export interface TypedQueryDocumentNode<
  TResponseData = Record<string, any>,
  TRequestVariables = Record<string, any>
> extends DocumentNode {
  readonly definitions: ReadonlyArray<ExecutableDefinitionNode>;
  // FIXME: remove once TS implements proper way to enforce nominal typing
  /**
   * This type is used to ensure that the variables you pass in to the query are assignable to Variables
   * and that the Result is assignable to whatever you pass your result to. The method is never actually
   * implemented, but the type is valid because we list it as optional
   */
  __ensureTypesOfVariablesAndResultMatching?: (
    variables: TRequestVariables,
  ) => TResponseData;
}
