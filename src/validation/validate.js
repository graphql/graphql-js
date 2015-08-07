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
import { visit, getVisitFn } from '../language/visitor';
import * as Kind from '../language/kinds';
import type {
  Document,
  FragmentDefinition,
} from '../language/ast';
import type { GraphQLSchema } from '../type/schema';
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
 *
 * Visitors can also supply `visitSpreadFragments: true` which will alter the
 * behavior of the visitor to skip over top level defined fragments, and instead
 * visit those fragments at every point a spread is encountered.
 */
export function validate(
  schema: GraphQLSchema,
  ast: Document,
  rules?: Array<any>
): Array<GraphQLError> {
  invariant(schema, 'Must provide schema');
  invariant(ast, 'Must provide document');
  return visitUsingRules(schema, ast, rules || specifiedRules);
}

/**
 * This uses a specialized visitor which runs multiple visitors in parallel,
 * while maintaining the visitor skip and break API.
 */
function visitUsingRules(
  schema: GraphQLSchema,
  documentAST: Document,
  rules: Array<any>
): Array<GraphQLError> {
  var typeInfo = new TypeInfo(schema);
  var context = new ValidationContext(schema, documentAST, typeInfo);
  var errors = [];

  function visitInstance(ast, instance) {
    visit(ast, {
      enter(node, key) {
        // Collect type information about the current position in the AST.
        typeInfo.enter(node);

        // Do not visit top level fragment definitions if this instance will
        // visit those fragments inline because it
        // provided `visitSpreadFragments`.
        var result;
        if (
          node.kind === Kind.FRAGMENT_DEFINITION &&
          key !== undefined &&
          instance.visitSpreadFragments
        ) {
          return false;
        }

        // Get the visitor function from the validation instance, and if it
        // exists, call it with the visitor arguments.
        var enter = getVisitFn(instance, false, node.kind);
        result = enter ? enter.apply(instance, arguments) : undefined;

        // If the visitor returned an error, log it and do not visit any
        // deeper nodes.
        if (result && isError(result)) {
          append(errors, result);
          result = false;
        }

        // If any validation instances provide the flag `visitSpreadFragments`
        // and this node is a fragment spread, visit the fragment definition
        // from this point.
        if (result === undefined &&
            instance.visitSpreadFragments &&
            node.kind === Kind.FRAGMENT_SPREAD) {
          var fragment = context.getFragment(node.name.value);
          if (fragment) {
            visitInstance(fragment, instance);
          }
        }

        // If the result is "false", we're not visiting any descendent nodes,
        // but need to update typeInfo.
        if (result === false) {
          typeInfo.leave(node);
        }

        return result;
      },
      leave(node) {
        // Get the visitor function from the validation instance, and if it
        // exists, call it with the visitor arguments.
        var leave = getVisitFn(instance, true, node.kind);
        var result = leave ? leave.apply(instance, arguments) : undefined;

        // If the visitor returned an error, log it and do not visit any
        // deeper nodes.
        if (result && isError(result)) {
          append(errors, result);
          result = false;
        }

        // Update typeInfo.
        typeInfo.leave(node);

        return result;
      }
    });
  }

  // Visit the whole document with each instance of all provided rules.
  var instances = rules.map(rule => rule(context));
  instances.forEach(instance => {
    visitInstance(documentAST, instance);
  });

  return errors;
}

function isError(value) {
  return Array.isArray(value) ?
    value.every(item => item instanceof GraphQLError) :
    value instanceof GraphQLError;
}

function append(arr, items) {
  if (Array.isArray(items)) {
    arr.push.apply(arr, items);
  } else {
    arr.push(items);
  }
}

/**
 * An instance of this class is passed as the "this" context to all validators,
 * allowing access to commonly useful contextual information from within a
 * validation rule.
 */
export class ValidationContext {
  _schema: GraphQLSchema;
  _ast: Document;
  _typeInfo: TypeInfo;
  _fragments: {[name: string]: FragmentDefinition};

  constructor(schema: GraphQLSchema, ast: Document, typeInfo: TypeInfo) {
    this._schema = schema;
    this._ast = ast;
    this._typeInfo = typeInfo;
  }

  getSchema(): GraphQLSchema {
    return this._schema;
  }

  getDocument(): Document {
    return this._ast;
  }

  getFragment(name: string): ?FragmentDefinition {
    var fragments = this._fragments;
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
