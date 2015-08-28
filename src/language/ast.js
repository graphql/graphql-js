/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import type { Source } from './source';


/**
 * Contains a range of UTF-8 character offsets that identify
 * the region of the source from which the AST derived.
 */
export type Location = {
  start: number;
  end: number;
  source?: ?Source
}

/**
 * The list of all possible AST node types.
 */
export type Node = Name
                 | RequestDocument
                 | OperationDefinition
                 | VariableDefinition
                 | Variable
                 | SelectionSet
                 | Field
                 | Argument
                 | FragmentSpread
                 | InlineFragment
                 | FragmentDefinition
                 | IntValue
                 | FloatValue
                 | StringValue
                 | BooleanValue
                 | EnumValue
                 | ListValue
                 | ObjectValue
                 | ObjectField
                 | Directive
                 | ListType
                 | NonNullType

// Name

export type Name = {
  kind: 'Name';
  loc?: ?Location;
  value: string;
}

// RequestDocument

export type RequestDocument = {
  kind: 'RequestDocument';
  loc?: ?Location;
  definitions: Array<RequestDefinition>;
}

export type RequestDefinition = OperationDefinition
                              | FragmentDefinition

export type OperationDefinition = {
  kind: 'OperationDefinition';
  loc?: ?Location;
  operation: 'query' | 'mutation';
  name?: ?Name;
  variableDefinitions?: ?Array<VariableDefinition>;
  directives?: ?Array<Directive>;
  selectionSet: SelectionSet;
}

export type VariableDefinition = {
  kind: 'VariableDefinition';
  loc?: ?Location;
  variable: Variable;
  type: Type;
  defaultValue?: ?Value;
}

export type Variable = {
  kind: 'Variable';
  loc?: ?Location;
  name: Name;
}

export type SelectionSet = {
  kind: 'SelectionSet';
  loc?: ?Location;
  selections: Array<Selection>;
}

export type Selection = Field
                      | FragmentSpread
                      | InlineFragment

export type Field = {
  kind: 'Field';
  loc?: ?Location;
  alias?: ?Name;
  name: Name;
  arguments?: ?Array<Argument>;
  directives?: ?Array<Directive>;
  selectionSet?: ?SelectionSet;
}

export type Argument = {
  kind: 'Argument';
  loc?: ?Location;
  name: Name;
  value: Value;
}


// Fragments

export type FragmentSpread = {
  kind: 'FragmentSpread';
  loc?: ?Location;
  name: Name;
  directives?: ?Array<Directive>;
}

export type InlineFragment = {
  kind: 'InlineFragment';
  loc?: ?Location;
  typeCondition: NamedType;
  directives?: ?Array<Directive>;
  selectionSet: SelectionSet;
}

export type FragmentDefinition = {
  kind: 'FragmentDefinition';
  loc?: ?Location;
  name: Name;
  typeCondition: NamedType;
  directives?: ?Array<Directive>;
  selectionSet: SelectionSet;
}


// Values

export type Value = Variable
                  | IntValue
                  | FloatValue
                  | StringValue
                  | BooleanValue
                  | EnumValue
                  | ListValue
                  | ObjectValue

export type IntValue = {
  kind: 'IntValue';
  loc?: ?Location;
  value: string;
}

export type FloatValue = {
  kind: 'FloatValue';
  loc?: ?Location;
  value: string;
}

export type StringValue = {
  kind: 'StringValue';
  loc?: ?Location;
  value: string;
}

export type BooleanValue = {
  kind: 'BooleanValue';
  loc?: ?Location;
  value: boolean;
}

export type EnumValue = {
  kind: 'EnumValue';
  loc?: ?Location;
  value: string;
}

export type ListValue = {
  kind: 'ListValue';
  loc?: ?Location;
  values: Array<Value>;
}

export type ObjectValue = {
  kind: 'ObjectValue';
  loc?: ?Location;
  fields: Array<ObjectField>;
}

export type ObjectField = {
  kind: 'ObjectField';
  loc?: ?Location;
  name: Name;
  value: Value;
}


// Directives

export type Directive = {
  kind: 'Directive';
  loc?: ?Location;
  name: Name;
  arguments?: ?Array<Argument>;
}


// Types

export type Type = NamedType
                 | ListType
                 | NonNullType

export type NamedType = {
  kind: 'NamedType';
  loc?: ?Location;
  name: Name;
};

export type ListType = {
  kind: 'ListType';
  loc?: ?Location;
  type: Type;
}

export type NonNullType = {
  kind: 'NonNullType';
  loc?: ?Location;
  type: NamedType | ListType;
}
