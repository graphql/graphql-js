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
import { visit, BREAK, getVisitFn } from '../language/visitor';
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
import { allRules } from './allRules';


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
  return visitUsingRules(schema, ast, rules || allRules);
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

  function visitInstances(ast, instances) {
    var skipUntil = Array(instances.length);
    var skipCount = 0;
    visit(ast, {
      enter(node, key) {
        typeInfo.enter(node);
        for (var i = 0; i < instances.length; i++) {
          // Do not visit this instance if it returned false for a previous node
          if (skipUntil[i]) {
            continue;
          }

          var result;

          // Do not visit top level fragment definitions if this instance will
          // visit those fragments inline because it
          // provided `visitSpreadFragments`.
          if (
            node.kind === Kind.FRAGMENT_DEFINITION &&
            key !== undefined &&
            (instances[i]: any).visitSpreadFragments
          ) {
            result = false;
          } else {
            var enter = getVisitFn(instances[i], false, node.kind);
            result = enter ? enter.apply(instances[i], arguments) : undefined;
          }

          if (result === false) {
            skipUntil[i] = node;
            skipCount++;
            // If all instances are being skipped over, skip deeper traveral
            if (skipCount === instances.length) {
              for (var k = 0; k < instances.length; k++) {
                if (skipUntil[k] === node) {
                  skipUntil[k] = null;
                  skipCount--;
                }
              }
              return false;
            }
          } else if (result === BREAK) {
            instances[i] = null;
          } else if (result && isError(result)) {
            append(errors, result);
            for (var j = i - 1; j >= 0; j--) {
              var leaveFn = getVisitFn(instances[j], true, node.kind);
              if (leaveFn) {
                result = leaveFn.apply(instances[j], arguments);
                if (result === BREAK) {
                  instances[j] = null;
                } else if (isError(result)) {
                  append(errors, result);
                } else if (result !== undefined) {
                  throw new Error('Validator cannot edit document.');
                }
              }
            }
            typeInfo.leave(node);
            return false;
          } else if (result !== undefined) {
            throw new Error('Validator cannot edit document.');
          }
        }

        // If any validation instances provide the flag `visitSpreadFragments`
        // and this node is a fragment spread, validate the fragment from
        // this point.
        if (node.kind === Kind.FRAGMENT_SPREAD) {
          var fragment = context.getFragment(node.name.value);
          if (fragment) {
            var fragVisitingInstances = instances.filter(
              (inst: any, idx) => inst.visitSpreadFragments && !skipUntil[idx]
            );
            if (fragVisitingInstances.length > 0) {
              visitInstances(fragment, fragVisitingInstances);
            }
          }
        }
      },
      leave(node) {
        for (var i = instances.length - 1; i >= 0; i--) {
          if (skipUntil[i]) {
            if (skipUntil[i] === node) {
              skipUntil[i] = null;
              skipCount--;
            }
            continue;
          }
          var leaveFn = getVisitFn(instances[i], true, node.kind);
          if (leaveFn) {
            var result = leaveFn.apply(instances[i], arguments);
            if (result === BREAK) {
              instances[i] = null;
            } else if (isError(result)) {
              append(errors, result);
            } else if (result !== undefined && result !== false) {
              throw new Error('Validator cannot edit document.');
            }
          }
        }
        typeInfo.leave(node);
      }
    });
  }

  // Visit the whole document with instances of all provided rules.
  var allRuleInstances = rules.map(rule => rule(context));
  visitInstances(documentAST, allRuleInstances);

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
