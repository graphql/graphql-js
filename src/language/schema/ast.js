/*@flow*/
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import type {
  Location,
  Name,
  Type,
  NamedType
} from '../ast';

export type SchemaDocument = {
  kind: 'Schema Document';
  loc?: ?Location;
  definitions: Array<SchemaDefinition>;
}

export type SchemaDefinition =
  TypeDefinition |
  InterfaceDefinition |
  EnumDefinition |
  ScalarDefinition |
  InputObjectDefinition

export type TypeDefinition = {
  kind: 'TypeDefinition';
  loc?: ?Location;
  name: Name;
  interfaces?: ?Array<NamedType>;
  fields: Array<FieldDefinition>;
}

export type InterfaceDefinition = {
  kind: 'InterfaceDefinition';
  loc?: ?Location;
  name: Name;
  fields: Array<FieldDefinition>;
}

export type FieldDefinition = {
  kind: 'FieldDefinition';
  loc?: ?Location;
  name: Name;
  type: Type;
  arguments: Array<ArgumentDefinition>;
}

export type InputFieldDefinition = {
  kind: 'InputFieldDefinition';
  loc?: ?Location;
  name: Name;
  type: Type;
}

export type ArgumentDefinition = {
  kind: 'ArgumentDefinition';
  loc?: ?Location;
  name: Name;
  type: Type;
}

export type EnumDefinition = {
  kind: 'EnumDefinition';
  loc?: ?Location;
  name: Name;
  values: Array<EnumValueDefinition>;
}

export type EnumValueDefinition = {
  kind: 'EnumValueDefinition';
  loc?: ?Location;
  name: Name;
}

export type ScalarDefinition = {
  kind: 'ScalarDefinition';
  loc?: ?Location;
  name: Name;
}

export type InputObjectDefinition = {
  kind: 'InputObjectDefinition';
  loc?: ?Location;
  name: Name;
  fields: Array<InputFieldDefinition>;
}
