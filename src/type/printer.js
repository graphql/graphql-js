/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

var TypeKind = {
  SCALAR: 'SCALAR',
  OBJECT: 'OBJECT',
  INTERFACE: 'INTERFACE',
  UNION: 'UNION',
  ENUM: 'ENUM',
  INPUT_OBJECT: 'INPUT_OBJECT',
  LIST: 'LIST',
  NON_NULL: 'NON_NULL',
};

// e.g Int, Int!, [Int!]!
function printTypeDecl(type) {
  if (type.ofType === undefined || type.ofType === null) {
    return type.name;
  }
  if (type.kind === TypeKind.LIST) {
    return '[' + printTypeDecl(type.ofType) + ']';
  } else if (type.kind === TypeKind.NON_NULL) {
    return printTypeDecl(type.ofType) + '!';
  }
  throw new Error('unexpected');
}

function printField(field) {
  return `${field.name}${printArgs(field)}: ${printTypeDecl(field.type)}`;
}

function printArg(arg) {
  var argDecl = `${arg.name}: ${printTypeDecl(arg.type)}`;
  if (arg.defaultValue !== null) {
    argDecl += ` = ${arg.defaultValue}`;
  }
  return argDecl;
}

function printArgs(field) {
  if (field.args.length === 0) {
    return '';
  }
  return '(' + field.args.map(printArg).join(', ') + ')';
}

function printFields(fields) {
  return fields.map(f => '  ' + printField(f)).join('\n');
  // var strs = [];
  // fields.forEach(field => {
  //   strs.push('  ' + printField(field));
  // });
  // return strs.join('\n');
}

function printIfaceList(type) {
  if (type.interfaces.length === 0) {
    return '';
  }
  return ' : ' + type.interfaces.map(i => i.name).join(', ');
}

function printObject(type) {
  return `type ${type.name}${printIfaceList(type)} {` + '\n' +
    printFields(type.fields) + '\n' +
  '}';
}

function printInterface(type) {
  return `interface ${type.name} {` + '\n' +
    printFields(type.fields) + '\n' +
  '}';
}

function printInputObject(type) {
  return `input ${type.name} {` + '\n' +
    printFields(type.fields) + '\n' +
  '}';
}

function printUnion(type) {
  var typeList = type.possibleTypes.map(t => t.name).join(' | ');
  return `union ${type.name} = ${typeList}`;
}

function printScalar(type) {
  return `scalar ${type.name}`;
}

function printEnumValues(values) {
  return values.map(v => '  ' + v.name).join('\n');
}

function printEnum(type) {
  return `enum ${type.name} {
${printEnumValues(type.enumValues)}
}`;
}

function printType(type) {
  switch (type.kind) {
    case TypeKind.OBJECT:
      return printObject(type);
    case TypeKind.UNION:
      return printUnion(type);
    case TypeKind.INTERFACE:
      return printInterface(type);
    case TypeKind.INPUT_OBJECT:
      return printInputObject(type);
    case TypeKind.SCALAR:
      return printScalar(type);
    case TypeKind.ENUM:
      return printEnum(type);
    default:
      throw new Error('Invalid kind: ' + type.kind);
  }
}

function isIntrospectionType(type) {
  return type.name.startsWith('__');
}

function isBuiltIn(type) {
  var name = type.name;
  if (isIntrospectionType(type)) {
    return true;
  }

  return name === 'String' || name === 'Boolean' || name === 'Int';
}

export function printSchema(introspectionResult) {
  var schema = introspectionResult.data.__schema;
  var types = schema.types.filter(t => !isBuiltIn(t));
  types = types.sort((t1, t2) => t1.name.localeCompare(t2.name));
  return types.map(printType).join('\n\n');
}

export function printIntrospectionSchema(introspectionResult) {
  var schema = introspectionResult.data.__schema;
  var types = schema.types.filter(t => isIntrospectionType(t));
  types = types.sort((t1, t2) => t1.name.localeCompare(t2.name));
  return types.map(printType).join('\n\n');
}
