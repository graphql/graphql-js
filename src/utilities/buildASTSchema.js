// @flow strict

import objectValues from '../polyfills/objectValues';

import keyMap from '../jsutils/keyMap';
import inspect from '../jsutils/inspect';
import invariant from '../jsutils/invariant';
import devAssert from '../jsutils/devAssert';
import { type ObjMap } from '../jsutils/ObjMap';

import { Kind } from '../language/kinds';
import { type Source } from '../language/source';
import { TokenKind } from '../language/tokenKind';
import { type ParseOptions, parse } from '../language/parser';
import { isTypeDefinitionNode } from '../language/predicates';
import { dedentBlockStringValue } from '../language/blockString';
import { type DirectiveLocationEnum } from '../language/directiveLocation';
import {
  type Location,
  type StringValueNode,
  type DocumentNode,
  type TypeNode,
  type NamedTypeNode,
  type SchemaDefinitionNode,
  type SchemaExtensionNode,
  type TypeDefinitionNode,
  type InterfaceTypeDefinitionNode,
  type InterfaceTypeExtensionNode,
  type ObjectTypeDefinitionNode,
  type ObjectTypeExtensionNode,
  type UnionTypeDefinitionNode,
  type UnionTypeExtensionNode,
  type FieldDefinitionNode,
  type InputObjectTypeDefinitionNode,
  type InputObjectTypeExtensionNode,
  type InputValueDefinitionNode,
  type EnumTypeDefinitionNode,
  type EnumTypeExtensionNode,
  type EnumValueDefinitionNode,
  type DirectiveDefinitionNode,
} from '../language/ast';

import { assertValidSDL } from '../validation/validate';

import { getDirectiveValues } from '../execution/values';

import { specifiedScalarTypes } from '../type/scalars';
import { introspectionTypes } from '../type/introspection';
import {
  type GraphQLSchemaValidationOptions,
  GraphQLSchema,
} from '../type/schema';
import {
  GraphQLDirective,
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
} from '../type/directives';
import {
  type GraphQLType,
  type GraphQLNamedType,
  type GraphQLFieldConfigMap,
  type GraphQLEnumValueConfigMap,
  type GraphQLInputFieldConfigMap,
  type GraphQLFieldConfigArgumentMap,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../type/definition';

import { valueFromAST } from './valueFromAST';

export type BuildSchemaOptions = {|
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
|};

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
  devAssert(
    documentAST && documentAST.kind === Kind.DOCUMENT,
    'Must provide valid Document AST',
  );

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    assertValidSDL(documentAST);
  }

  let schemaDef: ?SchemaDefinitionNode;
  const typeDefs: Array<TypeDefinitionNode> = [];
  const directiveDefs: Array<DirectiveDefinitionNode> = [];

  for (const def of documentAST.definitions) {
    if (def.kind === Kind.SCHEMA_DEFINITION) {
      schemaDef = def;
    } else if (isTypeDefinitionNode(def)) {
      typeDefs.push(def);
    } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      directiveDefs.push(def);
    }
  }

  const astBuilder = new ASTDefinitionBuilder(options, typeName => {
    const type = typeMap[typeName];
    if (type === undefined) {
      throw new Error(`Type "${typeName}" not found in document.`);
    }
    return type;
  });

  const typeMap = astBuilder.buildTypeMap(typeDefs);
  const operationTypes = schemaDef
    ? astBuilder.getOperationTypes([schemaDef])
    : {
        // Note: While this could make early assertions to get the correctly
        // typed values below, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        query: (typeMap['Query']: any),
        mutation: (typeMap['Mutation']: any),
        subscription: (typeMap['Subscription']: any),
      };

  const directives = astBuilder.buildDirectives(directiveDefs);

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

  return new GraphQLSchema({
    ...operationTypes,
    types: objectValues(typeMap),
    directives,
    astNode: schemaDef,
    assumeValid: options && options.assumeValid,
  });
}

type TypeResolver = (typeName: string) => GraphQLNamedType;

const stdTypeMap = keyMap(
  specifiedScalarTypes.concat(introspectionTypes),
  type => type.name,
);

export class ASTDefinitionBuilder {
  _options: ?BuildSchemaOptions;
  _resolveType: TypeResolver;

  constructor(options: ?BuildSchemaOptions, resolveType: TypeResolver) {
    this._options = options;
    this._resolveType = resolveType;
  }

