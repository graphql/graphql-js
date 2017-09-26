/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { DirectiveLocationEnum } from '../type/directives';


export const introspectionQuery = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
      directives {
        name
        description
        locations
        args {
          ...InputValue
        }
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

export type IntrospectionQuery = {
  __schema: IntrospectionSchema
};

export type IntrospectionSchema = {
  queryType: IntrospectionNamedTypeRef;
  mutationType: ?IntrospectionNamedTypeRef;
  subscriptionType: ?IntrospectionNamedTypeRef;
  types: Array<IntrospectionType>;
  directives: Array<IntrospectionDirective>;
};

export type IntrospectionType =
  | IntrospectionScalarType
  | IntrospectionObjectType
  | IntrospectionInterfaceType
  | IntrospectionUnionType
  | IntrospectionEnumType
  | IntrospectionInputObjectType;

export type IntrospectionScalarType = {
  kind: 'SCALAR';
  name: string;
  description: ?string;
};

export type IntrospectionObjectType = {
  kind: 'OBJECT';
  name: string;
  description: ?string;
  fields: Array<IntrospectionField>;
  interfaces: Array<IntrospectionNamedTypeRef>;
};

export type IntrospectionInterfaceType = {
  kind: 'INTERFACE';
  name: string;
  description: ?string;
  fields: Array<IntrospectionField>;
  possibleTypes: Array<IntrospectionNamedTypeRef>;
};

export type IntrospectionUnionType = {
  kind: 'UNION';
  name: string;
  description: ?string;
  possibleTypes: Array<IntrospectionNamedTypeRef>;
};

export type IntrospectionEnumType = {
  kind: 'ENUM';
  name: string;
  description: ?string;
  enumValues: Array<IntrospectionEnumValue>;
};

export type IntrospectionInputObjectType = {
  kind: 'INPUT_OBJECT';
  name: string;
  description: ?string;
  inputFields: Array<IntrospectionInputValue>;
};

export type IntrospectionTypeRef =
  | IntrospectionNamedTypeRef
  | IntrospectionListTypeRef
  | IntrospectionNonNullTypeRef;

export type IntrospectionNamedTypeRef = {
  kind: string;
  name: string;
};

export type IntrospectionListTypeRef = {
  kind: 'LIST';
  ofType?: IntrospectionTypeRef;
};

export type IntrospectionNonNullTypeRef = {
  kind: 'NON_NULL';
  ofType?: IntrospectionTypeRef;
};

export type IntrospectionField = {
  name: string;
  description: ?string;
  args: Array<IntrospectionInputValue>;
  type: IntrospectionTypeRef;
  isDeprecated: boolean;
  deprecationReason: ?string;
};

export type IntrospectionInputValue = {
  name: string;
  description: ?string;
  type: IntrospectionTypeRef;
  defaultValue: ?string;
};

export type IntrospectionEnumValue = {
  name: string;
  description: ?string;
  isDeprecated: boolean;
  deprecationReason: ?string;
};

export type IntrospectionDirective = {
  name: string;
  description: ?string;
  locations: Array<DirectiveLocationEnum>;
  args: Array<IntrospectionInputValue>;
};
