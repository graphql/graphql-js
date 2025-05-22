import type { Maybe } from '../jsutils/Maybe.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type {
  DocumentNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  OperationDefinitionNode,
  SelectionSetNode,
  VariableDefinitionNode,
  VariableNode,
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';
import type { ASTVisitor } from '../language/visitor.js';
import { visit } from '../language/visitor.js';

import type {
  GraphQLArgument,
  GraphQLCompositeType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputType,
  GraphQLOutputType,
} from '../type/definition.js';
import type { GraphQLDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';

import type { FragmentSignature } from '../utilities/TypeInfo.js';
import { TypeInfo, visitWithTypeInfo } from '../utilities/TypeInfo.js';

type NodeWithSelectionSet = OperationDefinitionNode | FragmentDefinitionNode;
interface VariableUsage {
  readonly node: VariableNode;
  readonly type: Maybe<GraphQLInputType>;
  readonly parentType: Maybe<GraphQLInputType>;
  readonly defaultValue: unknown;
  readonly fragmentVariableDefinition: Maybe<VariableDefinitionNode>;
}

/**
 * An instance of this class is passed as the "this" context to all validators,
 * allowing access to commonly useful contextual information from within a
 * validation rule.
 */
export class ASTValidationContext {
  private _ast: DocumentNode;
  private _onError: (error: GraphQLError) => void;
  private _fragments: ObjMap<FragmentDefinitionNode> | undefined;
  private _fragmentSpreads: Map<SelectionSetNode, Array<FragmentSpreadNode>>;
  private _recursivelyReferencedFragments: Map<
    OperationDefinitionNode,
    Array<FragmentDefinitionNode>
  >;

  constructor(ast: DocumentNode, onError: (error: GraphQLError) => void) {
    this._ast = ast;
    this._fragments = undefined;
    this._fragmentSpreads = new Map();
    this._recursivelyReferencedFragments = new Map();
    this._onError = onError;
  }

  get [Symbol.toStringTag]() {
    return 'ASTValidationContext';
  }

  reportError(error: GraphQLError): void {
    this._onError(error);
  }

  getDocument(): DocumentNode {
    return this._ast;
  }

  getFragment(name: string): Maybe<FragmentDefinitionNode> {
    let fragments: ObjMap<FragmentDefinitionNode>;
    if (this._fragments) {
      fragments = this._fragments;
    } else {
      fragments = Object.create(null);
      for (const defNode of this.getDocument().definitions) {
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
    let spreads = this._fragmentSpreads.get(node);
    if (!spreads) {
      spreads = [];
      const setsToVisit: Array<SelectionSetNode> = [node];
      let set: SelectionSetNode | undefined;
      while ((set = setsToVisit.pop())) {
        for (const selection of set.selections) {
          if (selection.kind === Kind.FRAGMENT_SPREAD) {
            spreads.push(selection);
          } else if (selection.selectionSet) {
            setsToVisit.push(selection.selectionSet);
          }
        }
      }
      this._fragmentSpreads.set(node, spreads);
    }
    return spreads;
  }

  getRecursivelyReferencedFragments(
    operation: OperationDefinitionNode,
  ): ReadonlyArray<FragmentDefinitionNode> {
    let fragments = this._recursivelyReferencedFragments.get(operation);
    if (!fragments) {
      fragments = [];
      const collectedNames = new Set<string>();
      const nodesToVisit: Array<SelectionSetNode> = [operation.selectionSet];
      let node: SelectionSetNode | undefined;
      while ((node = nodesToVisit.pop())) {
        for (const spread of this.getFragmentSpreads(node)) {
          const fragName = spread.name.value;
          if (!collectedNames.has(fragName)) {
            collectedNames.add(fragName);
            const fragment = this.getFragment(fragName);
            if (fragment) {
              fragments.push(fragment);
              nodesToVisit.push(fragment.selectionSet);
            }
          }
        }
      }
      this._recursivelyReferencedFragments.set(operation, fragments);
    }
    return fragments;
  }
}

export type ASTValidationRule = (context: ASTValidationContext) => ASTVisitor;

export class SDLValidationContext extends ASTValidationContext {
  private _schema: Maybe<GraphQLSchema>;

  constructor(
    ast: DocumentNode,
    schema: Maybe<GraphQLSchema>,
    onError: (error: GraphQLError) => void,
  ) {
    super(ast, onError);
    this._schema = schema;
  }

  get hideSuggestions() {
    return false;
  }

  override get [Symbol.toStringTag]() {
    return 'SDLValidationContext';
  }

  getSchema(): Maybe<GraphQLSchema> {
    return this._schema;
  }
}

export type SDLValidationRule = (context: SDLValidationContext) => ASTVisitor;

export class ValidationContext extends ASTValidationContext {
  private _schema: GraphQLSchema;
  private _typeInfo: TypeInfo;
  private _variableUsages: Map<
    NodeWithSelectionSet,
    ReadonlyArray<VariableUsage>
  >;

  private _recursiveVariableUsages: Map<
    OperationDefinitionNode,
    ReadonlyArray<VariableUsage>
  >;
  private _hideSuggestions: boolean;

  constructor(
    schema: GraphQLSchema,
    ast: DocumentNode,
    typeInfo: TypeInfo,
    onError: (error: GraphQLError) => void,
    hideSuggestions?: Maybe<boolean>,
  ) {
    super(ast, onError);
    this._schema = schema;
    this._typeInfo = typeInfo;
    this._variableUsages = new Map();
    this._recursiveVariableUsages = new Map();
    this._hideSuggestions = hideSuggestions ?? false;
  }

  override get [Symbol.toStringTag]() {
    return 'ValidationContext';
  }

  get hideSuggestions() {
    return this._hideSuggestions;
  }

  getSchema(): GraphQLSchema {
    return this._schema;
  }

  getVariableUsages(node: NodeWithSelectionSet): ReadonlyArray<VariableUsage> {
    let usages = this._variableUsages.get(node);
    if (!usages) {
      const newUsages: Array<VariableUsage> = [];
      const typeInfo = new TypeInfo(
        this._schema,
        undefined,
        this._typeInfo.getFragmentSignatureByName(),
      );
      const fragmentDefinition =
        node.kind === Kind.FRAGMENT_DEFINITION ? node : undefined;
      visit(
        node,
        visitWithTypeInfo(typeInfo, {
          VariableDefinition: () => false,
          Variable(variable) {
            let fragmentVariableDefinition;
            if (fragmentDefinition) {
              const fragmentSignature = typeInfo.getFragmentSignatureByName()(
                fragmentDefinition.name.value,
              );

              fragmentVariableDefinition =
                fragmentSignature?.variableDefinitions.get(variable.name.value);
              newUsages.push({
                node: variable,
                type: typeInfo.getInputType(),
                parentType: typeInfo.getParentInputType(),
                defaultValue: undefined, // fragment variables have a variable default but no location default, which is what this default value represents
                fragmentVariableDefinition,
              });
            } else {
              newUsages.push({
                node: variable,
                type: typeInfo.getInputType(),
                parentType: typeInfo.getParentInputType(),
                defaultValue: typeInfo.getDefaultValue(),
                fragmentVariableDefinition: undefined,
              });
            }
          },
        }),
      );
      usages = newUsages;
      this._variableUsages.set(node, usages);
    }
    return usages;
  }

  getRecursiveVariableUsages(
    operation: OperationDefinitionNode,
  ): ReadonlyArray<VariableUsage> {
    let usages = this._recursiveVariableUsages.get(operation);
    if (!usages) {
      usages = this.getVariableUsages(operation);
      for (const frag of this.getRecursivelyReferencedFragments(operation)) {
        usages = usages.concat(this.getVariableUsages(frag));
      }
      this._recursiveVariableUsages.set(operation, usages);
    }
    return usages;
  }

  getType(): Maybe<GraphQLOutputType> {
    return this._typeInfo.getType();
  }

  getParentType(): Maybe<GraphQLCompositeType> {
    return this._typeInfo.getParentType();
  }

  getInputType(): Maybe<GraphQLInputType> {
    return this._typeInfo.getInputType();
  }

  getParentInputType(): Maybe<GraphQLInputType> {
    return this._typeInfo.getParentInputType();
  }

  getFieldDef(): Maybe<GraphQLField<unknown, unknown>> {
    return this._typeInfo.getFieldDef();
  }

  getDirective(): Maybe<GraphQLDirective> {
    return this._typeInfo.getDirective();
  }

  getArgument(): Maybe<GraphQLArgument> {
    return this._typeInfo.getArgument();
  }

  getFragmentSignature(): Maybe<FragmentSignature> {
    return this._typeInfo.getFragmentSignature();
  }

  getFragmentSignatureByName(): (
    fragmentName: string,
  ) => Maybe<FragmentSignature> {
    return this._typeInfo.getFragmentSignatureByName();
  }

  getEnumValue(): Maybe<GraphQLEnumValue> {
    return this._typeInfo.getEnumValue();
  }
}

export type ValidationRule = (context: ValidationContext) => ASTVisitor;
