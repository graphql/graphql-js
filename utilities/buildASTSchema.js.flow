/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import objectValues from '../polyfills/objectValues';
import invariant from '../jsutils/invariant';
import keyMap from '../jsutils/keyMap';
import keyValMap from '../jsutils/keyValMap';
import type { ObjMap } from '../jsutils/ObjMap';
import { valueFromAST } from './valueFromAST';
import { assertValidSDL } from '../validation/validate';
import blockStringValue from '../language/blockStringValue';
import { TokenKind } from '../language/lexer';
import { parse } from '../language/parser';
import type { ParseOptions } from '../language/parser';
import type { Source } from '../language/source';
import { getDirectiveValues } from '../execution/values';
import { Kind } from '../language/kinds';

import type {
  DocumentNode,
  NameNode,
  TypeNode,
  NamedTypeNode,
  SchemaDefinitionNode,
  TypeDefinitionNode,
  ScalarTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  EnumTypeDefinitionNode,
  EnumValueDefinitionNode,
  InputObjectTypeDefinitionNode,
  DirectiveDefinitionNode,
  StringValueNode,
  Location,
} from '../language/ast';
import { isTypeDefinitionNode } from '../language/predicates';

import type { DirectiveLocationEnum } from '../language/directiveLocation';

import type {
  GraphQLType,
  GraphQLNamedType,
  GraphQLFieldConfig,
  GraphQLArgumentConfig,
  GraphQLEnumValueConfig,
  GraphQLInputFieldConfig,
} from '../type/definition';

import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../type/definition';

import {
  GraphQLDirective,
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
} from '../type/directives';

import { introspectionTypes } from '../type/introspection';

import { specifiedScalarTypes } from '../type/scalars';

import { GraphQLSchema } from '../type/schema';
import type { GraphQLSchemaValidationOptions } from '../type/schema';

export type BuildSchemaOptions = {
  ...GraphQLSchemaValidationOptions,

  /**
   * Descriptions are defined as preceding string literals, however an older
   * experimental version of the SDL supported preceding comments as
   * descriptions. Set to true to enable this deprecated behavior.
   * This option is provided to ease adoption and will be removed in v16.
   *
   * Default: false
   */
  commentDescriptions?: boolean,

  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   */
  assumeValidSDL?: boolean,
};

