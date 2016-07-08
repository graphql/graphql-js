/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';
import { astFromValue } from '../utilities/astFromValue';
import { print } from '../language/printer';
import type { GraphQLSchema } from '../type/schema';
import type { GraphQLType } from '../type/definition';
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../type/definition';
import { GraphQLString } from '../type/scalars';
import { DEFAULT_DEPRECATION_REASON } from '../type/directives';


type printStyle = 'alphabet' | 'hierarchy';
export function printSchema(
  schema: GraphQLSchema,style: printStyle = 'alphabet'): string {
  switch (style) {
    case 'hierarchy':
      return printFineSchema(schema, n => !isSpecDirective(n));
    case 'alphabet':
    default:
      return printFilteredSchema(schema, n => !isSpecDirective(n),
      isDefinedType);
  }
}

export function printIntrospectionSchema(schema: GraphQLSchema): string {
  return printFilteredSchema(schema, isSpecDirective, isIntrospectionType);
}

function isSpecDirective(directiveName: string): boolean {
  return (
    directiveName === 'skip' ||
    directiveName === 'include' ||
    directiveName === 'deprecated'
  );
}

function isDefinedType(typename: string): boolean {
  return !isIntrospectionType(typename) && !isBuiltInScalar(typename);
}

function isIntrospectionType(typename: string): boolean {
  return typename.indexOf('__') === 0;
}

function isBuiltInScalar(typename: string): boolean {
  return (
    typename === 'String' ||
    typename === 'Boolean' ||
    typename === 'Int' ||
    typename === 'Float' ||
    typename === 'ID'
  );
}

function printFilteredSchema(
  schema: GraphQLSchema,
  directiveFilter: (type: string) => boolean,
  typeFilter: (type: string) => boolean
): string {
  const directives = schema.getDirectives()
    .filter(directive => directiveFilter(directive.name));
  const typeMap = schema.getTypeMap();
  const types = Object.keys(typeMap)
    .filter(typeFilter)
    .sort((name1, name2) => name1.localeCompare(name2))
    .map(typeName => typeMap[typeName]);
  return [ printSchemaDefinition(schema) ].concat(
    directives.map(printDirective),
    types.map(printType)
  ).join('\n\n') + '\n';
}

function printSchemaDefinition(schema: GraphQLSchema): string {
  const operationTypes = [];

  const queryType = schema.getQueryType();
  if (queryType) {
    operationTypes.push(`  query: ${queryType.name}`);
  }

  const mutationType = schema.getMutationType();
  if (mutationType) {
    operationTypes.push(`  mutation: ${mutationType.name}`);
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType) {
    operationTypes.push(`  subscription: ${subscriptionType.name}`);
  }

  return `schema {\n${operationTypes.join('\n')}\n}`;
}

function printType(type: GraphQLType): string {
  if (type instanceof GraphQLScalarType) {
    return printScalar(type);
  } else if (type instanceof GraphQLObjectType) {
    return printObject(type);
  } else if (type instanceof GraphQLInterfaceType) {
    return printInterface(type);
  } else if (type instanceof GraphQLUnionType) {
    return printUnion(type);
  } else if (type instanceof GraphQLEnumType) {
    return printEnum(type);
  }
  invariant(type instanceof GraphQLInputObjectType);
  return printInputObject(type);
}

function printScalar(type: GraphQLScalarType): string {
  return `scalar ${type.name}`;
}

function printObject(type: GraphQLObjectType): string {
  const interfaces = type.getInterfaces();
  const implementedInterfaces = interfaces.length ?
    ' implements ' + interfaces.map(i => i.name).join(', ') : '';
  return `type ${type.name}${implementedInterfaces} {\n` +
    printFields(type) + '\n' +
  '}';
}

function printInterface(type: GraphQLInterfaceType): string {
  return `interface ${type.name} {\n` +
    printFields(type) + '\n' +
  '}';
}

function printUnion(type: GraphQLUnionType): string {
  return `union ${type.name} = ${type.getTypes().join(' | ')}`;
}

function printEnum(type: GraphQLEnumType): string {
  const values = type.getValues();
  return `enum ${type.name} {\n` +
    values.map(v => '  ' + v.name + printDeprecated(v)).join('\n') + '\n' +
  '}';
}

