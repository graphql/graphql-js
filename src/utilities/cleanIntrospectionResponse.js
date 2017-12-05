/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

'use strict';

import { TypeKind } from '../type/introspection';
import type {
  IntrospectionDirective,
  IntrospectionField,
  IntrospectionInputTypeRef,
  IntrospectionInputValue,
  IntrospectionOutputTypeRef,
  IntrospectionQuery,
  IntrospectionType,
} from './introspectionQuery';
import type { DirectiveLocationEnum } from '../language/directiveLocation';

import invariant from 'invariant';

type RawIntrospectionResponse = {
  __schema: {
    queryType: { name: string },
    mutationType: ?{ name: string },
    subscriptionType: ?{ name: string },
    types: Array<RawIntrospectionFullType>,
    directives: Array<RawIntrospectionDirective>,
  },
};
type RawIntrospectionDirective = {
  name: string,
  description: ?string,
  locations: Array<DirectiveLocationEnum>,
  args: Array<RawIntrospectionInputValue>,
};
type RawIntrospectionFullType = {
  kind: $Keys<typeof TypeKind>,
  name: string,
  description: ?string,
  fields: ?Array<RawIntrospectionField>,
  inputFields: ?Array<RawIntrospectionInputValue>,
  interfaces: ?Array<RawIntrospectionTypeRef>,
  enumValues: ?Array<RawIntrospectionEnumValue>,
  possibleTypes: ?Array<RawIntrospectionTypeRef>,
};
type RawIntrospectionField = {
  name: string,
  description: ?string,
  args: Array<RawIntrospectionInputValue>,
  type: RawIntrospectionTypeRef,
  isDeprecated: boolean,
  deprecationReason: ?string,
};
type RawIntrospectionEnumValue = {
  name: string,
  description: ?string,
  isDeprecated: boolean,
  deprecationReason: ?string,
};
type RawIntrospectionInputValue = {
  name: string,
  description: ?string,
  type: RawIntrospectionTypeRef,
  defaultValue: ?string,
};
type RawIntrospectionTypeRef = {
  kind: $Keys<typeof TypeKind>,
  name: ?string,
  ofType: ?RawIntrospectionTypeRef,
};

/**
 * When receiving an IntrospectionQuery response, there will be many null
 * fields on types that can only have null values. For instance,
 * 'IntrospectionListType' will have a 'name: null' field.
 *
 * Similarly, we may not request certain fields, like the 'kind' field on
 * '__schema.queryType'. While not strictly necessary for the response,
 * it's easier to work with a TypeRef when the reference exactly matches the
 * declared. 'IntrospectionTypeRef'
 *
 * To make 'IntrospectionQuery' easier to work with, we provide a utility for
 * cleaning the "raw response" objects, and producing a new,
 * exactly-type-matching IntrospectionQuery.
 */
export function cleanIntrospectionResponse(
  response: RawIntrospectionResponse,
): IntrospectionQuery {
  const raw = response.__schema;
  return {
    __schema: {
      queryType: objectTypeRef(raw.queryType.name),
      mutationType: raw.mutationType && objectTypeRef(raw.mutationType.name),
      subscriptionType:
        raw.subscriptionType && objectTypeRef(raw.subscriptionType.name),
      directives: raw.directives.map(getDirective),
      types: raw.types.map(getType),
    },
  };
}

function getType(raw: RawIntrospectionFullType): IntrospectionType {
  switch (raw.kind) {
    case TypeKind.SCALAR:
      return {
        kind: TypeKind.SCALAR,
        name: raw.name,
        description: raw.description,
      };
    case TypeKind.ENUM:
      const rawEnumValues = raw.enumValues;
      invariant(rawEnumValues, `Enum ${raw.name} has no enumValues`);
      return {
        kind: TypeKind.ENUM,
        name: raw.name,
        description: raw.description,
        enumValues: rawEnumValues.map(enumValue => {
          return {
            name: enumValue.name,
            description: enumValue.description,
            isDeprecated: enumValue.isDeprecated,
            deprecationReason: enumValue.deprecationReason,
          };
        }),
      };
    case TypeKind.OBJECT:
      const rawFields = raw.fields;
      invariant(rawFields, `Object ${raw.name} has null fields`);
      const rawInterfaces = raw.interfaces;
      invariant(rawInterfaces, `Object ${raw.name} has null interfaces`);
      return {
        kind: TypeKind.OBJECT,
        name: raw.name,
        description: raw.description,
        fields: rawFields.map(getField),
        interfaces: rawInterfaces.map(iface => {
          invariant(iface.name, 'Unnamed Interface');
          return { kind: TypeKind.INTERFACE, name: iface.name };
        }),
      };
    case TypeKind.INTERFACE:
      const rawInterfaceFields = raw.fields;
      invariant(rawInterfaceFields, `Interface ${raw.name} has null fields`);
      const rawPossibleTypes = raw.possibleTypes;
      invariant(
        rawPossibleTypes,
        `Interface ${raw.name} has null possibleTypes`,
      );
      return {
        kind: TypeKind.INTERFACE,
        name: raw.name,
        description: raw.description,
        fields: rawInterfaceFields.map(getField),
        possibleTypes: rawPossibleTypes.map(obj => {
          invariant(obj.name, 'Unnamed Object');
          return { kind: TypeKind.OBJECT, name: obj.name };
        }),
      };
    case TypeKind.UNION:
      const rawUnionTypes = raw.possibleTypes;
      invariant(rawUnionTypes, `Union ${raw.name} has null possibleTypes`);
      return {
        kind: TypeKind.UNION,
        name: raw.name,
        description: raw.description,
        possibleTypes: rawUnionTypes.map(obj => {
          invariant(obj.name, 'Unnamed Object');
          return { kind: TypeKind.OBJECT, name: obj.name };
        }),
      };
    case TypeKind.INPUT_OBJECT:
      const rawInputFields = raw.inputFields;
      invariant(
        rawInputFields,
        `Input Object ${raw.name} has null inputFields`,
      );
      return {
        kind: TypeKind.INPUT_OBJECT,
        name: raw.name,
        description: raw.description,
        inputFields: rawInputFields.map(getInputValue),
      };
    default:
      throw new Error(`Unknown named type: ${raw.kind}`);
  }
}

