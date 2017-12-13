/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ASTNode, KindToASTNodeType } from './ast';
import invariant from '../jsutils/invariant';

type KindValues = $Keys<KindToASTNodeType>;
type DocumentKeysType = {
  [nodeName: KindValues]: $ReadOnlyArray<string>,
};
export const QueryDocumentKeys: DocumentKeysType = {
  Name: [],
  Document: ['definitions'],
  OperationDefinition: [
    'name',
    'variableDefinitions',
    'directives',
    'selectionSet',
  ],
  VariableDefinition: ['variable', 'type', 'defaultValue'],
  Variable: ['name'],
  SelectionSet: ['selections'],
  Field: ['alias', 'name', 'arguments', 'directives', 'selectionSet'],
  Argument: ['name', 'value'],

  FragmentSpread: ['name', 'directives'],
  InlineFragment: ['typeCondition', 'directives', 'selectionSet'],
  FragmentDefinition: ['name', 'typeCondition', 'directives', 'selectionSet'],

  IntValue: [],
  FloatValue: [],
  StringValue: [],
  BooleanValue: [],
  NullValue: [],
  EnumValue: [],
  ListValue: ['values'],
  ObjectValue: ['fields'],
  ObjectField: ['name', 'value'],

  Directive: ['name', 'arguments'],

  NamedType: ['name'],
  ListType: ['type'],
  NonNullType: ['type'],

  SchemaDefinition: ['directives', 'operationTypes'],
  OperationTypeDefinition: ['type'],

  ScalarTypeDefinition: ['description', 'name', 'directives'],
  ObjectTypeDefinition: [
    'description',
    'name',
    'interfaces',
    'directives',
    'fields',
  ],
  FieldDefinition: ['description', 'name', 'arguments', 'type', 'directives'],
  InputValueDefinition: [
    'description',
    'name',
    'type',
    'defaultValue',
    'directives',
  ],
  InterfaceTypeDefinition: ['description', 'name', 'directives', 'fields'],
  UnionTypeDefinition: ['description', 'name', 'directives', 'types'],
  EnumTypeDefinition: ['description', 'name', 'directives', 'values'],
  EnumValueDefinition: ['description', 'name', 'directives'],
  InputObjectTypeDefinition: ['description', 'name', 'directives', 'fields'],

  ScalarTypeExtension: ['name', 'directives'],
  ObjectTypeExtension: ['name', 'interfaces', 'directives', 'fields'],
  InterfaceTypeExtension: ['name', 'directives', 'fields'],
  UnionTypeExtension: ['name', 'directives', 'types'],
  EnumTypeExtension: ['name', 'directives', 'values'],
  InputObjectTypeExtension: ['name', 'directives', 'fields'],

  DirectiveDefinition: ['description', 'name', 'arguments', 'locations'],
};

class Break {}
export const BREAK = new Break();

type VisitorFn<T> = (
  node: T,
  key: ?(string | number),
  parent: ?ASTNode,
  path: $ReadOnlyArray<string | number>,
  ancestors: $ReadOnlyArray<ASTNode>,
) => Break | false | ASTNode | mixed | void;

type KindVisitor = {|
  ...$ObjMap<KindToASTNodeType, <T>(T) => VisitorFn<T>>,
|};

type NodeVisitor<T> =
  | VisitorFn<T>
  | {| enter?: VisitorFn<T>, leave?: VisitorFn<T> |};

type Visitor = {|
  enter?: VisitorFn<ASTNode> | KindVisitor,
  leave?: VisitorFn<ASTNode> | KindVisitor,

  ...$ObjMap<KindToASTNodeType, <T>(T) => NodeVisitor<T>>,
|};

