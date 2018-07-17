/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ObjMap } from '../jsutils/ObjMap';
import { GraphQLError } from '../error';
import { visit, visitWithTypeInfo } from '../language/visitor';
import { Kind } from '../language/kinds';
import type {
  DocumentNode,
  ExecutableDefinitionNode,
  OperationDefinitionNode,
  VariableNode,
  SelectionSetNode,
  FragmentSpreadNode,
  FragmentDefinitionNode,
} from '../language/ast';
import { GraphQLSchema } from '../type/schema';
import type {
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLCompositeType,
  GraphQLField,
  GraphQLArgument,
} from '../type/definition';
import type { GraphQLDirective } from '../type/directives';
import { TypeInfo } from '../utilities/TypeInfo';

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
export default class ValidationContext {
  _schema: GraphQLSchema;
  _ast: DocumentNode;
  _typeInfo: TypeInfo;
  _errors: Array<GraphQLError>;
  _fragments: ObjMap<FragmentDefinitionNode>;
  _fragmentSpreads: Map<SelectionSetNode, $ReadOnlyArray<FragmentSpreadNode>>;
  _recursivelyReferencedFragments: Map<
    ExecutableDefinitionNode,
    $ReadOnlyArray<FragmentDefinitionNode>,
  >;
  _variableUsages: Map<NodeWithSelectionSet, $ReadOnlyArray<VariableUsage>>;
  _recursiveVariableUsages: Map<
    ExecutableDefinitionNode,
    $ReadOnlyArray<VariableUsage>,
  >;

  constructor(
    schema: GraphQLSchema,
    ast: DocumentNode,
    typeInfo: TypeInfo,
  ): void {
    this._schema = schema;
    this._ast = ast;
    this._typeInfo = typeInfo;
    this._errors = [];
    this._fragmentSpreads = new Map();
    this._recursivelyReferencedFragments = new Map();
    this._variableUsages = new Map();
    this._recursiveVariableUsages = new Map();
  }

  reportError(error: GraphQLError): void {
    this._errors.push(error);
  }

  getErrors(): $ReadOnlyArray<GraphQLError> {
    return this._errors;
  }

  getSchema(): GraphQLSchema {
    return this._schema;
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
        for (let i = 0; i < set.selections.length; i++) {
          const selection = set.selections[i];
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

  /*
   * Finds all fragments referenced via the definition, recursively.
   *
   * NOTE: if experimentalFragmentVariables are being used, it excludes all
   * fragments with their own variable definitions: these are considered their
   * own "root" executable definition.
   */
  getRecursivelyReferencedFragments(
    definition: ExecutableDefinitionNode,
  ): $ReadOnlyArray<FragmentDefinitionNode> {
    let fragments = this._recursivelyReferencedFragments.get(definition);
    if (!fragments) {
      fragments = [];
      const collectedNames = Object.create(null);
      const nodesToVisit: Array<SelectionSetNode> = [definition.selectionSet];
      while (nodesToVisit.length !== 0) {
        const node = nodesToVisit.pop();
        const spreads = this.getFragmentSpreads(node);
        for (let i = 0; i < spreads.length; i++) {
          const fragName = spreads[i].name.value;
          if (collectedNames[fragName] !== true) {
            collectedNames[fragName] = true;
            const fragment = this.getFragment(fragName);
            if (
              fragment &&
              !isExperimentalFragmentWithVariableDefinitions(fragment)
            ) {
              fragments.push(fragment);
              nodesToVisit.push(fragment.selectionSet);
            }
          }
        }
      }
      this._recursivelyReferencedFragments.set(definition, fragments);
    }
    return fragments;
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

  /*
   * Finds all variables used by the definition, recursively.
   *
   * NOTE: if experimentalFragmentVariables are being used, it excludes all
   * fragments with their own variable definitions: these are considered their
   * own independent executable definition for the purposes of variable usage.
   */
  getRecursiveVariableUsages(
    definition: ExecutableDefinitionNode,
  ): $ReadOnlyArray<VariableUsage> {
    let usages = this._recursiveVariableUsages.get(definition);
    if (!usages) {
      usages = this.getVariableUsages(definition);
      const fragments = this.getRecursivelyReferencedFragments(definition);
      for (let i = 0; i < fragments.length; i++) {
        Array.prototype.push.apply(
          usages,
          this.getVariableUsages(fragments[i]),
        );
      }
      this._recursiveVariableUsages.set(definition, usages);
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

  getFieldDef(): ?GraphQLField<*, *> {
    return this._typeInfo.getFieldDef();
  }

  getDirective(): ?GraphQLDirective {
    return this._typeInfo.getDirective();
  }

  getArgument(): ?GraphQLArgument {
    return this._typeInfo.getArgument();
  }
}

function isExperimentalFragmentWithVariableDefinitions(
  ast: FragmentDefinitionNode,
): boolean %checks {
  return ast.variableDefinitions != null && ast.variableDefinitions.length > 0;
}