function getDirective(raw: RawIntrospectionDirective): IntrospectionDirective {
  return {
    name: raw.name,
    description: raw.description,
    locations: raw.locations,
    args: raw.args.map(getInputValue),
  };
}

function getField(raw: RawIntrospectionField): IntrospectionField {
  return {
    name: raw.name,
    description: raw.description,
    args: raw.args.map(getInputValue),
    type: getOutputTypeRef(raw.type),
    isDeprecated: raw.isDeprecated,
    deprecationReason: raw.deprecationReason,
  };
}

function getInputValue(
  raw: RawIntrospectionInputValue,
): IntrospectionInputValue {
  return {
    name: raw.name,
    description: raw.description,
    type: getInputTypeRef(raw.type),
    defaultValue: raw.defaultValue,
  };
}

function getInputTypeRef(
  raw: RawIntrospectionTypeRef,
): IntrospectionInputTypeRef {
  switch (raw.kind) {
    case TypeKind.LIST:
      const listOf = raw.ofType;
      if (!listOf) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      return { kind: TypeKind.LIST, ofType: getInputTypeRef(listOf) };

    case TypeKind.NON_NULL:
      const childTypeRef = raw.ofType;
      invariant(
        childTypeRef,
        'Decorated type deeper than introspection query.',
      );
      const nonNullOf = getInputTypeRef(childTypeRef);
      invariant(
        nonNullOf.kind !== TypeKind.NON_NULL,
        'NonNull ofType is a NonNull',
      );
      return { kind: TypeKind.NON_NULL, ofType: nonNullOf };

    case TypeKind.SCALAR:
    case TypeKind.ENUM:
    case TypeKind.INPUT_OBJECT:
      const name = raw.name;
      invariant(name, `Unnamed ${raw.kind} type`);
      return { kind: introspectionInputKind(raw.kind), name };
    default:
      throw new Error(`Unknown input type: ${raw.kind}`);
  }
}

function getOutputTypeRef(
  raw: RawIntrospectionTypeRef,
): IntrospectionOutputTypeRef {
  switch (raw.kind) {
    case TypeKind.LIST:
      const listOf = raw.ofType;
      if (!listOf) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      return { kind: TypeKind.LIST, ofType: getOutputTypeRef(listOf) };

    case TypeKind.NON_NULL:
      const childTypeRef = raw.ofType;
      invariant(
        childTypeRef,
        'Decorated type deeper than introspection query.',
      );
      const nonNullOf = getOutputTypeRef(childTypeRef);
      invariant(
        nonNullOf.kind !== TypeKind.NON_NULL,
        'NonNull ofType is a NonNull',
      );
      return { kind: TypeKind.NON_NULL, ofType: nonNullOf };

    case TypeKind.SCALAR:
    case TypeKind.ENUM:
    case TypeKind.OBJECT:
    case TypeKind.INTERFACE:
    case TypeKind.UNION:
      const name = raw.name;
      invariant(name, `Unnamed ${raw.kind} type`);
      return { kind: introspectionOutputKind(raw.kind), name };
    default:
      throw new Error(`Unknown output type: ${raw.kind}`);
  }
}

function objectTypeRef(name: string) {
  return { kind: TypeKind.OBJECT, name };
}

function introspectionOutputKind(kind: string) {
  if (kind === TypeKind.OBJECT) {
    return TypeKind.OBJECT;
  } else if (kind === TypeKind.INTERFACE) {
    return TypeKind.INTERFACE;
  } else if (kind === TypeKind.UNION) {
    return TypeKind.UNION;
  } else if (kind === TypeKind.SCALAR) {
    return TypeKind.SCALAR;
  } else if (kind === TypeKind.ENUM) {
    return TypeKind.ENUM;
  }
  throw new Error(`No known output type for ${kind}`);
}

function introspectionInputKind(kind: string) {
  if (kind === TypeKind.SCALAR) {
    return TypeKind.SCALAR;
  } else if (kind === TypeKind.ENUM) {
    return TypeKind.ENUM;
  } else if (kind === TypeKind.INPUT_OBJECT) {
    return TypeKind.INPUT_OBJECT;
  }
  throw new Error(`No known type for ${kind}`);
}
