import type { SchemaCoordinateNode } from '../language/ast.js';
import { parseSchemaCoordinate } from '../language/parser.js';
import type { Source } from '../language/source.js';

import type {
  GraphQLArgument,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLNamedType,
} from '../type/definition.js';
import {
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
} from '../type/definition.js';
import type { GraphQLDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';

/**
 * A resolved schema element may be one of the following kinds:
 */
export type ResolvedSchemaElement =
  | {
      readonly kind: 'NamedType';
      readonly type: GraphQLNamedType;
    }
  | {
      readonly kind: 'Field';
      readonly type: GraphQLNamedType;
      readonly field: GraphQLField<unknown, unknown>;
    }
  | {
      readonly kind: 'InputField';
      readonly type: GraphQLNamedType;
      readonly inputField: GraphQLInputField;
    }
  | {
      readonly kind: 'EnumValue';
      readonly type: GraphQLNamedType;
      readonly enumValue: GraphQLEnumValue;
    }
  | {
      readonly kind: 'FieldArgument';
      readonly type: GraphQLNamedType;
      readonly field: GraphQLField<unknown, unknown>;
      readonly fieldArgument: GraphQLArgument;
    }
  | {
      readonly kind: 'Directive';
      readonly directive: GraphQLDirective;
    }
  | {
      readonly kind: 'DirectiveArgument';
      readonly directive: GraphQLDirective;
      readonly directiveArgument: GraphQLArgument;
    };

/**
 * A schema coordinate is resolved in the context of a GraphQL schema to
 * uniquely identifies a schema element. It returns undefined if the schema
 * coordinate does not resolve to a schema element.
 *
 * https://spec.graphql.org/draft/#sec-Schema-Coordinates.Semantics
 */
export function resolveSchemaCoordinate(
  schema: GraphQLSchema,
  schemaCoordinate: string | Source,
): ResolvedSchemaElement | undefined {
  return resolveASTSchemaCoordinate(
    schema,
    parseSchemaCoordinate(schemaCoordinate),
  );
}

/**
 * Resolves schema coordinate from a parsed SchemaCoordinate node.
 */
export function resolveASTSchemaCoordinate(
  schema: GraphQLSchema,
  schemaCoordinate: SchemaCoordinateNode,
): ResolvedSchemaElement | undefined {
  const { ofDirective, name, memberName, argumentName } = schemaCoordinate;
  if (ofDirective) {
    // SchemaCoordinate :
    //   - @ Name
    //   - @ Name ( Name : )
    // Let {directiveName} be the value of the first {Name}.
    // Let {directive} be the directive in the {schema} named {directiveName}.
    const directive = schema.getDirective(name.value);
    if (!argumentName) {
      // SchemaCoordinate : @ Name
      // Return the directive in the {schema} named {directiveName}.
      if (!directive) {
        return;
      }
      return { kind: 'Directive', directive };
    }

    // SchemaCoordinate : @ Name ( Name : )
    // Assert {directive} must exist.
    if (!directive) {
      return;
    }
    // Let {directiveArgumentName} be the value of the second {Name}.
    // Return the argument of {directive} named {directiveArgumentName}.
    const directiveArgument = directive.args.find(
      (arg) => arg.name === argumentName.value,
    );
    if (!directiveArgument) {
      return;
    }
    return { kind: 'DirectiveArgument', directive, directiveArgument };
  }

  // SchemaCoordinate :
  //   - Name
  //   - Name . Name
  //   - Name . Name ( Name : )
  // Let {typeName} be the value of the first {Name}.
  // Let {type} be the type in the {schema} named {typeName}.
  const type = schema.getType(name.value);
  if (!memberName) {
    // SchemaCoordinate : Name
    // Return the type in the {schema} named {typeName}.
    if (!type) {
      return;
    }
    return { kind: 'NamedType', type };
  }

  if (!argumentName) {
    // SchemaCoordinate : Name . Name
    // If {type} is an Enum type:
    if (isEnumType(type)) {
      // Let {enumValueName} be the value of the second {Name}.
      // Return the enum value of {type} named {enumValueName}.
      const enumValue = type.getValue(memberName.value);
      if (!enumValue) {
        return;
      }
      return { kind: 'EnumValue', type, enumValue };
    }
    // Otherwise if {type} is an Input Object type:
    if (isInputObjectType(type)) {
      // Let {inputFieldName} be the value of the second {Name}.
      // Return the input field of {type} named {inputFieldName}.
      const inputField = type.getFields()[memberName.value];
      if (inputField == null) {
        return;
      }
      return { kind: 'InputField', type, inputField };
    }
    // Otherwise:
    // Assert {type} must be an Object or Interface type.
    if (!isObjectType(type) && !isInterfaceType(type)) {
      return;
    }
    // Let {fieldName} be the value of the second {Name}.
    // Return the field of {type} named {fieldName}.
    const field = type.getFields()[memberName.value];
    if (field == null) {
      return;
    }
    return { kind: 'Field', type, field };
  }

  // SchemaCoordinate : Name . Name ( Name : )
  // Assert {type} must be an Object or Interface type.
  if (!isObjectType(type) && !isInterfaceType(type)) {
    return;
  }
  // Let {fieldName} be the value of the second {Name}.
  // Let {field} be the field of {type} named {fieldName}.
  const field = type.getFields()[memberName.value];
  // Assert {field} must exist.
  if (field == null) {
    return;
  }
  // Let {fieldArgumentName} be the value of the third {Name}.
  // Return the argument of {field} named {fieldArgumentName}.
  const fieldArgument = field.args.find(
    (arg) => arg.name === argumentName.value,
  );
  if (!fieldArgument) {
    return;
  }
  return { kind: 'FieldArgument', type, field, fieldArgument };
}
