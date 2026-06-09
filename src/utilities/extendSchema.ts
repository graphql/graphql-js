/** @category Schema Construction */

import { AccumulatorMap } from '../jsutils/AccumulatorMap.ts';
import { invariant } from '../jsutils/invariant.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';

import type {
  ConstValueNode,
  DirectiveDefinitionNode,
  DirectiveExtensionNode,
  DocumentNode,
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  ScalarTypeDefinitionNode,
  ScalarTypeExtensionNode,
  SchemaDefinitionNode,
  SchemaExtensionNode,
  TypeDefinitionNode,
  TypeNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
} from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';

/* eslint-disable import/no-deprecated */
import type {
  GraphQLArgumentExtensions,
  GraphQLEnumTypeExtensions,
  GraphQLEnumValueExtensions,
  GraphQLEnumValueNormalizedConfigMap,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldExtensions,
  GraphQLFieldNormalizedConfigMap,
  GraphQLFieldResolver,
  GraphQLInputFieldExtensions,
  GraphQLInputFieldNormalizedConfigMap,
  GraphQLInputObjectTypeExtensions,
  GraphQLInterfaceTypeExtensions,
  GraphQLIsTypeOfFn,
  GraphQLNamedType,
  GraphQLNullableType,
  GraphQLObjectTypeExtensions,
  GraphQLScalarInputLiteralCoercer,
  GraphQLScalarInputValueCoercer,
  GraphQLScalarLiteralParser,
  GraphQLScalarOutputValueCoercer,
  GraphQLScalarSerializer,
  GraphQLScalarTypeExtensions,
  GraphQLScalarValueParser,
  GraphQLType,
  GraphQLTypeResolver,
  GraphQLUnionTypeExtensions,
} from '../type/definition.ts';
/* eslint-enable import/no-deprecated */
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
} from '../type/definition.ts';
import type { GraphQLDirectiveExtensions } from '../type/directives.ts';
import {
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  GraphQLOneOfDirective,
  GraphQLSpecifiedByDirective,
} from '../type/directives.ts';
import { introspectionTypes } from '../type/introspection.ts';
import { specifiedScalarTypes } from '../type/scalars.ts';
import type {
  GraphQLSchemaExtensions,
  GraphQLSchemaNormalizedConfig,
  GraphQLSchemaValidationOptions,
} from '../type/schema.ts';
import { assertSchema, GraphQLSchema } from '../type/schema.ts';

import { assertValidSDLExtension } from '../validation/validate.ts';

import { getDirectiveValues } from '../execution/values.ts';

import { mapSchemaConfig, SchemaElementKind } from './mapSchemaConfig.ts';

/**
 * Supplemental schema constructor config for SDL-built elements when SDL cannot
 * express the config directly.
 */
export interface GraphQLSchemaSupplementalConfig {
  /** Supplemental config keyed by scalar type name. */
  scalarTypes?:
    | Readonly<ObjMap<GraphQLScalarTypeSupplementalConfig>>
    | undefined;
  /** Supplemental config keyed by object type name. */
  objectTypes?:
    | Readonly<ObjMap<GraphQLObjectTypeSupplementalConfig>>
    | undefined;
  /** Supplemental config keyed by interface type name. */
  interfaceTypes?:
    | Readonly<ObjMap<GraphQLInterfaceTypeSupplementalConfig>>
    | undefined;
  /** Supplemental config keyed by union type name. */
  unionTypes?: Readonly<ObjMap<GraphQLUnionTypeSupplementalConfig>> | undefined;
  /** Supplemental config keyed by enum type name. */
  enumTypes?: Readonly<ObjMap<GraphQLEnumTypeSupplementalConfig>> | undefined;
  /** Supplemental config keyed by input object type name. */
  inputObjectTypes?:
    | Readonly<ObjMap<GraphQLInputObjectTypeSupplementalConfig>>
    | undefined;
  /** Supplemental config keyed by directive name. */
  directives?: Readonly<ObjMap<GraphQLDirectiveSupplementalConfig>> | undefined;
  /** Custom extensions. */
  extensions?: Readonly<GraphQLSchemaExtensions> | undefined;
}

type SupplementalTypeConfigKey = Extract<
  keyof GraphQLSchemaSupplementalConfig,
  `${string}Types`
>;

const typeConfigKeyByTypeDefinitionKind: {
  readonly [K in TypeDefinitionNode['kind']]: SupplementalTypeConfigKey;
} = {
  [Kind.SCALAR_TYPE_DEFINITION]: 'scalarTypes',
  [Kind.OBJECT_TYPE_DEFINITION]: 'objectTypes',
  [Kind.INTERFACE_TYPE_DEFINITION]: 'interfaceTypes',
  [Kind.UNION_TYPE_DEFINITION]: 'unionTypes',
  [Kind.ENUM_TYPE_DEFINITION]: 'enumTypes',
  [Kind.INPUT_OBJECT_TYPE_DEFINITION]: 'inputObjectTypes',
};

/* eslint-disable import/no-deprecated */
/** Supplemental config for a scalar type. */
export interface GraphQLScalarTypeSupplementalConfig {
  /**
   * Deprecated legacy serializer used to convert internal values for response
   * output. Use `coerceOutputValue()` instead.
   * @deprecated use `coerceOutputValue()` instead, `serialize()` will be removed in v18
   */
  serialize?: GraphQLScalarSerializer<unknown> | undefined;
  /**
   * Deprecated legacy parser used to convert externally provided input values.
   * Use `coerceInputValue()` instead.
   * @deprecated use `coerceInputValue()` instead, `parseValue()` will be removed in v18
   */
  parseValue?: GraphQLScalarValueParser<unknown> | undefined;
  /**
   * Deprecated legacy parser used to convert externally provided input
   * literals. Use `replaceVariables()` and `coerceInputLiteral()` instead.
   * @deprecated use `replaceVariables()` and `coerceInputLiteral()` instead, `parseLiteral()` will be removed in v18
   */
  parseLiteral?: GraphQLScalarLiteralParser<unknown> | undefined;
  /** Coerces an internal value to include in a response. */
  coerceOutputValue?: GraphQLScalarOutputValueCoercer<unknown> | undefined;
  /** Coerces an externally provided value to use as an input. */
  coerceInputValue?: GraphQLScalarInputValueCoercer<unknown> | undefined;
  /** Coerces an externally provided const literal value to use as an input. */
  coerceInputLiteral?: GraphQLScalarInputLiteralCoercer<unknown> | undefined;
  /** Translates an externally provided value to a literal (AST). */
  valueToLiteral?:
    | ((inputValue: unknown) => ConstValueNode | undefined)
    | undefined;
  /** Custom extensions. */
  extensions?: Readonly<GraphQLScalarTypeExtensions> | undefined;
}
/* eslint-enable import/no-deprecated */