  getOperationTypes(
    nodes: $ReadOnlyArray<SchemaDefinitionNode | SchemaExtensionNode>,
  ): {|
    query: ?GraphQLObjectType,
    mutation: ?GraphQLObjectType,
    subscription: ?GraphQLObjectType,
  |} {
    // Note: While this could make early assertions to get the correctly
    // typed values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    const opTypes: any = {};
    for (const node of nodes) {
      if (node.operationTypes != null) {
        for (const operationType of node.operationTypes) {
          const typeName = operationType.type.name.value;
          opTypes[operationType.operation] = this._resolveType(typeName);
        }
      }
    }
    return opTypes;
  }

  getNamedType(node: NamedTypeNode): GraphQLNamedType {
    const name = node.name.value;
    return stdTypeMap[name] || this._resolveType(name);
  }

  getWrappedType(node: TypeNode): GraphQLType {
    if (node.kind === Kind.LIST_TYPE) {
      return new GraphQLList(this.getWrappedType(node.type));
    }
    if (node.kind === Kind.NON_NULL_TYPE) {
      return new GraphQLNonNull(this.getWrappedType(node.type));
    }
    return this.getNamedType(node);
  }

  buildDirectives(
    nodes: Array<DirectiveDefinitionNode>,
  ): Array<GraphQLDirective> {
    return nodes.map(directive => {
      const locations = directive.locations.map(
        ({ value }) => ((value: any): DirectiveLocationEnum),
      );

      return new GraphQLDirective({
        name: directive.name.value,
        description: getDescription(directive, this._options),
        locations,
        isRepeatable: directive.repeatable,
        args: this.buildArgumentMap(directive.arguments),
        astNode: directive,
      });
    });
  }

  buildFieldMap(
    nodes: $ReadOnlyArray<
      | InterfaceTypeDefinitionNode
      | InterfaceTypeExtensionNode
      | ObjectTypeDefinitionNode
      | ObjectTypeExtensionNode,
    >,
  ): GraphQLFieldConfigMap<mixed, mixed> {
    const fieldConfigMap = Object.create(null);
    for (const node of nodes) {
      if (node.fields != null) {
        for (const field of node.fields) {
          fieldConfigMap[field.name.value] = {
            // Note: While this could make assertions to get the correctly typed
            // value, that would throw immediately while type system validation
            // with validateSchema() will produce more actionable results.
            type: (this.getWrappedType(field.type): any),
            description: getDescription(field, this._options),
            args: this.buildArgumentMap(field.arguments),
            deprecationReason: getDeprecationReason(field),
            astNode: field,
          };
        }
      }
    }
    return fieldConfigMap;
  }

  buildArgumentMap(
    args: ?$ReadOnlyArray<InputValueDefinitionNode>,
  ): GraphQLFieldConfigArgumentMap {
    const argConfigMap = Object.create(null);
    if (args != null) {
      for (const arg of args) {
        // Note: While this could make assertions to get the correctly typed
        // value, that would throw immediately while type system validation
        // with validateSchema() will produce more actionable results.
        const type: any = this.getWrappedType(arg.type);

        argConfigMap[arg.name.value] = {
          type,
          description: getDescription(arg, this._options),
          defaultValue: valueFromAST(arg.defaultValue, type),
          astNode: arg,
        };
      }
    }
    return argConfigMap;
  }

  buildInputFieldMap(
    nodes: $ReadOnlyArray<
      InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode,
    >,
  ): GraphQLInputFieldConfigMap {
    const inputFieldMap = Object.create(null);
    for (const node of nodes) {
      if (node.fields != null) {
        for (const field of node.fields) {
          // Note: While this could make assertions to get the correctly typed
          // value, that would throw immediately while type system validation
          // with validateSchema() will produce more actionable results.
          const type: any = this.getWrappedType(field.type);

          inputFieldMap[field.name.value] = {
            type,
            description: getDescription(field, this._options),
            defaultValue: valueFromAST(field.defaultValue, type),
            astNode: field,
          };
        }
      }
    }
    return inputFieldMap;
  }

  buildEnumValueMap(
    nodes: $ReadOnlyArray<EnumTypeDefinitionNode | EnumTypeExtensionNode>,
  ): GraphQLEnumValueConfigMap {
    const enumValueMap = Object.create(null);
    for (const node of nodes) {
      if (node.values != null) {
        for (const value of node.values) {
          enumValueMap[value.name.value] = {
            description: getDescription(value, this._options),
            deprecationReason: getDeprecationReason(value),
            astNode: value,
          };
        }
      }
    }
    return enumValueMap;
  }

