import { SetMap } from '../jsutils/SetMap';
import type { ObjMap } from '../jsutils/ObjMap';

import type { GraphQLError } from '../error/GraphQLError';

import type { ASTVisitor } from '../language/visitor';
import type {
  DocumentNode,
  OperationDefinitionNode,
  VariableNode,
  SelectionSetNode,
  FragmentSpreadNode,
  FragmentDefinitionNode,
} from '../language/ast';

import { Kind } from '../language/kinds';
import { visit } from '../language/visitor';

import type { GraphQLSchema } from '../type/schema';
import type { GraphQLDirective } from '../type/directives';
import type {
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLCompositeType,
  GraphQLField,
  GraphQLArgument,
  GraphQLEnumValue,
} from '../type/definition';

import { TypeInfo, visitWithTypeInfo } from '../utilities/TypeInfo';

type NodeWithSelectionSet = OperationDefinitionNode | FragmentDefinitionNode;
type VariableUsage = {|
  +node: VariableNode,
  +type: ?GraphQLInputType,
  +defaultValue: ?mixed,
|};

/**
 * An instance of this class is passed as the "this" context to all validators,
 * allowing access to commonly useful contextual information from within a
 * validation rule.
 */
export class ASTValidationContext {
  _ast: DocumentNode;
  _onError: (err: GraphQLError) => void;
  _fragments: ?ObjMap<FragmentDefinitionNode>;
  _fragmentSpreads: Map<SelectionSetNode, $ReadOnlyArray<FragmentSpreadNode>>;
  _recursivelyReferencedFragments: SetMap<
    string,
    $ReadOnlyArray<FragmentDefinitionNode>,
  >;

  constructor(ast: DocumentNode, onError: (err: GraphQLError) => void) {
    this._ast = ast;
    this._fragments = undefined;
    this._fragmentSpreads = new Map();
    this._recursivelyReferencedFragments = new SetMap();
    this._onError = onError;
  }

  reportError(error: GraphQLError): void {
    this._onError(error);
  }

  getDocument(): DocumentNode {
    return this._ast;
  }

  getFragment(name: string): ?FragmentDefinitionNode {
    let fragments = this._fragments;
    if (!fragments) {
      this._fragments = fragments = this.getDocument().definitions.reduce(
        (frags, statement) => {
          if (statement.kind === Kind.FRAGMENT_DEFINITION) {
            frags[statement.name.value] = statement;
          }
          return frags;
        },
        Object.create(null),
      );
    }
    return fragments[name];
  }

  getFragmentSpreads(
    node: SelectionSetNode,
  ): $ReadOnlyArray<FragmentSpreadNode> {
    let spreads = this._fragmentSpreads.get(node);
    if (!spreads) {
      spreads = [];
      const setsToVisit: Array<SelectionSetNode> = [node];
      while (setsToVisit.length !== 0) {
        const set = setsToVisit.pop();
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
  ): $ReadOnlyArray<FragmentDefinitionNode> {
    return this.getRecursivelyReferencedFragmentsForOperations([operation]);
  }

  getRecursivelyReferencedFragmentsForOperations(
    operations: $ReadOnlyArray<OperationDefinitionNode>,
  ): $ReadOnlyArray<FragmentDefinitionNode> {
    const fragmentNames = new Set(
      operations.reduce(
        (names, operation) =>
          names.concat(
            this.getFragmentSpreads(operation.selectionSet).map(
              ({ name }) => name.value,
            ),
          ),
        [],
      ),
    );
    let fragments = this._recursivelyReferencedFragments.get(fragmentNames);
    if (!fragments) {
      fragments = [];
      const collectedNames: Set<string> = new Set();
      const nodesToVisit = operations.map(({ selectionSet }) => selectionSet);
      let node: SelectionSetNode | void;
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
      this._recursivelyReferencedFragments.set(fragmentNames, fragments);
    }
    return fragments;
  }
}

export type ASTValidationRule = (ASTValidationContext) => ASTVisitor;

export class SDLValidationContext extends ASTValidationContext {
  _schema: ?GraphQLSchema;

  constructor(
    ast: DocumentNode,
    schema: ?GraphQLSchema,
    onError: (err: GraphQLError) => void,
  ) {
    super(ast, onError);
    this._schema = schema;
  }

  getSchema(): ?GraphQLSchema {
    return this._schema;
  }
}

export type SDLValidationRule = (SDLValidationContext) => ASTVisitor;

export class ValidationContext extends ASTValidationContext {
  _schema: GraphQLSchema;
  _typeInfo: TypeInfo;
  _variableUsages: Map<NodeWithSelectionSet, $ReadOnlyArray<VariableUsage>>;
  _recursiveVariableUsages: Map<
    OperationDefinitionNode | $ReadOnlyArray<FragmentDefinitionNode>,
    $ReadOnlyArray<VariableUsage>,
  >;

  constructor(
    schema: GraphQLSchema,
    ast: DocumentNode,
    typeInfo: TypeInfo,
    onError: (err: GraphQLError) => void,
  ) {
    super(ast, onError);
    this._schema = schema;
    this._typeInfo = typeInfo;
    this._variableUsages = new Map();
    this._recursiveVariableUsages = new Map();
  }

  getSchema(): GraphQLSchema {
    return this._schema;
  }

  getVariableUsages(node: NodeWithSelectionSet): $ReadOnlyArray<VariableUsage> {
    let usages = this._variableUsages.get(node);
    if (!usages) {
      const newUsages = [];
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
  ): $ReadOnlyArray<VariableUsage> {
    let usages = this._recursiveVariableUsages.get(operation);
    if (!usages) {
      const fragments = this.getRecursivelyReferencedFragments(operation);
      let fragmentUsages = this._recursiveVariableUsages.get(fragments);
      if (!fragmentUsages) {
        fragmentUsages = [];
        for (const fragment of fragments) {
          fragmentUsages.push(...this.getVariableUsages(fragment));
        }
        this._recursiveVariableUsages.set(fragments, fragmentUsages);
      }
      usages = this.getVariableUsages(operation).concat(fragmentUsages);
      this._recursiveVariableUsages.set(operation, usages);
    }
    return usages;
  }

  getType(): ?GraphQLOutputType {
    return this._typeInfo.getType();
  }

  getParentType(): ?GraphQLCompositeType {
    return this._typeInfo.getParentType();
  }

  getInputType(): ?GraphQLInputType {
    return this._typeInfo.getInputType();
  }

  getParentInputType(): ?GraphQLInputType {
    return this._typeInfo.getParentInputType();
  }

  getFieldDef(): ?GraphQLField<mixed, mixed> {
    return this._typeInfo.getFieldDef();
  }

  getDirective(): ?GraphQLDirective {
    return this._typeInfo.getDirective();
  }

  getArgument(): ?GraphQLArgument {
    return this._typeInfo.getArgument();
  }

  getEnumValue(): ?GraphQLEnumValue {
    return this._typeInfo.getEnumValue();
  }
}

export type ValidationRule = (ValidationContext) => ASTVisitor;
