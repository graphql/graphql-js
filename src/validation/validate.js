/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../jsutils/invariant';
import { GraphQLError } from '../error';
import { visit, visitInParallel, visitWithTypeInfo } from '../language/visitor';
import * as Kind from '../language/kinds';
import type {
  Document,
  OperationDefinition,
  Variable,
  SelectionSet,
  FragmentSpread,
  FragmentDefinition,
} from '../language/ast';
import { GraphQLSchema } from '../type/schema';
import type {
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLCompositeType,
  GraphQLFieldDefinition,
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
 */
export function validate(
  schema: GraphQLSchema,
  ast: Document,
  rules?: Array<any>
): Array<GraphQLError> {
  invariant(schema, 'Must provide schema');
  invariant(ast, 'Must provide document');
  invariant(
    schema instanceof GraphQLSchema,
    'Schema must be an instance of GraphQLSchema. Also ensure that there are ' +
    'not multiple versions of GraphQL installed in your node_modules directory.'
  );
  const typeInfo = new TypeInfo(schema);
  return visitUsingRules(schema, typeInfo, ast, rules || specifiedRules);
}

/**
 * This uses a specialized visitor which runs multiple visitors in parallel,
 * while maintaining the visitor skip and break API.
 *
 * @internal
 */
export function visitUsingRules(
  schema: GraphQLSchema,
  typeInfo: TypeInfo,
  documentAST: Document,
  rules: Array<any>
): Array<GraphQLError> {
  const context = new ValidationContext(schema, documentAST, typeInfo);
  const visitors = rules.map(rule => rule(context));
  // Visit the whole document with each instance of all provided rules.
  visit(documentAST, visitWithTypeInfo(typeInfo, visitInParallel(visitors)));
  return context.getErrors();
}

type HasSelectionSet = OperationDefinition | FragmentDefinition;
type VariableUsage = { node: Variable, type: ?GraphQLInputType };

/**
 * An instance of this class is passed as the "this" context to all validators,
 * allowing access to commonly useful contextual information from within a
 * validation rule.
 */
export class ValidationContext {
  _schema: GraphQLSchema;
  _ast: Document;
  _typeInfo: TypeInfo;
  _errors: Array<GraphQLError>;
  _fragments: {[name: string]: FragmentDefinition};
  _fragmentSpreads: Map<HasSelectionSet, Array<FragmentSpread>>;
  _recursivelyReferencedFragments:
    Map<OperationDefinition, Array<FragmentDefinition>>;
  _variableUsages: Map<HasSelectionSet, Array<VariableUsage>>;
  _recursiveVariableUsages: Map<OperationDefinition, Array<VariableUsage>>;

  constructor(schema: GraphQLSchema, ast: Document, typeInfo: TypeInfo) {
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

  getDocument(): Document {
    return this._ast;
  }

  getFragment(name: string): ?FragmentDefinition {
    let fragments = this._fragments;
    if (!fragments) {
      this._fragments = fragments =
        this.getDocument().definitions.reduce((frags, statement) => {
          if (statement.kind === Kind.FRAGMENT_DEFINITION) {
            frags[statement.name.value] = statement;
          }
          return frags;
        }, {});
    }
    return fragments[name];
  }

  getFragmentSpreads(node: HasSelectionSet): Array<FragmentSpread> {
    let spreads = this._fragmentSpreads.get(node);
    if (!spreads) {
      spreads = [];
      const setsToVisit: Array<SelectionSet> = [ node.selectionSet ];
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
    operation: OperationDefinition
  ): Array<FragmentDefinition> {
    let fragments = this._recursivelyReferencedFragments.get(operation);
    if (!fragments) {
      fragments = [];
      const collectedNames = Object.create(null);
      const nodesToVisit: Array<HasSelectionSet> = [ operation ];
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
              nodesToVisit.push(fragment);
            }
          }
        }
      }
      this._recursivelyReferencedFragments.set(operation, fragments);
    }
    return fragments;
  }

  getVariableUsages(node: HasSelectionSet): Array<VariableUsage> {
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
    operation: OperationDefinition
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

  getFieldDef(): ?GraphQLFieldDefinition {
    return this._typeInfo.getFieldDef();
  }

  getDirective(): ?GraphQLDirective {
    return this._typeInfo.getDirective();
  }

  getArgument(): ?GraphQLArgument {
    return this._typeInfo.getArgument();
  }
}
