/** @category Validation Context */

import type { Maybe } from '../../jsutils/Maybe.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';

import type { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DocumentNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  OperationDefinitionNode,
  SelectionSetNode,
  VariableDefinitionNode,
  VariableNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import { visit } from '../../language/visitor.ts';

import type { DocumentIndex } from '../DocumentIndex.ts';
import { IndexCursor, visitWithIndexCursor } from '../IndexCursor.ts';
import type {
  InputTypeReference,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * AST validation rule factory used by {@link validateWithRules}.
 * @category Validation
 */
export type ASTVisitorFn = (context: ASTValidationContext) => ASTVisitor;

type NodeWithSelectionSet = OperationDefinitionNode | FragmentDefinitionNode;

interface VariableUsage {
  readonly node: VariableNode;
  readonly type: Maybe<InputTypeReference>;
  readonly parentType: Maybe<InputTypeReference>;
  readonly defaultValue: unknown;
  readonly fragmentVariableDefinition: Maybe<VariableDefinitionNode>;
}

/** @internal */
export interface ASTValidationContextOptions {
  readonly hideSuggestions?: Maybe<boolean>;
}

/** @internal */
export class ASTValidationContext {
  readonly document: DocumentNode;
  readonly documentIndex: DocumentIndex;
  readonly index: TypeSystemValidationIndex;
  readonly indexCursor: IndexCursor;
  readonly hideSuggestions: boolean;

  private _onError: (error: GraphQLError) => void;
  private _fragments: ObjMap<FragmentDefinitionNode> | undefined;
  private _fragmentSpreads:
    | Map<SelectionSetNode, Array<FragmentSpreadNode>>
    | undefined;
  private _recursivelyReferencedFragments:
    | Map<OperationDefinitionNode, Array<FragmentDefinitionNode>>
    | undefined;
  private _variableUsages:
    | Map<NodeWithSelectionSet, ReadonlyArray<VariableUsage>>
    | undefined;
  private _recursiveVariableUsages:
    | Map<OperationDefinitionNode, ReadonlyArray<VariableUsage>>
    | undefined;

  constructor(
    ast: DocumentNode,
    indexCursor: IndexCursor,
    onError: (error: GraphQLError) => void,
    options: ASTValidationContextOptions,
  ) {
    this.document = ast;
    this.indexCursor = indexCursor;
    this.index = indexCursor.index;
    this.documentIndex = this.index.documentIndex;
    this._onError = onError;
    this.hideSuggestions = options.hideSuggestions === true;
  }

  get [Symbol.toStringTag](): string {
    return 'ASTValidationContext';
  }

  reportError(error: GraphQLError): void {
    this._onError(error);
  }

  getFragment(name: string): Maybe<FragmentDefinitionNode> {
    let fragments: ObjMap<FragmentDefinitionNode>;
    if (this._fragments !== undefined) {
      fragments = this._fragments;
    } else {
      fragments = Object.create(null);
      for (const defNode of this.document.definitions) {
        if (defNode.kind === Kind.FRAGMENT_DEFINITION) {
          fragments[defNode.name.value] = defNode;
        }
      }
      this._fragments = fragments;
    }
    return fragments[name];
  }

  getFragmentSpreads(
    node: SelectionSetNode,
  ): ReadonlyArray<FragmentSpreadNode> {
    let fragmentSpreads = this._fragmentSpreads;
    if (fragmentSpreads === undefined) {
      fragmentSpreads = new Map();
      this._fragmentSpreads = fragmentSpreads;
    }

    let spreads = fragmentSpreads.get(node);
    if (spreads === undefined) {
      spreads = [];
      const setsToVisit: Array<SelectionSetNode> = [node];
      let set: SelectionSetNode | undefined;
      while ((set = setsToVisit.pop()) !== undefined) {
        for (const selection of set.selections) {
          if (selection.kind === Kind.FRAGMENT_SPREAD) {
            spreads.push(selection);
          } else if (selection.selectionSet !== undefined) {
            setsToVisit.push(selection.selectionSet);
          }
        }
      }
      fragmentSpreads.set(node, spreads);
    }
    return spreads;
  }

  getRecursivelyReferencedFragments(
    operation: OperationDefinitionNode,
  ): ReadonlyArray<FragmentDefinitionNode> {
    let recursivelyReferencedFragments = this._recursivelyReferencedFragments;
    if (recursivelyReferencedFragments === undefined) {
      recursivelyReferencedFragments = new Map();
      this._recursivelyReferencedFragments = recursivelyReferencedFragments;
    }

    let fragments = recursivelyReferencedFragments.get(operation);
    if (fragments === undefined) {
      fragments = [];
      const collectedNames = new Set<string>();
      const nodesToVisit: Array<SelectionSetNode> = [operation.selectionSet];
      let node: SelectionSetNode | undefined;
      while ((node = nodesToVisit.pop()) !== undefined) {
        for (const spread of this.getFragmentSpreads(node)) {
          const fragName = spread.name.value;
          if (!collectedNames.has(fragName)) {
            collectedNames.add(fragName);
            const fragment = this.getFragment(fragName);
            if (fragment != null) {
              fragments.push(fragment);
              nodesToVisit.push(fragment.selectionSet);
            }
          }
        }
      }
      recursivelyReferencedFragments.set(operation, fragments);
    }
    return fragments;
  }

  getVariableUsages(node: NodeWithSelectionSet): ReadonlyArray<VariableUsage> {
    let variableUsages = this._variableUsages;
    if (variableUsages === undefined) {
      variableUsages = new Map();
      this._variableUsages = variableUsages;
    }

    let usages = variableUsages.get(node);
    if (usages === undefined) {
      const newUsages: Array<VariableUsage> = [];
      const indexCursor = new IndexCursor(this.index);
      const getFragmentSignatureByName =
        this.documentIndex.getFragmentSignatureByName();
      const fragmentDefinition =
        node.kind === Kind.FRAGMENT_DEFINITION ? node : undefined;
      const visitor: ASTVisitor = {
        VariableDefinition: () => false,
        Variable: (variable) => {
          let fragmentVariableDefinition;
          if (fragmentDefinition !== undefined) {
            const fragmentSignature = getFragmentSignatureByName(
              fragmentDefinition.name.value,
            );

            fragmentVariableDefinition =
              fragmentSignature?.variableDefinitions.get(variable.name.value);
            newUsages.push({
              node: variable,
              type: indexCursor.getCurrentInputType(),
              parentType: indexCursor.getCurrentParentInputType(),
              defaultValue: undefined,
              fragmentVariableDefinition,
            });
          } else {
            newUsages.push({
              node: variable,
              type: indexCursor.getCurrentInputType(),
              parentType: indexCursor.getCurrentParentInputType(),
              defaultValue: indexCursor.getCurrentDefaultValue(),
              fragmentVariableDefinition: undefined,
            });
          }
        },
      };

      visit(node, visitWithIndexCursor(indexCursor, visitor));
      usages = newUsages;
      variableUsages.set(node, usages);
    }
    return usages;
  }

  getRecursiveVariableUsages(
    operation: OperationDefinitionNode,
  ): ReadonlyArray<VariableUsage> {
    let recursiveVariableUsages = this._recursiveVariableUsages;
    if (recursiveVariableUsages === undefined) {
      recursiveVariableUsages = new Map();
      this._recursiveVariableUsages = recursiveVariableUsages;
    }

    let usages = recursiveVariableUsages.get(operation);
    if (usages === undefined) {
      usages = this.getVariableUsages(operation);
      for (const frag of this.getRecursivelyReferencedFragments(operation)) {
        usages = usages.concat(this.getVariableUsages(frag));
      }
      recursiveVariableUsages.set(operation, usages);
    }
    return usages;
  }
}
