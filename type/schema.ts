import { inspect } from '../jsutils/inspect.ts';
import { instanceOf } from '../jsutils/instanceOf.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import { toObjMap } from '../jsutils/toObjMap.ts';
import type { GraphQLError } from '../error/GraphQLError.ts';
import type {
  SchemaDefinitionNode,
  SchemaExtensionNode,
} from '../language/ast.ts';
import { OperationTypeNode } from '../language/ast.ts';
import type {
  GraphQLAbstractType,
  GraphQLCompositeType,
  GraphQLField,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLType,
} from './definition.ts';
import {
  getNamedType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isUnionType,
} from './definition.ts';
import type { GraphQLDirective } from './directives.ts';
import { isDirective, specifiedDirectives } from './directives.ts';
import {
  __Schema,
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from './introspection.ts';
/**
 * Test if the given value is a GraphQL schema.
 */
export function isSchema(schema: unknown): schema is GraphQLSchema {
  return instanceOf(schema, GraphQLSchema);
}
export function assertSchema(schema: unknown): GraphQLSchema {
  if (!isSchema(schema)) {
    throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
  }
  return schema;
}
/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLSchemaExtensions {
  [attributeName: string]: unknown;
}
/**
 * Schema Definition
 *
 * A Schema is created by supplying the root types of each type of operation,
 * query and mutation (optional). A schema definition is then supplied to the
 * validator and executor.
 *
 * Example:
 *
 * ```ts
 * const MyAppSchema = new GraphQLSchema({
 *   query: MyAppQueryRootType,
 *   mutation: MyAppMutationRootType,
 * })
 * ```
 *
 * Note: When the schema is constructed, by default only the types that are
 * reachable by traversing the root types are included, other types must be
 * explicitly referenced.
 *
 * Example:
 *
 * ```ts
 * const characterInterface = new GraphQLInterfaceType({
 *   name: 'Character',
 *   ...
 * });
 *
 * const humanType = new GraphQLObjectType({
 *   name: 'Human',
 *   interfaces: [characterInterface],
 *   ...
 * });
 *
 * const droidType = new GraphQLObjectType({
 *   name: 'Droid',
 *   interfaces: [characterInterface],
 *   ...
 * });
 *
 * const schema = new GraphQLSchema({
 *   query: new GraphQLObjectType({
 *     name: 'Query',
 *     fields: {
 *       hero: { type: characterInterface, ... },
 *     }
 *   }),
 *   ...
 *   // Since this schema references only the `Character` interface it's
 *   // necessary to explicitly list the types that implement it if
 *   // you want them to be included in the final schema.
 *   types: [humanType, droidType],
 * })
 * ```
 *
 * Note: If an array of `directives` are provided to GraphQLSchema, that will be
 * the exact list of directives represented and allowed. If `directives` is not
 * provided then a default set of the specified directives (e.g. `@include` and
 * `@skip`) will be used. If you wish to provide *additional* directives to these
 * specified directives, you must explicitly declare them. Example:
 *
 * ```ts
 * const MyAppSchema = new GraphQLSchema({
 *   ...
 *   directives: specifiedDirectives.concat([ myCustomDirective ]),
 * })
 * ```
 */
export class GraphQLSchema {
  description: Maybe<string>;
  extensions: Readonly<GraphQLSchemaExtensions>;
  astNode: Maybe<SchemaDefinitionNode>;
  extensionASTNodes: ReadonlyArray<SchemaExtensionNode>;
  // Used as a cache for validateSchema().
  __validationErrors: Maybe<ReadonlyArray<GraphQLError>>;
  private _queryType: Maybe<GraphQLObjectType>;
  private _mutationType: Maybe<GraphQLObjectType>;
  private _subscriptionType: Maybe<GraphQLObjectType>;
  private _directives: ReadonlyArray<GraphQLDirective>;
  private _typeMap: TypeMap;
  private _subTypeMap: Map<
    GraphQLAbstractType,
    Set<GraphQLObjectType | GraphQLInterfaceType>
  >;
  private _implementationsMap: ObjMap<{
    objects: Array<GraphQLObjectType>;
    interfaces: Array<GraphQLInterfaceType>;
  }>;
  constructor(config: Readonly<GraphQLSchemaConfig>) {
    // If this schema was built from a source known to be valid, then it may be
    // marked with assumeValid to avoid an additional type system validation.
    this.__validationErrors = config.assumeValid === true ? [] : undefined;
    this.description = config.description;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];
    this._queryType = config.query;
    this._mutationType = config.mutation;
    this._subscriptionType = config.subscription;
    // Provide specified directives (e.g. @include and @skip) by default.
    this._directives = config.directives ?? specifiedDirectives;
    // To preserve order of user-provided types, we add first to add them to
    // the set of "collected" types, so `collectReferencedTypes` ignore them.
    const allReferencedTypes = new Set<GraphQLNamedType>(config.types);
    if (config.types != null) {
      for (const type of config.types) {
        // When we ready to process this type, we remove it from "collected" types
        // and then add it together with all dependent types in the correct position.
        allReferencedTypes.delete(type);
        collectReferencedTypes(type, allReferencedTypes);
      }
    }
    if (this._queryType != null) {
      collectReferencedTypes(this._queryType, allReferencedTypes);
    }
    if (this._mutationType != null) {
      collectReferencedTypes(this._mutationType, allReferencedTypes);
    }
    if (this._subscriptionType != null) {
      collectReferencedTypes(this._subscriptionType, allReferencedTypes);
    }
    for (const directive of this._directives) {
      // Directives are not validated until validateSchema() is called.
      if (isDirective(directive)) {
        for (const arg of directive.args) {
          collectReferencedTypes(arg.type, allReferencedTypes);
        }
      }
    }
    collectReferencedTypes(__Schema, allReferencedTypes);
    // Storing the resulting map for reference by the schema.
    this._typeMap = Object.create(null);
    this._subTypeMap = new Map();
    // Keep track of all implementations by interface name.
    this._implementationsMap = Object.create(null);
    for (const namedType of allReferencedTypes) {
      if (namedType == null) {
        continue;
      }
      const typeName = namedType.name;
      if (this._typeMap[typeName] !== undefined) {
        throw new Error(
          `Schema must contain uniquely named types but contains multiple types named "${typeName}".`,
        );
      }
      this._typeMap[typeName] = namedType;
      if (isInterfaceType(namedType)) {
        // Store implementations by interface.
        for (const iface of namedType.getInterfaces()) {
          if (isInterfaceType(iface)) {
            let implementations = this._implementationsMap[iface.name];
            if (implementations === undefined) {
              implementations = this._implementationsMap[iface.name] = {
                objects: [],
                interfaces: [],
              };
            }
            implementations.interfaces.push(namedType);
          }
        }
      } else if (isObjectType(namedType)) {
        // Store implementations by objects.
        for (const iface of namedType.getInterfaces()) {
          if (isInterfaceType(iface)) {
            let implementations = this._implementationsMap[iface.name];
            if (implementations === undefined) {
              implementations = this._implementationsMap[iface.name] = {
                objects: [],
                interfaces: [],
              };
            }
            implementations.objects.push(namedType);
          }
        }
      }
    }
  }
  get [Symbol.toStringTag]() {
    return 'GraphQLSchema';
  }
  getQueryType(): Maybe<GraphQLObjectType> {
    return this._queryType;
  }
  getMutationType(): Maybe<GraphQLObjectType> {
    return this._mutationType;
  }
  getSubscriptionType(): Maybe<GraphQLObjectType> {
    return this._subscriptionType;
  }
  getRootType(operation: OperationTypeNode): Maybe<GraphQLObjectType> {
    switch (operation) {
      case OperationTypeNode.QUERY:
        return this.getQueryType();
      case OperationTypeNode.MUTATION:
        return this.getMutationType();
      case OperationTypeNode.SUBSCRIPTION:
        return this.getSubscriptionType();
    }
  }
  getTypeMap(): TypeMap {
    return this._typeMap;
  }
  getType(name: string): GraphQLNamedType | undefined {
    return this.getTypeMap()[name];
  }
  getPossibleTypes(
    abstractType: GraphQLAbstractType,
  ): ReadonlyArray<GraphQLObjectType> {
    return isUnionType(abstractType)
      ? abstractType.getTypes()
      : this.getImplementations(abstractType).objects;
  }
  getImplementations(interfaceType: GraphQLInterfaceType): {
    objects: ReadonlyArray<GraphQLObjectType>;
    interfaces: ReadonlyArray<GraphQLInterfaceType>;
  } {
    const implementations = this._implementationsMap[interfaceType.name];
    return implementations ?? { objects: [], interfaces: [] };
  }
  isSubType(
    abstractType: GraphQLAbstractType,
    maybeSubType: GraphQLObjectType | GraphQLInterfaceType,
  ): boolean {
    let set = this._subTypeMap.get(abstractType);
    if (set === undefined) {
      if (isUnionType(abstractType)) {
        set = new Set<GraphQLObjectType>(abstractType.getTypes());
      } else {
        const implementations = this.getImplementations(abstractType);
        set = new Set<GraphQLObjectType | GraphQLInterfaceType>([
          ...implementations.objects,
          ...implementations.interfaces,
        ]);
      }
      this._subTypeMap.set(abstractType, set);
    }
    return set.has(maybeSubType);
  }
  getDirectives(): ReadonlyArray<GraphQLDirective> {
    return this._directives;
  }
  getDirective(name: string): Maybe<GraphQLDirective> {
    return this.getDirectives().find((directive) => directive.name === name);
  }
  /**
   * This method looks up the field on the given type definition.
   * It has special casing for the three introspection fields, `__schema`,
   * `__type` and `__typename`.
   *
   * `__typename` is special because it can always be queried as a field, even
   * in situations where no other fields are allowed, like on a Union.
   *
   * `__schema` and `__type` could get automatically added to the query type,
   * but that would require mutating type definitions, which would cause issues.
   */
  getField(
    parentType: GraphQLCompositeType,
    fieldName: string,
  ): GraphQLField<unknown, unknown> | undefined {
    switch (fieldName) {
      case SchemaMetaFieldDef.name:
        return this.getQueryType() === parentType
          ? SchemaMetaFieldDef
          : undefined;
      case TypeMetaFieldDef.name:
        return this.getQueryType() === parentType
          ? TypeMetaFieldDef
          : undefined;
      case TypeNameMetaFieldDef.name:
        return TypeNameMetaFieldDef;
    }
    // this function is part "hot" path inside executor and check presence
    // of 'getFields' is faster than to use `!isUnionType`
    if ('getFields' in parentType) {
      return parentType.getFields()[fieldName];
    }
    return undefined;
  }
  toConfig(): GraphQLSchemaNormalizedConfig {
    return {
      description: this.description,
      query: this.getQueryType(),
      mutation: this.getMutationType(),
      subscription: this.getSubscriptionType(),
      types: Object.values(this.getTypeMap()),
      directives: this.getDirectives(),
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
      assumeValid: this.__validationErrors !== undefined,
    };
  }
}
type TypeMap = ObjMap<GraphQLNamedType>;
export interface GraphQLSchemaValidationOptions {
  /**
   * When building a schema from a GraphQL service's introspection result, it
   * might be safe to assume the schema is valid. Set to true to assume the
   * produced schema is valid.
   *
   * Default: false
   */
  assumeValid?: boolean | undefined;
}
export interface GraphQLSchemaConfig extends GraphQLSchemaValidationOptions {
  description?: Maybe<string>;
  query?: Maybe<GraphQLObjectType>;
  mutation?: Maybe<GraphQLObjectType>;
  subscription?: Maybe<GraphQLObjectType>;
  types?: Maybe<ReadonlyArray<GraphQLNamedType>>;
  directives?: Maybe<ReadonlyArray<GraphQLDirective>>;
  extensions?: Maybe<Readonly<GraphQLSchemaExtensions>>;
  astNode?: Maybe<SchemaDefinitionNode>;
  extensionASTNodes?: Maybe<ReadonlyArray<SchemaExtensionNode>>;
}
/**
 * @internal
 */
