/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import type { ValidationContext } from '../index';
import { GraphQLError } from '../../error';
import find from '../../jsutils/find';
import type {
  SelectionSet,
  Field,
  Argument,
} from '../../language/ast';
import { FIELD, INLINE_FRAGMENT, FRAGMENT_SPREAD } from '../../language/kinds';
import { print } from '../../language/printer';
import {
  getNamedType,
  isLeafType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInterfaceType,
} from '../../type/definition';
import type {
  GraphQLNamedType,
  GraphQLOutputType,
  GraphQLCompositeType,
  GraphQLFieldDefinition
} from '../../type/definition';
import { typeFromAST } from '../../utilities/typeFromAST';


export function fieldsConflictMessage(
  responseName: string,
  reason: ConflictReasonMessage
): string {
  return `Fields "${responseName}" conflict because ${reasonMessage(reason)}` +
    '. Use different aliases on the fields to fetch both if this was ' +
    'intentional.';
}

function reasonMessage(reason: ConflictReasonMessage): string {
  if (Array.isArray(reason)) {
    return reason.map(([ responseName, subreason ]) =>
      `subfields "${responseName}" conflict because ${reasonMessage(subreason)}`
    ).join(' and ');
  }
  return reason;
}

/**
 * Overlapping fields can be merged
 *
 * A selection set is only valid if all fields (including spreading any
 * fragments) either correspond to distinct response names or can be merged
 * without ambiguity.
 */