/** Supplemental config for an object type. */
export interface GraphQLObjectTypeSupplementalConfig {
  /** Supplemental config for fields declared by the document. */
  fields?: Readonly<ObjMap<GraphQLFieldSupplementalConfig>> | undefined;
  /** Predicate used to determine whether a runtime value belongs to this object type. */
  isTypeOf?: GraphQLIsTypeOfFn<unknown, unknown> | undefined;
  /** Custom extensions. */
  extensions?:
    | Readonly<GraphQLObjectTypeExtensions<unknown, unknown>>
    | undefined;
}

/** Supplemental config for an interface type. */
export interface GraphQLInterfaceTypeSupplementalConfig {
  /** Supplemental config for fields declared by the document. */
  fields?: Readonly<ObjMap<GraphQLFieldSupplementalConfig>> | undefined;
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: GraphQLTypeResolver<unknown, unknown> | undefined;
  /** Custom extensions. */
  extensions?: Readonly<GraphQLInterfaceTypeExtensions> | undefined;
}

/** Supplemental config for a union type. */
export interface GraphQLUnionTypeSupplementalConfig {
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: GraphQLTypeResolver<unknown, unknown> | undefined;
  /** Custom extensions. */
  extensions?: Readonly<GraphQLUnionTypeExtensions> | undefined;
}

/** Supplemental config for an enum type. */
export interface GraphQLEnumTypeSupplementalConfig {
  /** Supplemental config for values declared by the document. */
  values?: Readonly<ObjMap<GraphQLEnumValueSupplementalConfig>> | undefined;
  /** Custom extensions. */
  extensions?: Readonly<GraphQLEnumTypeExtensions> | undefined;
}

/** Supplemental config for an enum value. */
export interface GraphQLEnumValueSupplementalConfig {
  /** Internal runtime value represented by this enum value. */
  value?: unknown;
  /** Custom extensions. */
  extensions?: Readonly<GraphQLEnumValueExtensions> | undefined;
}

/** Supplemental config for an input object type. */
export interface GraphQLInputObjectTypeSupplementalConfig {
  /** Supplemental config for fields declared by the document. */
  fields?: Readonly<ObjMap<GraphQLInputFieldSupplementalConfig>> | undefined;
  /** Custom extensions. */
  extensions?: Readonly<GraphQLInputObjectTypeExtensions> | undefined;
}

/** Supplemental config for a field declared by an object or interface. */
export type GraphQLFieldSupplementalConfig =
  | GraphQLFieldResolver<unknown, unknown>
  | GraphQLFieldSupplementalConfigMap;

/** Supplemental config map for a field declared by an object or interface. */
export interface GraphQLFieldSupplementalConfigMap {
  /** Supplemental config for arguments declared by the document. */
  args?: Readonly<ObjMap<GraphQLArgumentSupplementalConfig>> | undefined;
  /** Resolver function used to produce this field value. */
  resolve?: GraphQLFieldResolver<unknown, unknown> | undefined;
  /** Resolver function used to create a subscription event stream for this field. */
  subscribe?: GraphQLFieldResolver<unknown, unknown> | undefined;
  /** Custom extensions. */
  extensions?: Readonly<GraphQLFieldExtensions<unknown, unknown>> | undefined;
}

/** Supplemental config for an argument declared by a field or directive. */
export interface GraphQLArgumentSupplementalConfig {
  /** Custom extensions. */
  extensions?: Readonly<GraphQLArgumentExtensions> | undefined;
}

/** Supplemental config for an input object field. */
export interface GraphQLInputFieldSupplementalConfig {
  /** Custom extensions. */
  extensions?: Readonly<GraphQLInputFieldExtensions> | undefined;
}

/** Supplemental config for a directive declared by SDL. */
export interface GraphQLDirectiveSupplementalConfig {
  /** Supplemental config for arguments declared by the document. */
  args?: Readonly<ObjMap<GraphQLArgumentSupplementalConfig>> | undefined;
  /** Custom extensions. */
  extensions?: Readonly<GraphQLDirectiveExtensions> | undefined;
}

/** Options used when extending a schema from a parsed SDL document. */
export interface ExtendSchemaOptions extends GraphQLSchemaValidationOptions {
  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   *
   * @internal
   */
  assumeValidSDL?: boolean | undefined;
  /**
   * Set to true to assume the supplemental config is valid.
   *
   * Default: false
   */
  assumeValidSupplementalConfig?: boolean | undefined;
  /**
   * Supplemental schema constructor config not expressible in SDL.
   *
   * It applies only to elements newly added by the document, including fields
   * added to an existing type by a type extension.
   */
  supplementalConfig?: Readonly<GraphQLSchemaSupplementalConfig> | undefined;
}

/**
 * Produces a new schema given an existing schema and a document which may
 * contain GraphQL type extensions and definitions. The original schema will
 * remain unaltered.
 *
 * Because a schema represents a graph of references, a schema cannot be
 * extended without effectively making an entire copy. We do not know until it's
 * too late if subgraphs remain unchanged.
 *
 * This algorithm copies the provided schema, applying extensions while
 * producing the copy. The original schema remains unaltered.
 * @param schema - GraphQL schema to use.
 * @param documentAST - The parsed GraphQL document AST.
 * @param options - Optional configuration for this operation.
 * @returns A new schema with the extensions and definitions applied.
 * @example
 * ```ts
 * // Extend a schema with new fields and types.
 * import { parse } from 'graphql/language';
 * import { buildSchema, extendSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const extensionAST = parse(`
 *   extend type Query {
 *     farewell: String
 *   }
 *
 *   type Review {
 *     body: String
 *   }
 * `);
 *
 * const extendedSchema = extendSchema(schema, extensionAST);
 *
 * schema.getType('Review'); // => undefined
 * extendedSchema.getType('Review')?.name; // => 'Review'
 * Object.keys(extendedSchema.getQueryType().getFields()); // => ['greeting', 'farewell']
 * ```
 * @example
 * ```ts
 * // This variant bypasses validation for an otherwise invalid extension.
 * import { parse } from 'graphql/language';
 * import { buildSchema, extendSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const invalidExtension = parse(`
 *   extend type Missing {
 *     field: String
 *   }
 * `);
 *
 * extendSchema(schema, invalidExtension); // throws an error
 * extendSchema(schema, invalidExtension, {
 *   assumeValid: true,
 *   assumeValidSDL: true,
 * }); // does not throw
 * ```
 */
