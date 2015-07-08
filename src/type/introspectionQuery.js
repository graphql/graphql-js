/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

export var introspectionQuery = `
  query IntrospectionTestQuery {
    schemaType: __type(name: "__Schema") {
      ...FullType
    }
    queryRootType: __type(name: "QueryRoot") {
      ...FullType
    }
    __schema {
      __typename
      types {
        ...FullType
      }
      directives {
        __typename
        name
        args {
          __typename
          name
          type { ...TypeRef }
          defaultValue
        }
        onOperation
        onFragment
        onField
      }
    }
  }

  fragment FullType on __Type {
    __typename
    kind
    name
    fields {
      __typename
      name
      args {
        __typename
        name
        type { ...TypeRef }
        defaultValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    interfaces {
      ...TypeRef
    }
    enumValues {
      __typename
      name
      isDeprecated
      deprecationReason
    }
  }

  fragment TypeRef on __Type {
    __typename
    kind
    name
    ofType {
      __typename
      kind
      name
      ofType {
        __typename
        kind
        name
        ofType {
          __typename
          kind
          name
        }
      }
    }
  }
`;