/**
 * visit() will walk through an AST using a depth first traversal, calling
 * the visitor's enter function at each node in the traversal, and calling the
 * leave function after visiting that node and all of its child nodes.
 *
 * By returning different values from the enter and leave functions, the
 * behavior of the visitor can be altered, including skipping over a sub-tree of
 * the AST (by returning false), editing the AST by returning a value or null
 * to remove the value, or to stop the whole traversal by returning BREAK.
 *
 * When using visit() to edit an AST, the original AST will not be modified, and
 * a new version of the AST with the changes applied will be returned from the
 * visit function.
 *
 *     const editedAST = visit(ast, {
 *       enter(node, key, parent, path, ancestors) {
 *         // @return
 *         //   undefined: no action
 *         //   false: skip visiting this node
 *         //   visitor.BREAK: stop visiting altogether
 *         //   null: delete this node
 *         //   any value: replace this node with the returned value
 *       },
 *       leave(node, key, parent, path, ancestors) {
 *         // @return
 *         //   undefined: no action
 *         //   false: no action
 *         //   visitor.BREAK: stop visiting altogether
 *         //   null: delete this node
 *         //   any value: replace this node with the returned value
 *       }
 *     });
 *
 * Alternatively to providing enter() and leave() functions, a visitor can
 * instead provide functions named the same as the kinds of AST nodes, or
 * enter/leave visitors at a named key, leading to four permutations of
 * visitor API:
 *
 * 1) Named visitors triggered when entering a node a specific kind.
 *
 *     visit(ast, {
 *       Kind(node) {
 *         // enter the "Kind" node
 *       }
 *     })
 *
 * 2) Named visitors that trigger upon entering and leaving a node of
 *    a specific kind.
 *
 *     visit(ast, {
 *       Kind: {
 *         enter(node) {
 *           // enter the "Kind" node
 *         }
 *         leave(node) {
 *           // leave the "Kind" node
 *         }
 *       }
 *     })
 *
 * 3) Generic visitors that trigger upon entering and leaving any node.
 *
 *     visit(ast, {
 *       enter(node) {
 *         // enter any node
 *       },
 *       leave(node) {
 *         // leave any node
 *       }
 *     })
 *
 * 4) Parallel visitors for entering and leaving nodes of a specific kind.
 *
 *     visit(ast, {
 *       enter: {
 *         Kind(node) {
 *           // enter the "Kind" node
 *         }
 *       },
 *       leave: {
 *         Kind(node) {
 *           // leave the "Kind" node
 *         }
 *       }
 *     })
 */
export function visit(
  root: ASTNode,
  visitor: Visitor,
  keyMap?: DocumentKeysType,
): any {
  const visitorKeys = keyMap || QueryDocumentKeys;
  const path = [];
  const ancestors = [];
  let node = root;
  let parent;
  let isLeaving = false;
  let editStack = { depth: 0, value: {}, prev: null };

  for (;;) {
    if (!isNode(node)) {
      throw new Error('Invalid AST Node: ' + JSON.stringify(node));
    }
    const isInArray = typeof path[path.length - 1] === 'number';
    const curKey = path[path.length - (isInArray ? 2 : 1)];
    const curIndex = isInArray ? path[path.length - 1] : undefined;
    const visitFn = getVisitFn(visitor, node.kind, isLeaving);

    if (visitFn) {
      const key = path[path.length - 1];
      const result = visitFn.call(visitor, node, key, parent, path, ancestors);
      if (result === BREAK) {
        return root;
      } else if (result === false) {
        isLeaving = true;
      } else if (result !== undefined) {
        node = (result: any);
        if (!isNode(result)) {
          isLeaving = true;
        }
      }
    }

    if (!isLeaving) {
      const newParent = node;
      isLeaving = !switchToNextNode(node);
      if (!isLeaving) {
        parent = newParent;
        ancestors.push(newParent);
      }
      continue;
    }

    if (parent === undefined) {
      break;
    }

    const oldValue = isInArray ? parent[curKey][curIndex] : parent[curKey];
    if (node !== oldValue) {
      if (editStack.depth < ancestors.length) {
        editStack = { depth: ancestors.length, value: {}, prev: editStack };
      }
      const edits = editStack.value;
      if (curIndex !== undefined) {
        edits[curKey] = edits[curKey] || parent[curKey].slice();
        edits[curKey][curIndex] = node;
      } else {
        edits[curKey] = node;
      }
    }

    path.pop();
    if (isInArray) {
      path.pop();
    }
    isLeaving = !switchToNextNode(parent, curKey, curIndex);
    if (isLeaving) {
      node = ancestors.pop();
      parent = ancestors[ancestors.length - 1];
      if (editStack.depth === ancestors.length + 1) {
        node = applyEdits(node, editStack.value);
        invariant(editStack.prev != null);
        editStack = editStack.prev;
      }
    }
  }

  return node;

  function switchToNextNode(baseNode, prevKey, prevIndex) {
    if (prevKey !== undefined && prevIndex !== undefined) {
      const nextIndex = prevIndex + 1;
      if (nextIndex < baseNode[prevKey].length) {
        node = baseNode[prevKey][nextIndex];
        path.push(prevKey, nextIndex);
        return true;
      }
    }

    const keys = visitorKeys[baseNode.kind] || [];
    let keyIndex = prevKey == null ? 0 : keys.indexOf(prevKey) + 1;
    for (; keyIndex < keys.length; ++keyIndex) {
      const nextKey = keys[keyIndex];
      const keyValue = baseNode[nextKey];

      if (keyValue != null) {
        if (!Array.isArray(keyValue)) {
          node = keyValue;
          path.push(nextKey);
          return true;
        } else if (keyValue.length > 0) {
          node = keyValue[0];
          path.push(nextKey, 0);
          return true;
        }
      }
    }
    return false;
  }

  function applyEdits(oldNode, edits) {
    const newNode = {};
    for (const key in oldNode) {
      if (Object.prototype.hasOwnProperty.call(oldNode, key)) {
        const editedValue = edits[key];
        if (editedValue === undefined) {
          newNode[key] = oldNode[key];
        } else if (Array.isArray(editedValue)) {
          newNode[key] = editedValue.filter(value => value !== null);
        } else if (editedValue !== null) {
          newNode[key] = editedValue;
        }
      }
    }
    return newNode;
  }
}

