import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';

import type { GraphQLError } from '../error/GraphQLError';

import type {
  DocumentNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  OperationDefinitionNode,
  SelectionSetNode,
  VariableNode,
} from '../language/ast';
import { Kind } from '../language/kinds';
import type { ASTVisitor } from '../language/visitor';
import { visit } from '../language/visitor';

import type {
  GraphQLArgument,
  GraphQLCompositeType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputType,
  GraphQLOutputType,
} from '../type/definition';
import type { GraphQLDirective } from '../type/directives';
import type { GraphQLSchema } from '../type/schema';

import { TypeInfo, visitWithTypeInfo } from '../utilities/TypeInfo';

type NodeWithSelectionSet = OperationDefinitionNode | FragmentDefinitionNode;
interface VariableUsage {
  readonly node: VariableNode;
  readonly type: Maybe<GraphQLInputType>;
  readonly defaultValue: Maybe<unknown>;
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
      const collectedNames = Object.create(null);
      const nodesToVisit: Array<SelectionSetNode> = [operation.selectionSet];
      let node: SelectionSetNode | undefined;
      while ((node = nodesToVisit.pop())) {
        for (const spread of this.getFragmentSpreads(node)) {
          const fragName = spread.name.value;
          if (collectedNames[fragName] !== true) {
            collectedNames[fragName] = true;
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

  get [Symbol.toStringTag]() {
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

  constructor(
    schema: GraphQLSchema,
    ast: DocumentNode,
    typeInfo: TypeInfo,
    onError: (error: GraphQLError) => void,
  ) {
    super(ast, onError);
    this._schema = schema;
    this._typeInfo = typeInfo;
    this._variableUsages = new Map();
    this._recursiveVariableUsages = new Map();
  }

  get [Symbol.toStringTag]() {
    return 'ValidationContext';
  }

  getSchema(): GraphQLSchema {
    return this._schema;
  }

  getVariableUsages(node: NodeWithSelectionSet): ReadonlyArray<VariableUsage> {
    let usages = this._variableUsages.get(node);
    if (!usages) {
      const newUsages: Array<VariableUsage> = [];
      const typeInfo = new TypeInfo(this._schema);
      visit(
        node,
        visitWithTypeInfo(typeInfo, {
          VariableDefinition: () => false,
          Variable(variable) {
            newUsages.push({
              node: variable,
              type: typeInfo.getInputType(),
              defaultValue: typeInfo.getDefaultValue(),
            });
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

  getEnumValue(): Maybe<GraphQLEnumValue> {
    return this._typeInfo.getEnumValue();
  }
}

export type ValidationRule = (context: ValidationContext) => ASTVisitor;