export interface GraphQLSchemaNormalizedConfig extends GraphQLSchemaConfig {
  description: Maybe<string>;
  types: ReadonlyArray<GraphQLNamedType>;
  directives: ReadonlyArray<GraphQLDirective>;
  extensions: Readonly<GraphQLSchemaExtensions>;
  extensionASTNodes: ReadonlyArray<SchemaExtensionNode>;
  assumeValid: boolean;
}
function collectReferencedTypes(
  type: GraphQLType,
  typeSet: Set<GraphQLNamedType>,
): Set<GraphQLNamedType> {
  const namedType = getNamedType(type);
  if (!typeSet.has(namedType)) {
    typeSet.add(namedType);
    if (isUnionType(namedType)) {
      for (const memberType of namedType.getTypes()) {
        collectReferencedTypes(memberType, typeSet);
      }
    } else if (isObjectType(namedType) || isInterfaceType(namedType)) {
      for (const interfaceType of namedType.getInterfaces()) {
        collectReferencedTypes(interfaceType, typeSet);
      }
      for (const field of Object.values(namedType.getFields())) {
        collectReferencedTypes(field.type, typeSet);
        for (const arg of field.args) {
          collectReferencedTypes(arg.type, typeSet);
        }
      }
    } else if (isInputObjectType(namedType)) {
      for (const field of Object.values(namedType.getFields())) {
        collectReferencedTypes(field.type, typeSet);
      }
    }
  }
  return typeSet;
}