function isNode(maybeNode: mixed): boolean %checks {
  return maybeNode != null && typeof maybeNode.kind === 'string';
}

/**
 * Creates a new visitor instance which delegates to many visitors to run in
 * parallel. Each visitor will be visited for each node before moving on.
 *
 * If a prior visitor edits a node, no following visitors will see that node.
 */
export function visitInParallel(visitors: $ReadOnlyArray<Visitor>): Visitor {
  const skipping = new Array(visitors.length);

  return {
    enter(node) {
      for (let i = 0; i < visitors.length; i++) {
        if (!skipping[i]) {
          const fn = getVisitFn(visitors[i], node.kind, /* isLeaving */ false);
          if (fn) {
            const result = fn.apply(visitors[i], arguments);
            if (result === false) {
              skipping[i] = node;
            } else if (result === BREAK) {
              skipping[i] = BREAK;
            } else if (result !== undefined) {
              return result;
            }
          }
        }
      }
    },
    leave(node) {
      for (let i = 0; i < visitors.length; i++) {
        if (!skipping[i]) {
          const fn = getVisitFn(visitors[i], node.kind, /* isLeaving */ true);
          if (fn) {
            const result = fn.apply(visitors[i], arguments);
            if (result === BREAK) {
              skipping[i] = BREAK;
            } else if (result !== undefined && result !== false) {
              return result;
            }
          }
        } else if (skipping[i] === node) {
          skipping[i] = null;
        }
      }
    },
  };
}

interface TypeInfo { enter(ASTNode): void; leave(ASTNode): void }
/**
 * Creates a new visitor instance which maintains a provided TypeInfo instance
 * along with visiting visitor.
 */
export function visitWithTypeInfo(
  typeInfo: TypeInfo,
  visitor: Visitor,
): Visitor {
  return {
    enter(node) {
      typeInfo.enter(node);
      const fn = getVisitFn(visitor, node.kind, /* isLeaving */ false);
      if (fn) {
        const result = fn.apply(visitor, arguments);
        if (result !== undefined) {
          typeInfo.leave(node);
          if (isNode(result)) {
            typeInfo.enter(((result: any): ASTNode));
          }
        }
        return result;
      }
    },
    leave(node) {
      const fn = getVisitFn(visitor, node.kind, /* isLeaving */ true);
      let result;
      if (fn) {
        result = fn.apply(visitor, arguments);
      }
      typeInfo.leave(node);
      return result;
    },
  };
}

/**
 * Given a visitor instance, if it is leaving or not, and a node kind, return
 * the function the visitor runtime should call.
 */
export function getVisitFn(
  visitor: Visitor,
  kind: KindValues,
  isLeaving: boolean,
): VisitorFn<ASTNode> | void {
  const kindVisitor = visitor[kind];
  if (kindVisitor) {
    if (!isLeaving && typeof kindVisitor === 'function') {
      // { Kind() {} }
      return kindVisitor;
    }
    const kindSpecificVisitor = isLeaving
      ? kindVisitor.leave
      : kindVisitor.enter;
    if (typeof kindSpecificVisitor === 'function') {
      // { Kind: { enter() {}, leave() {} } }
      return kindSpecificVisitor;
    }
  } else {
    const specificVisitor = isLeaving ? visitor.leave : visitor.enter;
    if (specificVisitor) {
      if (typeof specificVisitor === 'function') {
        // { enter() {}, leave() {} }
        return specificVisitor;
      }
      const specificKindVisitor = specificVisitor[kind];
      if (typeof specificKindVisitor === 'function') {
        // { enter: { Kind() {} }, leave: { Kind() {} } }
        return specificKindVisitor;
      }
    }
  }
}
