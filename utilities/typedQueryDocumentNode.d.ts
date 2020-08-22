import { DocumentNode, ExecutableDefinitionNode } from '../language/ast';

/**
 * Wrapper type that contains DocumentNode and types that can be deduced from it.
 */
interface TypedQueryDocumentNode<
  TResponseData = Record<string, any>,
  TRequestVariables = Record<string, any>
> extends DocumentNode {
  readonly definitions: ReadonlyArray<ExecutableDefinitionNode>;
  // FIXME: remove once TS implements proper way to enforce nominal typing
  readonly __enforceStructuralTypingOnResponseDataType?: TResponseData;
  readonly __enforceStructuralTypingOnRequestVariablesType?: TRequestVariables;
}