  buildInterfaces(
    nodes: $ReadOnlyArray<
      | InterfaceTypeDefinitionNode
      | InterfaceTypeExtensionNode
      | ObjectTypeDefinitionNode
      | ObjectTypeExtensionNode,
    >,
  ): Array<GraphQLInterfaceType> {
    const interfaces = [];
    for (const node of nodes) {
      if (node.interfaces != null) {
        for (const type of node.interfaces) {
          // Note: While this could make assertions to get the correctly typed
          // values below, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable
          // results.
          interfaces.push((this.getNamedType(type): any));
        }
      }
    }
    return interfaces;
  }

  buildUnionTypes(
    nodes: $ReadOnlyArray<UnionTypeDefinitionNode | UnionTypeExtensionNode>,
  ): Array<GraphQLObjectType> {
    const types = [];
    for (const node of nodes) {
      if (node.types != null) {
        for (const type of node.types) {
          // Note: While this could make assertions to get the correctly typed
          // values below, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable
          // results.
          types.push((this.getNamedType(type): any));
        }
      }
    }
    return types;
  }

  buildTypeMap(
    nodes: $ReadOnlyArray<TypeDefinitionNode>,
  ): ObjMap<GraphQLNamedType> {
    const typeMap = Object.create(null);
    for (const node of nodes) {
      const name = node.name.value;
      typeMap[name] = stdTypeMap[name] || this._buildType(node);
    }
    return typeMap;
  }

  _buildType(astNode: TypeDefinitionNode): GraphQLNamedType {
    const name = astNode.name.value;
    const description = getDescription(astNode, this._options);

    switch (astNode.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
        return new GraphQLObjectType({
          name,
          description,
          interfaces: () => this.buildInterfaces([astNode]),
          fields: () => this.buildFieldMap([astNode]),
          astNode,
        });
      case Kind.INTERFACE_TYPE_DEFINITION:
        return new GraphQLInterfaceType({
          name,
          description,
          interfaces: () => this.buildInterfaces([astNode]),
          fields: () => this.buildFieldMap([astNode]),
          astNode,
        });
      case Kind.ENUM_TYPE_DEFINITION:
        return new GraphQLEnumType({
          name,
          description,
          values: this.buildEnumValueMap([astNode]),
          astNode,
        });
      case Kind.UNION_TYPE_DEFINITION:
        return new GraphQLUnionType({
          name,
          description,
          types: () => this.buildUnionTypes([astNode]),
          astNode,
        });
      case Kind.SCALAR_TYPE_DEFINITION:
        return new GraphQLScalarType({
          name,
          description,
          astNode,
        });
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        return new GraphQLInputObjectType({
          name,
          description,
          fields: () => this.buildInputFieldMap([astNode]),
          astNode,
        });
    }

    // Not reachable. All possible type definition nodes have been considered.
    invariant(
      false,
      'Unexpected type definition node: ' + inspect((astNode: empty)),
    );
  }
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
  node: { +description?: StringValueNode, +loc?: Location, ... },
  options: ?BuildSchemaOptions,
): void | string {
  if (node.description) {
    return node.description.value;
  }
  if (options && options.commentDescriptions) {
    const rawValue = getLeadingCommentBlock(node);
    if (rawValue !== undefined) {
      return dedentBlockStringValue('\n' + rawValue);
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
  return comments.length > 0 ? comments.reverse().join('\n') : undefined;
}

/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */
export function buildSchema(
  source: string | Source,
  options?: {| ...BuildSchemaOptions, ...ParseOptions |},
): GraphQLSchema {
  const document = parse(source, {
    noLocation: (options && options.noLocation) || false,
    allowLegacySDLEmptyFields:
      (options && options.allowLegacySDLEmptyFields) || false,
    allowLegacySDLImplementsInterfaces:
      (options && options.allowLegacySDLImplementsInterfaces) || false,
    experimentalFragmentVariables:
      (options && options.experimentalFragmentVariables) || false,
  });

  return buildASTSchema(document, {
    commentDescriptions: (options && options.commentDescriptions) || false,
    assumeValidSDL: (options && options.assumeValidSDL) || false,
    assumeValid: (options && options.assumeValid) || false,
  });
}