/**
 * This takes the ast of a schema document produced by the parse function in
 * src/language/parser.js.
 *
 * If no schema definition is provided, then it will look for types named Query
 * and Mutation.
 *
 * Given that AST it constructs a GraphQLSchema. The resulting schema
 * has no resolve methods, so execution will use default resolvers.
 *
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
export function buildASTSchema(
  documentAST: DocumentNode,
  options?: BuildSchemaOptions,
): GraphQLSchema {
  invariant(
    documentAST && documentAST.kind === Kind.DOCUMENT,
    'Must provide valid Document AST',
  );

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    assertValidSDL(documentAST);
  }

  let schemaDef: ?SchemaDefinitionNode;
  const nodeMap: ObjMap<TypeDefinitionNode> = Object.create(null);
  const directiveDefs: Array<DirectiveDefinitionNode> = [];

  for (const def of documentAST.definitions) {
    if (def.kind === Kind.SCHEMA_DEFINITION) {
      schemaDef = def;
    } else if (isTypeDefinitionNode(def)) {
      nodeMap[def.name.value] = def;
    } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      directiveDefs.push(def);
    }
  }

  const operationTypes = schemaDef
    ? getOperationTypes(schemaDef)
    : {
        query: nodeMap.Query,
        mutation: nodeMap.Mutation,
        subscription: nodeMap.Subscription,
      };

  const definitionBuilder = new ASTDefinitionBuilder(
    nodeMap,
    options,
    typeName => {
      throw new Error(`Type "${typeName}" not found in document.`);
    },
  );

  const directives = directiveDefs.map(def =>
    definitionBuilder.buildDirective(def),
  );

  // If specified directives were not explicitly declared, add them.
  if (!directives.some(directive => directive.name === 'skip')) {
    directives.push(GraphQLSkipDirective);
  }

  if (!directives.some(directive => directive.name === 'include')) {
    directives.push(GraphQLIncludeDirective);
  }

  if (!directives.some(directive => directive.name === 'deprecated')) {
    directives.push(GraphQLDeprecatedDirective);
  }

  // Note: While this could make early assertions to get the correctly
  // typed values below, that would throw immediately while type system
  // validation with validateSchema() will produce more actionable results.
  return new GraphQLSchema({
    query: operationTypes.query
      ? (definitionBuilder.buildType(operationTypes.query): any)
      : null,
    mutation: operationTypes.mutation
      ? (definitionBuilder.buildType(operationTypes.mutation): any)
      : null,
    subscription: operationTypes.subscription
      ? (definitionBuilder.buildType(operationTypes.subscription): any)
      : null,
    types: objectValues(nodeMap).map(node => definitionBuilder.buildType(node)),
    directives,
    astNode: schemaDef,
    assumeValid: options && options.assumeValid,
    allowedLegacyNames: options && options.allowedLegacyNames,
  });

  function getOperationTypes(schema: SchemaDefinitionNode) {
    const opTypes = {};
    for (const operationType of schema.operationTypes) {
      opTypes[operationType.operation] = operationType.type;
    }
    return opTypes;
  }
}

type TypeDefinitionsMap = ObjMap<TypeDefinitionNode>;
type TypeResolver = (typeName: string) => GraphQLNamedType;

export class ASTDefinitionBuilder {
  _typeDefinitionsMap: TypeDefinitionsMap;
  _options: ?BuildSchemaOptions;
  _resolveType: TypeResolver;
  _cache: ObjMap<GraphQLNamedType>;

  constructor(
    typeDefinitionsMap: TypeDefinitionsMap,
    options: ?BuildSchemaOptions,
    resolveType: TypeResolver,
  ) {
    this._typeDefinitionsMap = typeDefinitionsMap;
    this._options = options;
    this._resolveType = resolveType;
    // Initialize to the GraphQL built in scalars and introspection types.
    this._cache = keyMap(
      specifiedScalarTypes.concat(introspectionTypes),
      type => type.name,
    );
  }

  buildType(node: NamedTypeNode | TypeDefinitionNode): GraphQLNamedType {
    const typeName = node.name.value;
    if (!this._cache[typeName]) {
      if (node.kind === Kind.NAMED_TYPE) {
        const defNode = this._typeDefinitionsMap[typeName];
        this._cache[typeName] = defNode
          ? this._makeSchemaDef(defNode)
          : this._resolveType(node.name.value);
      } else {
        this._cache[typeName] = this._makeSchemaDef(node);
      }
    }
    return this._cache[typeName];
  }

  _buildWrappedType(typeNode: TypeNode): GraphQLType {
    if (typeNode.kind === Kind.LIST_TYPE) {
      return GraphQLList(this._buildWrappedType(typeNode.type));
    }
    if (typeNode.kind === Kind.NON_NULL_TYPE) {
      return GraphQLNonNull(
        // Note: GraphQLNonNull constructor validates this type
        (this._buildWrappedType(typeNode.type): any),
      );
    }
    return this.buildType(typeNode);
  }

  buildDirective(directive: DirectiveDefinitionNode): GraphQLDirective {
    const locations = directive.locations.map(
      ({ value }) => ((value: any): DirectiveLocationEnum),
    );

    return new GraphQLDirective({
      name: directive.name.value,
      description: getDescription(directive, this._options),
      locations,
      args: keyByNameNode(directive.arguments || [], arg => this.buildArg(arg)),
      astNode: directive,
    });
  }

  buildField(field: FieldDefinitionNode): GraphQLFieldConfig<mixed, mixed> {
    return {
      // Note: While this could make assertions to get the correctly typed
      // value, that would throw immediately while type system validation
      // with validateSchema() will produce more actionable results.
      type: (this._buildWrappedType(field.type): any),
      description: getDescription(field, this._options),
      args: keyByNameNode(field.arguments || [], arg => this.buildArg(arg)),
      deprecationReason: getDeprecationReason(field),
      astNode: field,
    };
  }

  buildArg(value: InputValueDefinitionNode): GraphQLArgumentConfig {
    // Note: While this could make assertions to get the correctly typed
    // value, that would throw immediately while type system validation
    // with validateSchema() will produce more actionable results.
    const type: any = this._buildWrappedType(value.type);
    return {
      type,
      description: getDescription(value, this._options),
      defaultValue: valueFromAST(value.defaultValue, type),
      astNode: value,
    };
  }

  buildInputField(value: InputValueDefinitionNode): GraphQLInputFieldConfig {
    // Note: While this could make assertions to get the correctly typed
    // value, that would throw immediately while type system validation
    // with validateSchema() will produce more actionable results.
    const type: any = this._buildWrappedType(value.type);
    return {
      type,
      description: getDescription(value, this._options),
      defaultValue: valueFromAST(value.defaultValue, type),
      astNode: value,
    };
  }

  buildEnumValue(value: EnumValueDefinitionNode): GraphQLEnumValueConfig {
    return {
      description: getDescription(value, this._options),
      deprecationReason: getDeprecationReason(value),
      astNode: value,
    };
  }

  _makeSchemaDef(astNode: TypeDefinitionNode): GraphQLNamedType {
    switch (astNode.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
        return this._makeTypeDef(astNode);
      case Kind.INTERFACE_TYPE_DEFINITION:
        return this._makeInterfaceDef(astNode);
      case Kind.ENUM_TYPE_DEFINITION:
        return this._makeEnumDef(astNode);
      case Kind.UNION_TYPE_DEFINITION:
        return this._makeUnionDef(astNode);
      case Kind.SCALAR_TYPE_DEFINITION:
        return this._makeScalarDef(astNode);
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        return this._makeInputObjectDef(astNode);
      default:
        throw new Error(`Type kind "${astNode.kind}" not supported.`);
    }
  }

  _makeTypeDef(astNode: ObjectTypeDefinitionNode) {
    const interfaceNodes = astNode.interfaces;
    const fieldNodes = astNode.fields;

    // Note: While this could make assertions to get the correctly typed
    // values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    const interfaces =
      interfaceNodes && interfaceNodes.length > 0
        ? () => interfaceNodes.map(ref => (this.buildType(ref): any))
        : [];

    const fields =
      fieldNodes && fieldNodes.length > 0
        ? () => keyByNameNode(fieldNodes, field => this.buildField(field))
        : Object.create(null);

    return new GraphQLObjectType({
      name: astNode.name.value,
      description: getDescription(astNode, this._options),
      interfaces,
      fields,
      astNode,
    });
  }

  _makeInterfaceDef(astNode: InterfaceTypeDefinitionNode) {
    const fieldNodes = astNode.fields;

    const fields =
      fieldNodes && fieldNodes.length > 0
        ? () => keyByNameNode(fieldNodes, field => this.buildField(field))
        : Object.create(null);

    return new GraphQLInterfaceType({
      name: astNode.name.value,
      description: getDescription(astNode, this._options),
      fields,
      astNode,
    });
  }

  _makeEnumDef(astNode: EnumTypeDefinitionNode) {
    const valueNodes = astNode.values || [];

    return new GraphQLEnumType({
      name: astNode.name.value,
      description: getDescription(astNode, this._options),
      values: keyByNameNode(valueNodes, value => this.buildEnumValue(value)),
      astNode,
    });
  }

  _makeUnionDef(astNode: UnionTypeDefinitionNode) {
    const typeNodes = astNode.types;

    // Note: While this could make assertions to get the correctly typed
    // values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    const types =
      typeNodes && typeNodes.length > 0
        ? () => typeNodes.map(ref => (this.buildType(ref): any))
        : [];

    return new GraphQLUnionType({
      name: astNode.name.value,
      description: getDescription(astNode, this._options),
      types,
      astNode,
    });
  }

  _makeScalarDef(astNode: ScalarTypeDefinitionNode) {
    return new GraphQLScalarType({
      name: astNode.name.value,
      description: getDescription(astNode, this._options),
      astNode,
      serialize: value => value,
    });
  }

  _makeInputObjectDef(def: InputObjectTypeDefinitionNode) {
    const { fields } = def;

    return new GraphQLInputObjectType({
      name: def.name.value,
      description: getDescription(def, this._options),
      fields: fields
        ? () => keyByNameNode(fields, field => this.buildInputField(field))
        : Object.create(null),
      astNode: def,
    });
  }
}

function keyByNameNode<T: { +name: NameNode }, V>(
  list: $ReadOnlyArray<T>,
  valFn: (item: T) => V,
): ObjMap<V> {
  return keyValMap(list, ({ name }) => name.value, valFn);
}

/**
 * Given a field or enum value node, returns the string value for the
 * deprecation reason.
 */
