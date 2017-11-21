/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import invariant from '../jsutils/invariant';
import type {ObjMap} from '../jsutils/ObjMap';
import { GraphQLError } from '../error';
import { visit, visitInParallel, visitWithTypeInfo } from '../language/visitor';
import * as Kind from '../language/kinds';
import type {
  DocumentNode,
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
  GraphQLArgument
} from '../type/definition';
import type { GraphQLDirective } from '../type/directives';
import { TypeInfo } from '../utilities/TypeInfo';
import { specifiedRules } from './specifiedRules';


/**
 * Implements the "Validation" section of the spec.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the document is valid.
 *
 * A list of specific validation rules may be provided. If not provided, the
 * default list of rules defined by the GraphQL specification will be used.
 *
 * Each validation rules is a function which returns a visitor
 * (see the language/visitor API). Visitor methods are expected to return
 * GraphQLErrors, or Arrays of GraphQLErrors when invalid.
 *
 * Optionally a custom TypeInfo instance may be provided. If not provided, one
 * will be created from the provided schema.
 */
export function validate(
  schema: GraphQLSchema,
  ast: DocumentNode,
  rules?: Array<any>,
  typeInfo?: TypeInfo,
): Array<GraphQLError> {
  invariant(schema, 'Must provide schema');
  invariant(ast, 'Must provide document');
  invariant(
    schema instanceof GraphQLSchema,
    'Schema must be an instance of GraphQLSchema. Also ensure that there are ' +
    'not multiple versions of GraphQL installed in your node_modules directory.'
  );
  return visitUsingRules(
    schema,
    typeInfo || new TypeInfo(schema),
    ast,
    rules || specifiedRules
  );
}

/**
 * This uses a specialized visitor which runs multiple visitors in parallel,
 * while maintaining the visitor skip and break API.
 *
 * @internal
 */
function visitUsingRules(
  schema: GraphQLSchema,
  typeInfo: TypeInfo,
  documentAST: DocumentNode,
  rules: Array<any>
): Array<GraphQLError> {
  const context = new ValidationContext(schema, documentAST, typeInfo);
  const visitors = rules.map(rule => rule(context));
  // Visit the whole document with each instance of all provided rules.
  visit(documentAST, visitWithTypeInfo(typeInfo, visitInParallel(visitors)));
  return context.getErrors();
}

type NodeWithSelectionSet = OperationDefinitionNode | FragmentDefinitionNode;
type VariableUsage = { node: VariableNode, type: ?GraphQLInputType };

/**
 * An instance of this class is passed as the "this" context to all validators,
 * allowing access to commonly useful contextual information from within a
 * validation rule.
 */
export class ValidationContext {
  _schema: GraphQLSchema;
  _ast: DocumentNode;
  _typeInfo: TypeInfo;
  _errors: Array<GraphQLError>;
  _fragments: ObjMap<FragmentDefinitionNode>;
  _fragmentSpreads: Map<SelectionSetNode, Array<FragmentSpreadNode>>;
  _recursivelyReferencedFragments: Map<
    OperationDefinitionNode,
    Array<FragmentDefinitionNode>
  >;
  _variableUsages: Map<NodeWithSelectionSet, Array<VariableUsage>>;
  _recursiveVariableUsages: Map<OperationDefinitionNode, Array<VariableUsage>>;

  constructor(
    schema: GraphQLSchema,
    ast: DocumentNode,
    typeInfo: TypeInfo
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

  getErrors(): Array<GraphQLError> {
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
      this._fragments = fragments =
        this.getDocument().definitions.reduce((frags, statement) => {
          if (statement.kind === Kind.FRAGMENT_DEFINITION) {
            frags[statement.name.value] = statement;
          }
          return frags;
        }, Object.create(null));
    }
    return fragments[name];
  }

  getFragmentSpreads(node: SelectionSetNode): Array<FragmentSpreadNode> {
    let spreads = this._fragmentSpreads.get(node);
    if (!spreads) {
      spreads = [];
      const setsToVisit: Array<SelectionSetNode> = [ node ];
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

  getRecursivelyReferencedFragments(
    operation: OperationDefinitionNode
  ): Array<FragmentDefinitionNode> {
    let fragments = this._recursivelyReferencedFragments.get(operation);
    if (!fragments) {
      fragments = [];
      const collectedNames = Object.create(null);
      const nodesToVisit: Array<SelectionSetNode> = [ operation.selectionSet ];
      while (nodesToVisit.length !== 0) {
        const node = nodesToVisit.pop();
        const spreads = this.getFragmentSpreads(node);
        for (let i = 0; i < spreads.length; i++) {
          const fragName = spreads[i].name.value;
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

  getVariableUsages(node: NodeWithSelectionSet): Array<VariableUsage> {
    let usages = this._variableUsages.get(node);
    if (!usages) {
      const newUsages = [];
      const typeInfo = new TypeInfo(this._schema);
      visit(node, visitWithTypeInfo(typeInfo, {
        VariableDefinition: () => false,
        Variable(variable) {
          newUsages.push({ node: variable, type: typeInfo.getInputType() });
        }
      }));
      usages = newUsages;
      this._variableUsages.set(node, usages);
    }
    return usages;
  }

  getRecursiveVariableUsages(
    operation: OperationDefinitionNode
  ): Array<VariableUsage> {
    let usages = this._recursiveVariableUsages.get(operation);
    if (!usages) {
      usages = this.getVariableUsages(operation);
      const fragments = this.getRecursivelyReferencedFragments(operation);
      for (let i = 0; i < fragments.length; i++) {
        Array.prototype.push.apply(
          usages,
          this.getVariableUsages(fragments[i])
        );
      }
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
