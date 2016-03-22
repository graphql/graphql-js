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
                 | Document
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
                 | NamedType
                 | ListType
                 | NonNullType
                 | SchemaDefinition
                 | OperationTypeDefinition
                 | ScalarTypeDefinition
                 | ObjectTypeDefinition
                 | FieldDefinition
                 | InputValueDefinition
                 | InterfaceTypeDefinition
                 | UnionTypeDefinition
                 | EnumTypeDefinition
                 | EnumValueDefinition
                 | InputObjectTypeDefinition
                 | TypeExtensionDefinition
                 | DirectiveDefinition

// Name

export type Name = {
  kind: 'Name';
  loc?: ?Location;
  value: string;
}

// Document

export type Document = {
  kind: 'Document';
  loc?: ?Location;
  definitions: Array<Definition>;
}

export type Definition = OperationDefinition
                       | FragmentDefinition
                       | TypeSystemDefinition // experimental non-spec addition.

export type OperationDefinition = {
  kind: 'OperationDefinition';
  loc?: ?Location;
  operation: OperationType;
  name?: ?Name;
  variableDefinitions?: ?Array<VariableDefinition>;
  directives?: ?Array<Directive>;
  selectionSet: SelectionSet;
}

// Note: subscription is an experimental non-spec addition.
export type OperationType = 'query' | 'mutation' | 'subscription';

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
  typeCondition?: ?NamedType;
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


// Type Reference

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

// Type System Definition

export type TypeSystemDefinition = SchemaDefinition
                                 | TypeDefinition
                                 | TypeExtensionDefinition
                                 | DirectiveDefinition

export type SchemaDefinition = {
  kind: 'SchemaDefinition';
  loc?: ?Location;
  operationTypes: Array<OperationTypeDefinition>;
}

export type OperationTypeDefinition = {
  kind: 'OperationTypeDefinition';
  loc?: ?Location;
  operation: OperationType;
  type: NamedType;
}

export type TypeDefinition = ScalarTypeDefinition
                           | ObjectTypeDefinition
                           | InterfaceTypeDefinition
                           | UnionTypeDefinition
                           | EnumTypeDefinition
                           | InputObjectTypeDefinition

export type ScalarTypeDefinition = {
  kind: 'ScalarTypeDefinition';
  loc?: ?Location;
  name: Name;
}

export type ObjectTypeDefinition = {
  kind: 'ObjectTypeDefinition';
  loc?: ?Location;
  name: Name;
  interfaces?: ?Array<NamedType>;
  fields: Array<FieldDefinition>;
}

export type FieldDefinition = {
  kind: 'FieldDefinition';
  loc?: ?Location;
  name: Name;
  arguments: Array<InputValueDefinition>;
  type: Type;
}

export type InputValueDefinition = {
  kind: 'InputValueDefinition';
  loc?: ?Location;
  name: Name;
  type: Type;
  defaultValue?: ?Value;
}

export type InterfaceTypeDefinition = {
  kind: 'InterfaceTypeDefinition';
  loc?: ?Location;
  name: Name;
  fields: Array<FieldDefinition>;
}

export type UnionTypeDefinition = {
  kind: 'UnionTypeDefinition';
  loc?: ?Location;
  name: Name;
  types: Array<NamedType>;
}

export type EnumTypeDefinition = {
  kind: 'EnumTypeDefinition';
  loc?: ?Location;
  name: Name;
  values: Array<EnumValueDefinition>;
}

export type EnumValueDefinition = {
  kind: 'EnumValueDefinition';
  loc?: ?Location;
  name: Name;
}

export type InputObjectTypeDefinition = {
  kind: 'InputObjectTypeDefinition';
  loc?: ?Location;
  name: Name;
  fields: Array<InputValueDefinition>;
}

export type TypeExtensionDefinition = {
  kind: 'TypeExtensionDefinition';
  loc?: ?Location;
  definition: ObjectTypeDefinition;
}

export type DirectiveDefinition = {
  kind: 'DirectiveDefinition';
  loc?: ?Location;
  name: Name;
  arguments?: ?Array<InputValueDefinition>;
  locations: Array<Name>;
}