function printInputObject(type: GraphQLInputObjectType): string {
  const fieldMap = type.getFields();
  const fields = Object.keys(fieldMap).map(fieldName => fieldMap[fieldName]);
  return `input ${type.name} {\n` +
    fields.map(f => '  ' + printInputValue(f)).join('\n') + '\n' +
  '}';
}

function printFields(type) {
  const fieldMap = type.getFields();
  const fields = Object.keys(fieldMap).map(fieldName => fieldMap[fieldName]);
  return fields.map(
    f => '  ' + f.name + printArgs(f) + ': ' +
      String(f.type) + printDeprecated(f)
  ).join('\n');
}

function printDeprecated(fieldOrEnumVal) {
  const reason = fieldOrEnumVal.deprecationReason;
  if (isNullish(reason)) {
    return '';
  }
  if (
    reason === '' ||
    reason === DEFAULT_DEPRECATION_REASON
  ) {
    return ' @deprecated';
  }
  return ' @deprecated(reason: ' +
    print(astFromValue(reason, GraphQLString)) + ')';
}

function printArgs(fieldOrDirectives) {
  if (fieldOrDirectives.args.length === 0) {
    return '';
  }
  return '(' + fieldOrDirectives.args.map(printInputValue).join(', ') + ')';
}

function printInputValue(arg) {
  let argDecl = arg.name + ': ' + String(arg.type);
  if (!isNullish(arg.defaultValue)) {
    argDecl += ` = ${print(astFromValue(arg.defaultValue, arg.type))}`;
  }
  return argDecl;
}

function printDirective(directive) {
  return 'directive @' + directive.name + printArgs(directive) +
    ' on ' + directive.locations.join(' | ');
}

function printFineSchema(
  schema: GraphQLSchema,
  directiveFilter: (type: string) => boolean = (n => !isSpecDirective(n))
): string {
  const directives = schema.getDirectives()
  .filter(directive => directiveFilter(directive.name));
  const typeMap = schema.getTypeMap();
  const orderedNames = getOrderedNamesBySchema(schema);
  const types = orderedNames.map(orderedName => typeMap[orderedName]);
  return [ directives.map(printDirective) ].concat(
    types.map(printType),
    printSchemaDefinition(schema)
  ).join('\n\n') + '\n';
}

function getOrderedNamesBySchema(schema) {
  const typeMap = schema.getTypeMap();
  const rootQuery = schema.getQueryType();
  const definedTypeNames = Object.keys(typeMap).filter(isDefinedType);

  // use a big number 999999 to save some condition operator ~_~
  // todo should modify the magic 999999
  const typeNamesMap = arrayToMap(definedTypeNames,99999);
  // give each type used by 'Query' a level number
  const queryMaps = levelTypeNames(rootQuery.name,typeNamesMap,schema);
  let unLeveledNamesMap = queryMaps.unLeveledNamesMap;
  const leveledNamesMap = queryMaps.leveledNamesMap;
  let orderedNames = flatNamesMapToArray(leveledNamesMap);

  const rootMutation = schema.getMutationType();
  if (rootMutation) {
    // give level number to the rest unLeveled type
    // which used by Mutations
    const restNamesMap = levelTypeNames(rootMutation.name,
      unLeveledNamesMap,schema);
    const orderedMutations =
      flatNamesMapToArray(restNamesMap.leveledNamesMap);

    orderedNames = [ ...orderedNames,...orderedMutations ];
    unLeveledNamesMap = restNamesMap.unLeveledNamesMap;
  }

  // todo throw a error .. should have none unknown type
  const theNamesIDontKnown = flatNamesMapToArray(unLeveledNamesMap);
  if (theNamesIDontKnown.length > 0) {
    orderedNames = [ ...theNamesIDontKnown,...orderedNames ];
  }
  return orderedNames;
}

function flatNamesMapToArray(leveledNamesMap: Map<*, *>): Array<string> {
  const levelToNamesMap = flipMap(leveledNamesMap);
  const nameLevels = Array.from(levelToNamesMap.keys());
  nameLevels.sort((pre,next) => ( next - pre ));
  let orderedNames = [];
  for (const level of nameLevels) {
    const levelNames = levelToNamesMap.get(level);
    if (levelNames) {
      // sort the same level names . to get a certainly order.
      levelNames.sort((name1, name2) => name1.localeCompare(name2));
      orderedNames = orderedNames.concat(levelNames);
    } else {
      throw new Error(`printFineSchema.getOrderedNamesFromMap:
      level[${level}] have no names,it should have`);
    }
  }
  return orderedNames;
}