export function extendSchema(
  schema: GraphQLSchema,
  documentAST: DocumentNode,
  options?: ExtendSchemaOptions,
): GraphQLSchema {
  assertSchema(schema);

  if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
    assertValidSDLExtension(documentAST, schema);
  }

  const schemaConfig = schema.toConfig();
  const extendedConfig = extendSchemaImpl(schemaConfig, documentAST, options);
  return schemaConfig === extendedConfig
    ? schema
    : new GraphQLSchema(extendedConfig);
}

/** @internal */
export function extendSchemaImpl(
  schemaConfig: GraphQLSchemaNormalizedConfig,
  documentAST: DocumentNode,
  options?: ExtendSchemaOptions,
): GraphQLSchemaNormalizedConfig {
  // Collect the type definitions and extensions found in the document.
  const typeDefs: Array<TypeDefinitionNode> = [];

  const scalarExtensions = new AccumulatorMap<
    string,
    ScalarTypeExtensionNode
  >();
  const objectExtensions = new AccumulatorMap<
    string,
    ObjectTypeExtensionNode
  >();
  const interfaceExtensions = new AccumulatorMap<
    string,
    InterfaceTypeExtensionNode
  >();
  const unionExtensions = new AccumulatorMap<string, UnionTypeExtensionNode>();
  const enumExtensions = new AccumulatorMap<string, EnumTypeExtensionNode>();
  const inputObjectExtensions = new AccumulatorMap<
    string,
    InputObjectTypeExtensionNode
  >();
  const directiveExtensions = new AccumulatorMap<
    string,
    DirectiveExtensionNode
  >();

  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  const directiveDefs: Array<DirectiveDefinitionNode> = [];

  let schemaDef: SchemaDefinitionNode | undefined;
  // Schema extensions are collected which may add additional operation types.
  const schemaExtensions: Array<SchemaExtensionNode> = [];

  let isSchemaChanged = false;
  for (const def of documentAST.definitions) {
    switch (def.kind) {
      case Kind.SCHEMA_DEFINITION:
        schemaDef = def;
        break;
      case Kind.SCHEMA_EXTENSION:
        schemaExtensions.push(def);
        break;
      case Kind.DIRECTIVE_DEFINITION:
        directiveDefs.push(def);
        break;
      case Kind.DIRECTIVE_EXTENSION:
        directiveExtensions.add(def.name.value, def);
        break;

      // Type Definitions
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        typeDefs.push(def);
        break;

      // Type System Extensions
      case Kind.SCALAR_TYPE_EXTENSION:
        scalarExtensions.add(def.name.value, def);
        break;
      case Kind.OBJECT_TYPE_EXTENSION:
        objectExtensions.add(def.name.value, def);
        break;
      case Kind.INTERFACE_TYPE_EXTENSION:
        interfaceExtensions.add(def.name.value, def);
        break;
      case Kind.UNION_TYPE_EXTENSION:
        unionExtensions.add(def.name.value, def);
        break;
      case Kind.ENUM_TYPE_EXTENSION:
        enumExtensions.add(def.name.value, def);
        break;
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
        inputObjectExtensions.add(def.name.value, def);
        break;
      default:
        continue;
    }
    isSchemaChanged = true;
  }

  const supplementalConfig = options?.supplementalConfig;
  const scalarTypeSupplementalConfigMap = supplementalConfig?.scalarTypes;
  const objectTypeSupplementalConfigMap = supplementalConfig?.objectTypes;
  const interfaceTypeSupplementalConfigMap = supplementalConfig?.interfaceTypes;
  const unionTypeSupplementalConfigMap = supplementalConfig?.unionTypes;
  const enumTypeSupplementalConfigMap = supplementalConfig?.enumTypes;
  const inputObjectTypeSupplementalConfigMap =
    supplementalConfig?.inputObjectTypes;
  const directiveSupplementalConfigMap = supplementalConfig?.directives;
  const supplementalExtensions = supplementalConfig?.extensions;

  if (
    supplementalConfig !== undefined &&
    options?.assumeValidSupplementalConfig !== true
  ) {
    validateSchemaSupplementalConfig(supplementalConfig);
  }

  // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.
  if (!isSchemaChanged) {
    if (supplementalExtensions === undefined) {
      return schemaConfig;
    }

    return {
      ...schemaConfig,
      extensions: supplementalExtensions,
      assumeValid: options?.assumeValid ?? false,
    };
  }

  const extendedConfig = mapSchemaConfig(schemaConfig, (context) => {
    const { getNamedType, setNamedType, getNamedTypes } = context;
    return {
      [SchemaElementKind.SCHEMA]: (config) => {
        for (const typeNode of typeDefs) {
          const type =
            stdTypeMap.get(typeNode.name.value) ?? buildNamedType(typeNode);
          setNamedType(type);
        }

        const operationTypes = {
          // Get the extended root operation types.
          query:
            config.query &&
            (getNamedType(config.query.name) as GraphQLObjectType),
          mutation:
            config.mutation &&
            (getNamedType(config.mutation.name) as GraphQLObjectType),
          subscription:
            config.subscription &&
            (getNamedType(config.subscription.name) as GraphQLObjectType),
          // Then, incorporate schema definition and all schema extensions.
          ...(schemaDef && getOperationTypes([schemaDef])),
          ...getOperationTypes(schemaExtensions),
        };

        // Then produce and return a Schema config with these types.
        return {
          description: schemaDef?.description?.value ?? config.description,
          ...operationTypes,
          types: getNamedTypes(),
          directives: [
            ...config.directives.map(extendDirective),
            ...directiveDefs.map(buildDirective),
          ],
          extensions: supplementalExtensions ?? config.extensions,
          astNode: schemaDef ?? config.astNode,
          extensionASTNodes: config.extensionASTNodes.concat(schemaExtensions),
          assumeValid: options?.assumeValid ?? false,
        };
      },
      [SchemaElementKind.INPUT_OBJECT]: (config) => {
        const extensions = inputObjectExtensions.get(config.name) ?? [];
        return {
          ...config,
          fields: () => ({
            ...config.fields(),
            ...buildInputFieldMap(
              extensions,
              inputObjectTypeSupplementalConfigMap?.[config.name]?.fields,
            ),
          }),
          extensionASTNodes: config.extensionASTNodes.concat(extensions),
        };
      },
      [SchemaElementKind.ENUM]: (config) => {
        const extensions = enumExtensions.get(config.name) ?? [];
        return {
          ...config,
          values: () => ({
            ...config.values(),
            ...buildEnumValueMap(
              extensions,
              enumTypeSupplementalConfigMap?.[config.name]?.values,
            ),
          }),
          extensionASTNodes: config.extensionASTNodes.concat(extensions),
        };
      },
      [SchemaElementKind.SCALAR]: (config) => {
        const extensions = scalarExtensions.get(config.name) ?? [];
        let specifiedByURL = config.specifiedByURL;
        for (const extensionNode of extensions) {
          specifiedByURL = getSpecifiedByURL(extensionNode) ?? specifiedByURL;
        }
        return {
          ...config,
          specifiedByURL,
          extensionASTNodes: config.extensionASTNodes.concat(extensions),
        };
      },
      [SchemaElementKind.OBJECT]: (config) => {
        const extensions = objectExtensions.get(config.name) ?? [];
        return {
          ...config,
          interfaces: () => [
            ...config.interfaces(),
            ...buildInterfaces(extensions),
          ],
          fields: () => ({
            ...config.fields(),
            ...buildFieldMap(
              extensions,
              objectTypeSupplementalConfigMap?.[config.name]?.fields,
            ),
          }),
          extensionASTNodes: config.extensionASTNodes.concat(extensions),
        };
      },
      [SchemaElementKind.INTERFACE]: (config) => {
        const extensions = interfaceExtensions.get(config.name) ?? [];
        return {
          ...config,
          interfaces: () => [
            ...config.interfaces(),
            ...buildInterfaces(extensions),
          ],
          fields: () => ({
            ...config.fields(),
            ...buildFieldMap(
              extensions,
              interfaceTypeSupplementalConfigMap?.[config.name]?.fields,
            ),
          }),
          extensionASTNodes: config.extensionASTNodes.concat(extensions),
        };
      },
      [SchemaElementKind.UNION]: (config) => {
        const extensions = unionExtensions.get(config.name) ?? [];
        return {
          ...config,
          types: () => [...config.types(), ...buildUnionTypes(extensions)],
          extensionASTNodes: config.extensionASTNodes.concat(extensions),
        };
      },
    };

    function getOperationTypes(
      nodes: ReadonlyArray<SchemaDefinitionNode | SchemaExtensionNode>,
    ): {
      query?: Maybe<GraphQLObjectType>;
      mutation?: Maybe<GraphQLObjectType>;
      subscription?: Maybe<GraphQLObjectType>;
    } {
      const opTypes = {};
      for (const node of nodes) {
        const operationTypesNodes = node.operationTypes ?? [];

        for (const operationType of operationTypesNodes) {
          // Note: While this could make early assertions to get the correctly
          // typed values below, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.
          // @ts-expect-error
          opTypes[operationType.operation] = namedTypeFromAST(
            operationType.type,
          );
        }
      }

      return opTypes;
    }

    function namedTypeFromAST(node: NamedTypeNode): GraphQLNamedType {
      const name = node.name.value;
      const type = getNamedType(name);
      invariant(type !== undefined, `Unknown type: "${name}".`);
      return type;
    }

    function typeFromAST(node: TypeNode): GraphQLType {
      if (node.kind === Kind.LIST_TYPE) {
        return new GraphQLList(typeFromAST(node.type));
      }
      if (node.kind === Kind.NON_NULL_TYPE) {
        return new GraphQLNonNull(
          typeFromAST(node.type) as GraphQLNullableType,
        );
      }
      return namedTypeFromAST(node);
    }

    function buildDirective(node: DirectiveDefinitionNode): GraphQLDirective {
      const extensionASTNodes = directiveExtensions.get(node.name.value) ?? [];
      const directiveSupplement =
        directiveSupplementalConfigMap?.[node.name.value];
      const deprecationReason =
        getDeprecationReason(node) ??
        extensionASTNodes
          .map((extensionNode) => getDeprecationReason(extensionNode))
          .find((reason) => reason !== undefined);

      return new GraphQLDirective({
        name: node.name.value,
        description: node.description?.value,
        // @ts-expect-error
        locations: node.locations.map(({ value }) => value),
        isRepeatable: node.repeatable,
        args: buildArgumentMap(node.arguments, directiveSupplement?.args),
        deprecationReason,
        extensions: directiveSupplement?.extensions,
        astNode: node,
        extensionASTNodes,
      });
    }

    function extendDirective(directive: GraphQLDirective): GraphQLDirective {
      const extensionASTNodes = directiveExtensions.get(directive.name) ?? [];
      if (extensionASTNodes.length === 0) {
        return directive;
      }
      const deprecationReason =
        directive.deprecationReason ??
        extensionASTNodes
          .map((extensionNode) => getDeprecationReason(extensionNode))
          .find((reason) => reason !== undefined);

      return new GraphQLDirective({
        ...directive.toConfig(),
        deprecationReason,
        extensionASTNodes:
          directive.extensionASTNodes.concat(extensionASTNodes),
      });
    }

    function buildFieldMap(
      nodes: ReadonlyArray<
        | InterfaceTypeDefinitionNode
        | InterfaceTypeExtensionNode
        | ObjectTypeDefinitionNode
        | ObjectTypeExtensionNode
      >,
      fieldSupplements:
        | Readonly<ObjMap<GraphQLFieldSupplementalConfig>>
        | undefined,
    ): GraphQLFieldNormalizedConfigMap<unknown, unknown> {
      const fieldConfigMap = Object.create(null);
      for (const node of nodes) {
        const nodeFields = node.fields ?? [];

        for (const field of nodeFields) {
          const fieldSupplement = fieldSupplements?.[field.name.value];
          let fieldSupplementMap: GraphQLFieldSupplementalConfigMap | undefined;
          let resolve: GraphQLFieldResolver<unknown, unknown> | undefined;
          if (typeof fieldSupplement === 'function') {
            resolve = fieldSupplement;
          } else {
            fieldSupplementMap = fieldSupplement;
            resolve = fieldSupplementMap?.resolve;
          }

          fieldConfigMap[field.name.value] = {
            // Note: While this could make assertions to get the correctly typed
            // value, that would throw immediately while type system validation
            // with validateSchema() will produce more actionable results.
            type: typeFromAST(field.type),
            description: field.description?.value,
            args: buildArgumentMap(field.arguments, fieldSupplementMap?.args),
            resolve,
            subscribe: fieldSupplementMap?.subscribe,
            deprecationReason: getDeprecationReason(field),
            extensions: fieldSupplementMap?.extensions,
            astNode: field,
          };
        }
      }
      return fieldConfigMap;
    }

    function buildArgumentMap(
      args: Maybe<ReadonlyArray<InputValueDefinitionNode>>,
      argSupplements?: Readonly<ObjMap<GraphQLArgumentSupplementalConfig>>,
    ): GraphQLFieldConfigArgumentMap {
      const argsNodes = args ?? [];

      const argConfigMap = Object.create(null);
      for (const arg of argsNodes) {
        // Note: While this could make assertions to get the correctly typed
        // value, that would throw immediately while type system validation
        // with validateSchema() will produce more actionable results.
        const type: any = typeFromAST(arg.type);

        argConfigMap[arg.name.value] = {
          type,
          description: arg.description?.value,
          default: arg.defaultValue && { literal: arg.defaultValue },
          deprecationReason: getDeprecationReason(arg),
          extensions: argSupplements?.[arg.name.value]?.extensions,
          astNode: arg,
        };
      }
      return argConfigMap;
    }

    function buildInputFieldMap(
      nodes: ReadonlyArray<
        InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode
      >,
      fieldSupplements:
        | Readonly<ObjMap<GraphQLInputFieldSupplementalConfig>>
        | undefined,
    ): GraphQLInputFieldNormalizedConfigMap {
      const inputFieldMap = Object.create(null);
      for (const node of nodes) {
        const fieldsNodes = node.fields ?? [];

        for (const field of fieldsNodes) {
          const fieldSupplement = fieldSupplements?.[field.name.value];

          // Note: While this could make assertions to get the correctly typed
          // value, that would throw immediately while type system validation
          // with validateSchema() will produce more actionable results.
          const type: any = typeFromAST(field.type);

          inputFieldMap[field.name.value] = {
            type,
            description: field.description?.value,
            default: field.defaultValue && { literal: field.defaultValue },
            deprecationReason: getDeprecationReason(field),
            extensions: fieldSupplement?.extensions,
            astNode: field,
          };
        }
      }
      return inputFieldMap;
    }

    function buildEnumValueMap(
      nodes: ReadonlyArray<EnumTypeDefinitionNode | EnumTypeExtensionNode>,
      valueSupplements:
        | Readonly<ObjMap<GraphQLEnumValueSupplementalConfig>>
        | undefined,
    ): GraphQLEnumValueNormalizedConfigMap {
      const enumValueMap = Object.create(null);
      for (const node of nodes) {
        const valuesNodes = node.values ?? [];

        for (const value of valuesNodes) {
          const valueSupplement = valueSupplements?.[value.name.value];

          enumValueMap[value.name.value] = {
            description: value.description?.value,
            value: valueSupplement?.value,
            deprecationReason: getDeprecationReason(value),
            extensions: valueSupplement?.extensions,
            astNode: value,
          };
        }
      }
      return enumValueMap;
    }

    function buildInterfaces(
      nodes: ReadonlyArray<
        | InterfaceTypeDefinitionNode
        | InterfaceTypeExtensionNode
        | ObjectTypeDefinitionNode
        | ObjectTypeExtensionNode
      >,
    ): Array<GraphQLInterfaceType> {
      // Note: While this could make assertions to get the correctly typed
      // values below, that would throw immediately while type system
      // validation with validateSchema() will produce more actionable results.
      // @ts-expect-error
      return nodes.flatMap(
        (node) => node.interfaces?.map(namedTypeFromAST) ?? [],
      );
    }

    function buildUnionTypes(
      nodes: ReadonlyArray<UnionTypeDefinitionNode | UnionTypeExtensionNode>,
    ): Array<GraphQLObjectType> {
      // Note: While this could make assertions to get the correctly typed
      // values below, that would throw immediately while type system
      // validation with validateSchema() will produce more actionable results.
      // @ts-expect-error
      return nodes.flatMap((node) => node.types?.map(namedTypeFromAST) ?? []);
    }

    function buildNamedType(astNode: TypeDefinitionNode): GraphQLNamedType {
      const name = astNode.name.value;

      switch (astNode.kind) {
        case Kind.OBJECT_TYPE_DEFINITION: {
          const extensionASTNodes = objectExtensions.get(name) ?? [];
          const allNodes = [astNode, ...extensionASTNodes];
          const objectTypeSupplement = objectTypeSupplementalConfigMap?.[name];

          return new GraphQLObjectType({
            name,
            description: astNode.description?.value,
            interfaces: () => buildInterfaces(allNodes),
            fields: () => buildFieldMap(allNodes, objectTypeSupplement?.fields),
            isTypeOf: objectTypeSupplement?.isTypeOf,
            extensions: objectTypeSupplement?.extensions,
            astNode,
            extensionASTNodes,
          });
        }
        case Kind.INTERFACE_TYPE_DEFINITION: {
          const extensionASTNodes = interfaceExtensions.get(name) ?? [];
          const allNodes = [astNode, ...extensionASTNodes];
          const interfaceTypeSupplement =
            interfaceTypeSupplementalConfigMap?.[name];

          return new GraphQLInterfaceType({
            name,
            description: astNode.description?.value,
            interfaces: () => buildInterfaces(allNodes),
            fields: () =>
              buildFieldMap(allNodes, interfaceTypeSupplement?.fields),
            resolveType: interfaceTypeSupplement?.resolveType,
            extensions: interfaceTypeSupplement?.extensions,
            astNode,
            extensionASTNodes,
          });
        }
        case Kind.ENUM_TYPE_DEFINITION: {
          const extensionASTNodes = enumExtensions.get(name) ?? [];
          const allNodes = [astNode, ...extensionASTNodes];
          const enumTypeSupplement = enumTypeSupplementalConfigMap?.[name];

          return new GraphQLEnumType({
            name,
            description: astNode.description?.value,
            values: () =>
              buildEnumValueMap(allNodes, enumTypeSupplement?.values),
            extensions: enumTypeSupplement?.extensions,
            astNode,
            extensionASTNodes,
          });
        }
        case Kind.UNION_TYPE_DEFINITION: {
          const extensionASTNodes = unionExtensions.get(name) ?? [];
          const allNodes = [astNode, ...extensionASTNodes];
          const unionTypeSupplement = unionTypeSupplementalConfigMap?.[name];

          return new GraphQLUnionType({
            name,
            description: astNode.description?.value,
            types: () => buildUnionTypes(allNodes),
            resolveType: unionTypeSupplement?.resolveType,
            extensions: unionTypeSupplement?.extensions,
            astNode,
            extensionASTNodes,
          });
        }
        case Kind.SCALAR_TYPE_DEFINITION: {
          const extensionASTNodes = scalarExtensions.get(name) ?? [];
          let specifiedByURL = getSpecifiedByURL(astNode);
          for (const extensionNode of extensionASTNodes) {
            specifiedByURL = getSpecifiedByURL(extensionNode) ?? specifiedByURL;
          }
          const scalarTypeSupplement = scalarTypeSupplementalConfigMap?.[name];
          return new GraphQLScalarType({
            name,
            description: astNode.description?.value,
            specifiedByURL,
            serialize: scalarTypeSupplement?.serialize,
            parseValue: scalarTypeSupplement?.parseValue,
            parseLiteral: scalarTypeSupplement?.parseLiteral,
            coerceOutputValue: scalarTypeSupplement?.coerceOutputValue,
            coerceInputValue: scalarTypeSupplement?.coerceInputValue,
            coerceInputLiteral: scalarTypeSupplement?.coerceInputLiteral,
            valueToLiteral: scalarTypeSupplement?.valueToLiteral,
            extensions: scalarTypeSupplement?.extensions,
            astNode,
            extensionASTNodes,
          });
        }
        case Kind.INPUT_OBJECT_TYPE_DEFINITION: {
          const extensionASTNodes = inputObjectExtensions.get(name) ?? [];
          const allNodes = [astNode, ...extensionASTNodes];
          const inputObjectTypeSupplement =
            inputObjectTypeSupplementalConfigMap?.[name];

          return new GraphQLInputObjectType({
            name,
            description: astNode.description?.value,
            fields: () =>
              buildInputFieldMap(allNodes, inputObjectTypeSupplement?.fields),
            extensions: inputObjectTypeSupplement?.extensions,
            astNode,
            extensionASTNodes,
            isOneOf: Boolean(
              getDirectiveValues(GraphQLOneOfDirective, astNode),
            ),
          });
        }
      }
    }
  });

  function validateSchemaSupplementalConfig(
    config: Readonly<GraphQLSchemaSupplementalConfig>,
  ): void {
    if (
      config.extensions !== undefined &&
      Reflect.ownKeys(schemaConfig.extensions).length > 0
    ) {
      throw new Error(
        'Schema supplemental config cannot add extensions to a schema that already has extensions.',
      );
    }

    function getExistingType(typeName: string): GraphQLNamedType | undefined {
      return schemaConfig.types.find((type) => type.name === typeName);
    }

    function getTypeDef(typeName: string): TypeDefinitionNode | undefined {
      return typeDefs.find((typeDef) => typeDef.name.value === typeName);
    }

    function throwTypeSupplementalConfigCannotModifyExistingType(
      typeName: string,
      expectedConfigKey: SupplementalTypeConfigKey,
    ): never {
      const actualConfigKey = getDocumentTypeConfigKey(typeName);
      if (
        actualConfigKey !== undefined &&
        actualConfigKey !== expectedConfigKey
      ) {
        throwTypeSupplementalConfigMismatch(typeName, expectedConfigKey);
      }

      throw new Error(
        `Type supplemental config "${typeName}" cannot modify an existing type.`,
      );
    }

    function throwTypeSupplementalConfigMismatch(
      typeName: string,
      expectedConfigKey: SupplementalTypeConfigKey,
    ): never {
      const actualConfigKey = getDocumentTypeConfigKey(typeName);
      throw new Error(
        actualConfigKey !== undefined && actualConfigKey !== expectedConfigKey
          ? `Type supplemental config property "${expectedConfigKey}.${typeName}" does not match the type declared or extended by the document. Did you mean "${actualConfigKey}.${typeName}"?`
          : `Type supplemental config "${typeName}" does not match a type declared by the document.`,
      );
    }

    function getDocumentTypeConfigKey(
      typeName: string,
    ): SupplementalTypeConfigKey | undefined {
      const typeDef = getTypeDef(typeName);
      if (typeDef !== undefined) {
        return typeConfigKeyByTypeDefinitionKind[typeDef.kind];
      }

      return (
        [
          [scalarExtensions, 'scalarTypes'],
          [objectExtensions, 'objectTypes'],
          [interfaceExtensions, 'interfaceTypes'],
          [unionExtensions, 'unionTypes'],
          [enumExtensions, 'enumTypes'],
          [inputObjectExtensions, 'inputObjectTypes'],
        ] as const
      ).find(([extensions]) => extensions.get(typeName) !== undefined)?.[1];
    }

    function assertTypeDefinitionKind<K extends TypeDefinitionNode['kind']>(
      typeName: string,
      typeDef: TypeDefinitionNode | undefined,
      expectedKind: K,
      expectedConfigKey: SupplementalTypeConfigKey,
    ): asserts typeDef is Extract<TypeDefinitionNode, { kind: K }> {
      if (typeDef?.kind !== expectedKind) {
        throwTypeSupplementalConfigMismatch(typeName, expectedConfigKey);
      }
    }

    const scalarTypeSupplements = config.scalarTypes;
    if (scalarTypeSupplements !== undefined) {
      for (const typeName of Object.keys(scalarTypeSupplements)) {
        const typeSupplement = scalarTypeSupplements[typeName];
        const existingType = getExistingType(typeName);

        if (existingType !== undefined) {
          if (
            isScalarType(existingType) &&
            scalarExtensions.get(typeName) !== undefined
          ) {
            assertTypeExtensionSupplementalConfigKeys(typeName, typeSupplement);
            continue;
          }
          throwTypeSupplementalConfigCannotModifyExistingType(
            typeName,
            'scalarTypes',
          );
        }

        const typeDef = getTypeDef(typeName);
        assertTypeDefinitionKind(
          typeName,
          typeDef,
          Kind.SCALAR_TYPE_DEFINITION,
          'scalarTypes',
        );
      }
    }

    const objectTypeSupplements = config.objectTypes;
    if (objectTypeSupplements !== undefined) {
      for (const typeName of Object.keys(objectTypeSupplements)) {
        const typeSupplement = objectTypeSupplements[typeName];
        const existingType = getExistingType(typeName);

        if (existingType !== undefined) {
          const extensionNodes = objectExtensions.get(typeName);
          if (isObjectType(existingType) && extensionNodes !== undefined) {
            assertTypeExtensionSupplementalConfigKeys(
              typeName,
              typeSupplement,
              'fields',
            );
            validateFieldSupplementalConfigs(
              typeName,
              typeSupplement.fields,
              extensionNodes.flatMap((node) => node.fields ?? []),
              existingType,
            );
            continue;
          }
          throwTypeSupplementalConfigCannotModifyExistingType(
            typeName,
            'objectTypes',
          );
        }

        const typeDef = getTypeDef(typeName);
        assertTypeDefinitionKind(
          typeName,
          typeDef,
          Kind.OBJECT_TYPE_DEFINITION,
          'objectTypes',
        );

        validateFieldSupplementalConfigs(
          typeName,
          typeSupplement.fields,
          [typeDef, ...(objectExtensions.get(typeName) ?? [])].flatMap(
            (node) => node.fields ?? [],
          ),
        );
      }
    }

    const interfaceTypeSupplements = config.interfaceTypes;
    if (interfaceTypeSupplements !== undefined) {
      for (const typeName of Object.keys(interfaceTypeSupplements)) {
        const typeSupplement = interfaceTypeSupplements[typeName];
        const existingType = getExistingType(typeName);

        if (existingType !== undefined) {
          const extensionNodes = interfaceExtensions.get(typeName);
          if (isInterfaceType(existingType) && extensionNodes !== undefined) {
            assertTypeExtensionSupplementalConfigKeys(
              typeName,
              typeSupplement,
              'fields',
            );
            validateFieldSupplementalConfigs(
              typeName,
              typeSupplement.fields,
              extensionNodes.flatMap((node) => node.fields ?? []),
              existingType,
            );
            continue;
          }
          throwTypeSupplementalConfigCannotModifyExistingType(
            typeName,
            'interfaceTypes',
          );
        }

        const typeDef = getTypeDef(typeName);
        assertTypeDefinitionKind(
          typeName,
          typeDef,
          Kind.INTERFACE_TYPE_DEFINITION,
          'interfaceTypes',
        );

        validateFieldSupplementalConfigs(
          typeName,
          typeSupplement.fields,
          [typeDef, ...(interfaceExtensions.get(typeName) ?? [])].flatMap(
            (node) => node.fields ?? [],
          ),
        );
      }
    }

    const unionTypeSupplements = config.unionTypes;
    if (unionTypeSupplements !== undefined) {
      for (const typeName of Object.keys(unionTypeSupplements)) {
        const typeSupplement = unionTypeSupplements[typeName];
        const existingType = getExistingType(typeName);

        if (existingType !== undefined) {
          if (
            isUnionType(existingType) &&
            unionExtensions.get(typeName) !== undefined
          ) {
            assertTypeExtensionSupplementalConfigKeys(typeName, typeSupplement);
            continue;
          }
          throwTypeSupplementalConfigCannotModifyExistingType(
            typeName,
            'unionTypes',
          );
        }

        const typeDef = getTypeDef(typeName);
        assertTypeDefinitionKind(
          typeName,
          typeDef,
          Kind.UNION_TYPE_DEFINITION,
          'unionTypes',
        );
      }
    }

    const enumTypeSupplements = config.enumTypes;
    if (enumTypeSupplements !== undefined) {
      for (const typeName of Object.keys(enumTypeSupplements)) {
        const typeSupplement = enumTypeSupplements[typeName];
        const existingType = getExistingType(typeName);

        if (existingType !== undefined) {
          const extensionNodes = enumExtensions.get(typeName);
          if (isEnumType(existingType) && extensionNodes !== undefined) {
            assertTypeExtensionSupplementalConfigKeys(
              typeName,
              typeSupplement,
              'values',
            );
            validateEnumValueSupplementalConfigs(
              typeName,
              typeSupplement.values,
              extensionNodes.flatMap((node) => node.values ?? []),
              existingType,
            );
            continue;
          }
          throwTypeSupplementalConfigCannotModifyExistingType(
            typeName,
            'enumTypes',
          );
        }

        const typeDef = getTypeDef(typeName);
        assertTypeDefinitionKind(
          typeName,
          typeDef,
          Kind.ENUM_TYPE_DEFINITION,
          'enumTypes',
        );

        validateEnumValueSupplementalConfigs(
          typeName,
          typeSupplement.values,
          [typeDef, ...(enumExtensions.get(typeName) ?? [])].flatMap(
            (node) => node.values ?? [],
          ),
        );
      }
    }

    const inputObjectTypeSupplements = config.inputObjectTypes;
    if (inputObjectTypeSupplements !== undefined) {
      for (const typeName of Object.keys(inputObjectTypeSupplements)) {
        const typeSupplement = inputObjectTypeSupplements[typeName];
        const existingType = getExistingType(typeName);

        if (existingType !== undefined) {
          const extensionNodes = inputObjectExtensions.get(typeName);
          if (isInputObjectType(existingType) && extensionNodes !== undefined) {
            assertTypeExtensionSupplementalConfigKeys(
              typeName,
              typeSupplement,
              'fields',
            );
            validateInputFieldSupplementalConfigs(
              typeName,
              typeSupplement.fields,
              extensionNodes.flatMap((node) => node.fields ?? []),
              existingType,
            );
            continue;
          }
          throwTypeSupplementalConfigCannotModifyExistingType(
            typeName,
            'inputObjectTypes',
          );
        }

        const typeDef = getTypeDef(typeName);
        assertTypeDefinitionKind(
          typeName,
          typeDef,
          Kind.INPUT_OBJECT_TYPE_DEFINITION,
          'inputObjectTypes',
        );

        validateInputFieldSupplementalConfigs(
          typeName,
          typeSupplement.fields,
          [typeDef, ...(inputObjectExtensions.get(typeName) ?? [])].flatMap(
            (node) => node.fields ?? [],
          ),
        );
      }
    }

    const directiveSupplements = config.directives;
    if (directiveSupplements !== undefined) {
      for (const directiveName of Object.keys(directiveSupplements)) {
        const directiveSupplement = directiveSupplements[directiveName];
        const directiveDef = directiveDefs.find(
          (def) => def.name.value === directiveName,
        );

        if (directiveDef === undefined) {
          throw new Error(
            `Directive supplemental config "@${directiveName}" does not match a directive declared by the document.`,
          );
        }

        validateArgumentSupplementalConfigs(
          directiveSupplement?.args,
          directiveDef.arguments ?? [],
          `@${directiveName}`,
        );
      }
    }
  }

  function assertTypeExtensionSupplementalConfigKeys(
    typeName: string,
    typeSupplement: object,
    allowedKey?: 'fields' | 'values',
  ): void {
    const typeSupplementMap = typeSupplement as Readonly<ObjMap<unknown>>;
    for (const key of Object.keys(typeSupplementMap)) {
      if (key !== allowedKey && typeSupplementMap[key] !== undefined) {
        throw new Error(
          `Type supplemental config "${typeName}.${key}" cannot modify an existing type.`,
        );
      }
    }
  }

  function validateFieldSupplementalConfigs(
    typeName: string,
    fieldSupplements:
      | Readonly<ObjMap<GraphQLFieldSupplementalConfig>>
      | undefined,
    fieldNodes: ReadonlyArray<FieldDefinitionNode>,
    existingType?: GraphQLObjectType | GraphQLInterfaceType,
  ): void {
    if (fieldSupplements === undefined) {
      return;
    }

    for (const fieldName of Object.keys(fieldSupplements)) {
      const fieldNode = fieldNodes.find(
        (field) => field.name.value === fieldName,
      );

      if (fieldNode === undefined) {
        throw new Error(
          `Field supplemental config "${typeName}.${fieldName}" does not match a field declared by the document.`,
        );
      }

      if (existingType?.getFields()[fieldName] !== undefined) {
        throw new Error(
          `Field supplemental config "${typeName}.${fieldName}" cannot modify an existing field.`,
        );
      }

      const fieldSupplement = fieldSupplements[fieldName];
      if (typeof fieldSupplement === 'function') {
        continue;
      }

      validateArgumentSupplementalConfigs(
        fieldSupplement?.args,
        fieldNode.arguments ?? [],
        `${typeName}.${fieldName}`,
      );
    }
  }

  function validateInputFieldSupplementalConfigs(
    typeName: string,
    fieldSupplements:
      | Readonly<ObjMap<GraphQLInputFieldSupplementalConfig>>
      | undefined,
    fieldNodes: ReadonlyArray<InputValueDefinitionNode>,
    existingType?: GraphQLInputObjectType,
  ): void {
    if (fieldSupplements === undefined) {
      return;
    }

    for (const fieldName of Object.keys(fieldSupplements)) {
      if (!fieldNodes.some((field) => field.name.value === fieldName)) {
        throw new Error(
          `Input field supplemental config "${typeName}.${fieldName}" does not match an input field declared by the document.`,
        );
      }

      if (existingType?.getFields()[fieldName] !== undefined) {
        throw new Error(
          `Input field supplemental config "${typeName}.${fieldName}" cannot modify an existing input field.`,
        );
      }
    }
  }

  function validateEnumValueSupplementalConfigs(
    typeName: string,
    valueSupplements:
      | Readonly<ObjMap<GraphQLEnumValueSupplementalConfig>>
      | undefined,
    valueNodes: ReadonlyArray<EnumValueDefinitionNode>,
    existingType?: GraphQLEnumType,
  ): void {
    if (valueSupplements === undefined) {
      return;
    }

    for (const valueName of Object.keys(valueSupplements)) {
      if (!valueNodes.some((value) => value.name.value === valueName)) {
        throw new Error(
          `Enum value supplemental config "${typeName}.${valueName}" does not match an enum value declared by the document.`,
        );
      }

      if (existingType?.getValue(valueName) !== undefined) {
        throw new Error(
          `Enum value supplemental config "${typeName}.${valueName}" cannot modify an existing enum value.`,
        );
      }
    }
  }

  function validateArgumentSupplementalConfigs(
    argSupplements:
      | Readonly<ObjMap<GraphQLArgumentSupplementalConfig>>
      | undefined,
    argNodes: ReadonlyArray<InputValueDefinitionNode>,
    ownerCoordinate: string,
  ): void {
    if (argSupplements === undefined) {
      return;
    }

    for (const argName of Object.keys(argSupplements)) {
      if (!argNodes.some((arg) => arg.name.value === argName)) {
        throw new Error(
          `Argument supplemental config "${ownerCoordinate}(${argName}:)" does not match an argument declared by the document.`,
        );
      }
    }
  }

  return extendedConfig;
}

const stdTypeMap = new Map(
  [...specifiedScalarTypes, ...introspectionTypes].map((type) => [
    type.name,
    type,
  ]),
);

/**
 * Given a field or enum value node, returns the string value for the
 * deprecation reason.
 *
 * @internal
 */
function getDeprecationReason(
  node:
    | EnumValueDefinitionNode
    | FieldDefinitionNode
    | InputValueDefinitionNode
    | DirectiveDefinitionNode
    | DirectiveExtensionNode,
): Maybe<string> {
  const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
  // @ts-expect-error validated by `getDirectiveValues`
  return deprecated?.reason;
}

/**
 * Given a scalar node, returns the string value for the specifiedByURL.
 *
 * @internal
 */
function getSpecifiedByURL(
  node: ScalarTypeDefinitionNode | ScalarTypeExtensionNode,
): Maybe<string> {
  const specifiedBy = getDirectiveValues(GraphQLSpecifiedByDirective, node);
  // @ts-expect-error validated by `getDirectiveValues`
  return specifiedBy?.url;
}