export function OverlappingFieldsCanBeMerged(context: ValidationContext): any {
  const comparedSet = new PairSet();

  function findConflicts(
    parentFieldsAreMutuallyExclusive: boolean,
    fieldMap: AstAndDefCollection
  ): Array<Conflict> {
    const conflicts = [];
    Object.keys(fieldMap).forEach(responseName => {
      const fields = fieldMap[responseName];
      if (fields.length > 1) {
        for (let i = 0; i < fields.length; i++) {
          for (let j = i; j < fields.length; j++) {
            const conflict = findConflict(
              parentFieldsAreMutuallyExclusive,
              responseName,
              fields[i],
              fields[j]
            );
            if (conflict) {
              conflicts.push(conflict);
            }
          }
        }
      }
    });
    return conflicts;
  }

  function findConflict(
    parentFieldsAreMutuallyExclusive: boolean,
    responseName: string,
    field1: AstAndDef,
    field2: AstAndDef
  ): ?Conflict {
    const [ parentType1, ast1, def1 ] = field1;
    const [ parentType2, ast2, def2 ] = field2;

    // Not a pair.
    if (ast1 === ast2) {
      return;
    }

    // Memoize, do not report the same issue twice.
    // Note: Two overlapping ASTs could be encountered both when
    // `parentFieldsAreMutuallyExclusive` is true and is false, which could
    // produce different results (when `true` being a subset of `false`).
    // However we do not need to include this piece of information when
    // memoizing since this rule visits leaf fields before their parent fields,
    // ensuring that `parentFieldsAreMutuallyExclusive` is `false` the first
    // time two overlapping fields are encountered, ensuring that the full
    // set of validation rules are always checked when necessary.
    if (comparedSet.has(ast1, ast2)) {
      return;
    }
    comparedSet.add(ast1, ast2);

    // The return type for each field.
    const type1 = def1 && def1.type;
    const type2 = def2 && def2.type;

    // If it is known that two fields could not possibly apply at the same
    // time, due to the parent types, then it is safe to permit them to diverge
    // in aliased field or arguments used as they will not present any ambiguity
    // by differing.
    // It is known that two parent types could never overlap if they are
    // different Object types. Interface or Union types might overlap - if not
    // in the current state of the schema, then perhaps in some future version,
    // thus may not safely diverge.
    const fieldsAreMutuallyExclusive =
      parentFieldsAreMutuallyExclusive ||
      parentType1 !== parentType2 &&
      parentType1 instanceof GraphQLObjectType &&
      parentType2 instanceof GraphQLObjectType;

    if (!fieldsAreMutuallyExclusive) {
      // Two aliases must refer to the same field.
      const name1 = ast1.name.value;
      const name2 = ast2.name.value;
      if (name1 !== name2) {
        return [
          [ responseName, `${name1} and ${name2} are different fields` ],
          [ ast1 ],
          [ ast2 ]
        ];
      }

      // Two field calls must have the same arguments.
      if (!sameArguments(ast1.arguments || [], ast2.arguments || [])) {
        return [
          [ responseName, 'they have differing arguments' ],
          [ ast1 ],
          [ ast2 ]
        ];
      }
    }

    if (type1 && type2 && doTypesConflict(type1, type2)) {
      return [
        [ responseName, `they return conflicting types ${type1} and ${type2}` ],
        [ ast1 ],
        [ ast2 ]
      ];
    }

    const subfieldMap = getSubfieldMap(ast1, type1, ast2, type2);
    if (subfieldMap) {
      const conflicts = findConflicts(fieldsAreMutuallyExclusive, subfieldMap);
      return subfieldConflicts(conflicts, responseName, ast1, ast2);
    }
  }

  function getSubfieldMap(
    ast1: Field,
    type1: ?GraphQLOutputType,
    ast2: Field,
    type2: ?GraphQLOutputType
  ): ?AstAndDefCollection {
    const selectionSet1 = ast1.selectionSet;
    const selectionSet2 = ast2.selectionSet;
    if (selectionSet1 && selectionSet2) {
      const visitedFragmentNames = {};
      let subfieldMap = collectFieldASTsAndDefs(
        context,
        getNamedType(type1),
        selectionSet1,
        visitedFragmentNames
      );
      subfieldMap = collectFieldASTsAndDefs(
        context,
        getNamedType(type2),
        selectionSet2,
        visitedFragmentNames,
        subfieldMap
      );
      return subfieldMap;
    }
  }

  function subfieldConflicts(
    conflicts: Array<Conflict>,
    responseName: string,
    ast1: Field,
    ast2: Field
  ): ?Conflict {
    if (conflicts.length > 0) {
      return [
        [ responseName, conflicts.map(([ reason ]) => reason) ],
        conflicts.reduce(
          (allFields, [ , fields1 ]) => allFields.concat(fields1),
          [ ast1 ]
        ),
        conflicts.reduce(
          (allFields, [ , , fields2 ]) => allFields.concat(fields2),
          [ ast2 ]
        )
      ];
    }
  }

  return {
    SelectionSet: {
      // Note: we validate on the reverse traversal so deeper conflicts will be
      // caught first, for correct calculation of mutual exclusivity and for
      // clearer error messages.
      leave(selectionSet) {
        const fieldMap = collectFieldASTsAndDefs(
          context,
          context.getParentType(),
          selectionSet
        );
        const conflicts = findConflicts(false, fieldMap);
        conflicts.forEach(
          ([ [ responseName, reason ], fields1, fields2 ]) =>
            context.reportError(new GraphQLError(
              fieldsConflictMessage(responseName, reason),
              fields1.concat(fields2)
            ))
        );
      }
    }
  };
}

type Conflict = [ ConflictReason, Array<Field>, Array<Field> ];
// Field name and reason.
type ConflictReason = [ string, ConflictReasonMessage ];
// Reason is a string, or a nested list of conflicts.
type ConflictReasonMessage = string | Array<ConflictReason>;
// Tuple defining an AST in a context
type AstAndDef = [ GraphQLCompositeType, Field, ?GraphQLFieldDefinition ];
// Map of array of those.
type AstAndDefCollection = { [key: string]: Array<AstAndDef> };

function sameArguments(
  arguments1: Array<Argument>,
  arguments2: Array<Argument>
): boolean {
  if (arguments1.length !== arguments2.length) {
    return false;
  }
  return arguments1.every(argument1 => {
    const argument2 = find(
      arguments2,
      argument => argument.name.value === argument1.name.value
    );
    if (!argument2) {
      return false;
    }
    return sameValue(argument1.value, argument2.value);
  });
}

function sameValue(value1, value2) {
  return (!value1 && !value2) || print(value1) === print(value2);
}