type NamesMap = {
  leveledNamesMap:Map<*, *>,
  unLeveledNamesMap:Map<*, *>,
};

// calculate level values for each type names by their reference to each other
function levelTypeNames(rootName: string,namesMapToBeLeveled: Map<*, *>,
                        schema: GraphQLSchema): NamesMap {
  const typeMap = schema.getTypeMap();
  const unLeveledNamesMap = new Map(namesMapToBeLeveled);
  const leveledNamesMap = new Map();
  // use a map to watch circle ref,Depth-first search
  const circleRef = new Map();

  unLeveledNamesMap.delete(rootName);
  leveledNamesMap.set(rootName,0);
  _levelTypeNames(rootName,1);
  function _levelTypeNames(thisName,childLevel) {
    const childrenNames = getRefedTypes(typeMap[thisName]);
    for (const childName of childrenNames) {
      const currentLevel = leveledNamesMap.get(childName);
      if (// meet a circle ref,skip
      circleRef.get(childName) ||
        // this type is not belong to current process,skip
      namesMapToBeLeveled.get(childName) === undefined ||
        //  if [the level of leveled Name] >= [current level]
        // must skip,level is always up~ no downgrade
      (currentLevel && currentLevel >= childLevel)
      ) {
        continue;
      }
      circleRef.set(childName,childLevel);

      leveledNamesMap.set(childName,childLevel);
      unLeveledNamesMap.delete(childName);
      _levelTypeNames(childName,childLevel + 1);

      circleRef.delete(childName);
    }
  }

  return {unLeveledNamesMap,leveledNamesMap};
}

// always return an array ,if get none,just return []
// three sources of reference from a type.
// field itself, args of a fields,interface
function getRefedTypes(type: any): Array<string> {
  let refedTypeNames = [];
  if (!isDefinedType(type.name) ||
      // as i known ~_~,if there is no Fields
      // this type can not ref other types inside
    !(type.getFields instanceof Function)
  ) {
    return refedTypeNames;
  }

  const fields = type.getFields();
  // 1/2 get refed type name from fields
  Object.keys(fields).map( fieldKey => fields[fieldKey])
    .filter(field => isDefinedType(getTypeName(field.type) ) )
    .map(field => {
      refedTypeNames = refedTypeNames.concat(
        // 1. get type name from args of a field
        // in javascript, can not use instanceof to check a String type!
        // must use typeof!
        field.args.map(arg => getDefinedTypeNameByType(arg.type))
          .filter(value => (typeof value === 'string')) ,
        // 2. get type name from field itself
        getDefinedTypeNameByType(field.type) || []
      );
    });

  // 3. get type name from interfaces
  if (type.getInterfaces instanceof Function) {
    for (const interfaceType of type.getInterfaces()) {
      refedTypeNames.push(interfaceType.name);
    }
  }
  return refedTypeNames;

}

function arrayToMap(_array: Array<string>,
                    defaultValue: number): Map<string, number> {
  const _map = new Map();
  for (const v of _array) {
    _map.set(v,defaultValue);
  }
  return _map;
}

function flipMap(_srcMap: Map<string, number>): Map<number, Array<string>> {
  const _outMap = new Map();
  for (const [ oldKey,vToKey ] of _srcMap) {
    const subArray = _outMap.get(vToKey);
    if ( subArray ) {
      subArray.push(oldKey);
    } else {
      _outMap.set(vToKey,[ oldKey ]);
    }
  }
  return _outMap;
}

function getTypeName(type: any): string {
  const typeString = type.constructor.name;
  let name = type.name;
  if (typeString === 'GraphQLNonNull' || typeString === 'GraphQLList' ) {
    name = getTypeName(type.ofType);
  }
  if ( name === undefined && isDefinedType(type)) {
    // if still can not get name,
    // this type must be something i dont known ,throw to learn
    throw new Error(`Unknown type its javascript class is
      [ [${type.constructor.name}] ${type.ofType.constructor.name}]`);
  }
  return name;
}

function getDefinedTypeNameByType(TypeObj: GraphQLType): ?string {
  const typeName = getTypeName(TypeObj);
  if (isDefinedType(typeName)) {
    return typeName;
  }
  return null;
}