function getDeprecationReason(
  node: EnumValueDefinitionNode | FieldDefinitionNode,
): ?string {
  const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
  return deprecated && (deprecated.reason: any);
}

/**
 * Given an ast node, returns its string description.
 * @deprecated: provided to ease adoption and will be removed in v16.
 *
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
export function getDescription(
  node: { +description?: StringValueNode, +loc?: Location },
  options: ?BuildSchemaOptions,
): void | string {
  if (node.description) {
    return node.description.value;
  }
  if (options && options.commentDescriptions) {
    const rawValue = getLeadingCommentBlock(node);
    if (rawValue !== undefined) {
      return blockStringValue('\n' + rawValue);
    }
  }
}

function getLeadingCommentBlock(node): void | string {
  const loc = node.loc;
  if (!loc) {
    return;
  }
  const comments = [];
  let token = loc.startToken.prev;
  while (
    token &&
    token.kind === TokenKind.COMMENT &&
    token.next &&
    token.prev &&
    token.line + 1 === token.next.line &&
    token.line !== token.prev.line
  ) {
    const value = String(token.value);
    comments.push(value);
    token = token.prev;
  }
  return comments.reverse().join('\n');
}

/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */
export function buildSchema(
  source: string | Source,
  options?: BuildSchemaOptions & ParseOptions,
): GraphQLSchema {
  return buildASTSchema(parse(source, options), options);
}