// Two types conflict if both types could not apply to a value simultaneously.
// Composite types are ignored as their individual field types will be compared
// later recursively. However List and Non-Null types must match.
function doTypesConflict(
  type1: GraphQLOutputType,
  type2: GraphQLOutputType
): boolean {
  if (type1 instanceof GraphQLList) {
    return type2 instanceof GraphQLList ?
      doTypesConflict(type1.ofType, type2.ofType) :
      true;
  }
  if (type2 instanceof GraphQLList) {
    return type1 instanceof GraphQLList ?
      doTypesConflict(type1.ofType, type2.ofType) :
      true;
  }
  if (type1 instanceof GraphQLNonNull) {
    return type2 instanceof GraphQLNonNull ?
      doTypesConflict(type1.ofType, type2.ofType) :
      true;
  }
  if (type2 instanceof GraphQLNonNull) {
    return type1 instanceof GraphQLNonNull ?
      doTypesConflict(type1.ofType, type2.ofType) :
      true;
  }
  if (isLeafType(type1) || isLeafType(type2)) {
    return type1 !== type2;
  }
  return false;
}

/**
 * Given a selectionSet, adds all of the fields in that selection to
 * the passed in map of fields, and returns it at the end.
 *
 * Note: This is not the same as execution's collectFields because at static
 * time we do not know what object type will be used, so we unconditionally
 * spread in all fragments.
 */
function collectFieldASTsAndDefs(
  context: ValidationContext,
  parentType: ?GraphQLNamedType,
  selectionSet: SelectionSet,
  visitedFragmentNames?: {[key: string]: boolean},
  astAndDefs?: AstAndDefCollection
): AstAndDefCollection {
  const _visitedFragmentNames = visitedFragmentNames || {};
  let _astAndDefs = astAndDefs || {};
  for (let i = 0; i < selectionSet.selections.length; i++) {
    const selection = selectionSet.selections[i];
    switch (selection.kind) {
      case FIELD:
        const fieldName = selection.name.value;
        let fieldDef;
        if (parentType instanceof GraphQLObjectType ||
            parentType instanceof GraphQLInterfaceType) {
          fieldDef = parentType.getFields()[fieldName];
        }
        const responseName =
          selection.alias ? selection.alias.value : fieldName;
        if (!_astAndDefs[responseName]) {
          _astAndDefs[responseName] = [];
        }
        _astAndDefs[responseName].push([ parentType, selection, fieldDef ]);
        break;
      case INLINE_FRAGMENT:
        const typeCondition = selection.typeCondition;
        const inlineFragmentType = typeCondition ?
          typeFromAST(context.getSchema(), selection.typeCondition) :
          parentType;
        _astAndDefs = collectFieldASTsAndDefs(
          context,
          ((inlineFragmentType: any): GraphQLNamedType),
          selection.selectionSet,
          _visitedFragmentNames,
          _astAndDefs
        );
        break;
      case FRAGMENT_SPREAD:
        const fragName = selection.name.value;
        if (_visitedFragmentNames[fragName]) {
          continue;
        }
        _visitedFragmentNames[fragName] = true;
        const fragment = context.getFragment(fragName);
        if (!fragment) {
          continue;
        }
        const fragmentType =
          typeFromAST(context.getSchema(), fragment.typeCondition);
        _astAndDefs = collectFieldASTsAndDefs(
          context,
          ((fragmentType: any): GraphQLNamedType),
          fragment.selectionSet,
          _visitedFragmentNames,
          _astAndDefs
        );
        break;
    }
  }
  return _astAndDefs;
}

/**
 * A way to keep track of pairs of things when the ordering of the pair does
 * not matter. We do this by maintaining a sort of double adjacency sets.
 */
class PairSet {
  _data: Map<any, Set<any>>;

  constructor() {
    this._data = new Map();
  }

  has(a, b) {
    const first = this._data.get(a);
    return first && first.has(b);
  }

  add(a, b) {
    _pairSetAdd(this._data, a, b);
    _pairSetAdd(this._data, b, a);
  }
}

function _pairSetAdd(data, a, b) {
  let set = data.get(a);
  if (!set) {
    set = new Set();
    data.set(a, set);
  }
  set.add(b);
}
