type undefined = void

// TODO: Test that this is open-ended.
export interface GraphQLContext {}

export function graphql (
  schema: GraphQLSchema,
  requestString: string,
  rootValue?: any,
  contextValue?: GraphQLContext,
  variableValues?: { [key: string]: any } | undefined,
  operationName?: string
): Promise<GraphQLResult>

type GraphQLResult = {
  data?: any,
  errors?: GraphQLError[],
}

export class GraphQLSchema {
  constructor (config: GraphQLSchemaConfig)
  getQueryType (): GraphQLObjectType<any>
  getMutationType (): GraphQLObjectType<any> | undefined
  getSubscriptionType (): GraphQLObjectType<any> | undefined
  getTypeMap (): TypeMap
  getType (name: string): GraphQLNamedType<any> | undefined
  getPossibleTypes <T>(abstractType: GraphQLAbstractType<T>): GraphQLObjectType<T>
  isPossibleType <T>(abstractType: GraphQLAbstractType<T>, possibleType: GraphQLObjectType<T>): boolean
  getDirectives (): GraphQLDirective[]
  getDirective (name: string): GraphQLDirective | undefined
}

type TypeMap = {
  [typeName: string]: GraphQLNamedType<any>,
}

type GraphQLSchemaConfig = {
  query: GraphQLObjectType<any>,
  mutation?: GraphQLObjectType<any>,
  subscription?: GraphQLObjectType<any>,
  types?: GraphQLNamedType<any>[],
  directives?: GraphQLDirective[],
}

// TODO: GraphQLList and GraphQLNonNull should circularly reference
// GraphQLType. See the flow definitions.
type GraphQLType<T> =
  GraphQLScalarType<T> |
  GraphQLObjectType<T> |
  GraphQLInterfaceType<T> |
  GraphQLUnionType<T> |
  GraphQLEnumType<T> |
  GraphQLInputObjectType<T> |
  GraphQLList<T, any> |
  GraphQLNonNull<T, any>

export function isType (type: any): type is GraphQLType<any>

// TODO: GraphQLList and GraphQLNonNull should circularly reference
// GraphQLInputType. See the flow definitions.
type GraphQLInputType<T> =
  GraphQLScalarType<T> |
  GraphQLEnumType<T> |
  GraphQLInputObjectType<T> |
  GraphQLList<T, any> |
  GraphQLNonNull<T, any>

export function isInputType <T>(type: GraphQLType<T>): type is GraphQLInputType<T>

// TODO: GraphQLList and GraphQLNonNull should circularly reference
// GraphQLOutputType. See the flow definitions.
type GraphQLOutputType<T> =
  GraphQLScalarType<T> |
  GraphQLObjectType<T> |
  GraphQLInterfaceType<T> |
  GraphQLUnionType<T> |
  GraphQLEnumType<T> |
  GraphQLList<T, any> |
  GraphQLNonNull<T, any>

export function isOutputType <T>(type: GraphQLType<T>): type is GraphQLOutputType<T>

type GraphQLLeafType<T> =
  GraphQLScalarType<T> |
  GraphQLEnumType<T>

export function isLeafType <T>(type: GraphQLType<T>): type is GraphQLLeafType<T>

type GraphQLCompositeType<T> =
  GraphQLObjectType<T> |
  GraphQLInterfaceType<T> |
  GraphQLUnionType<T>

export function isCompositeType <T>(type: GraphQLType<T>): GraphQLCompositeType<T>

type GraphQLAbstractType<T> =
  GraphQLInterfaceType<T> |
  GraphQLUnionType<T>

export function isAbstractType <T>(type: GraphQLType<T>): type is GraphQLAbstractType<T>

type GraphQLNullableType<T> =
  GraphQLScalarType<T> |
  GraphQLObjectType<T> |
  GraphQLInterfaceType<T> |
  GraphQLUnionType<T> |
  GraphQLEnumType<T> |
  GraphQLInputObjectType<T> |
  GraphQLList<T, any>

export function getNullableType <T, U extends GraphQLType<T>>(type: U): GraphQLNullableType<T>

type GraphQLNamedType<T> =
  GraphQLScalarType<T> |
  GraphQLObjectType<T> |
  GraphQLInterfaceType<T> |
  GraphQLUnionType<T> |
  GraphQLEnumType<T> |
  GraphQLInputObjectType<T>

export function getNamedType <T, U extends GraphQLType<T>>(type: U): GraphQLNullableType<T>

type MaybeThunk<T> = (() => T) | T

export class GraphQLScalarType<TSource> {
  name: string
  description: string | undefined
  constructor (config: GraphQLScalarTypeConfig<TSource, any>)
  serialize (value: TSource): any
  parseValue (value: any): TSource | null
  parseLiteral (valueAST: Value): TSource | null
  toString (): string
}

type GraphQLScalarTypeConfig<TInternal, TExternal> = {
  name: string,
  description?: string | undefined,
  serialize (value: TInternal): TExternal,
  parseValue? (value: TExternal): TInternal | null,
  parseLiteral? (valueAST: Value): TInternal | null,
}

export class GraphQLObjectType<TSource> {
  name: string
  description: string | undefined
  isTypeOf: GraphQLIsTypeOfFn<TSource> | undefined
  constructor (config: GraphQLObjectTypeConfig<TSource>)
  getFields (): GraphQLFieldDefinitionMap<TSource>
  getInterfaces (): GraphQLInterfaceType<TSource>[]
  toString (): string
}

type GraphQLIsTypeOfFn<TSource> = (
  source: TSource,
  context: GraphQLContext,
  info: GraphQLResolveInfo<TSource, any>
) => boolean

type GraphQLResolveInfo<TSource, TResolve> = {
  fieldName: string,
  fieldASTs: Field[],
  returnType: GraphQLOutputType<TResolve>,
  parentType: GraphQLCompositeType<TSource>,
  path: (string | number)[],
  schema: GraphQLSchema,
  fragments: { [fragmentName: string]: FragmentDefinition }
  rootValue: any,
  operation: OperationDefinition,
  variableValues: { [variableName: string]: any },
}

type GraphQLObjectTypeConfig<TSource> = {
  name: string,
  interfaces?: MaybeThunk<GraphQLInterfaceType<TSource>[]>,
  fields: MaybeThunk<GraphQLFieldConfigMap<TSource>>,
  isTypeOf?: GraphQLIsTypeOfFn<TSource>,
  description?: string
}

type GraphQLFieldConfigMap<TSource> = {
  [fieldName: string]: GraphQLFieldConfig<TSource, any>,
}

type GraphQLFieldConfig<TSource, TResolve> = {
  type: GraphQLOutputType<TResolve>,
  args?: GraphQLFieldConfigArgumentMap,
  resolve: GraphQLFieldResolveFn<TSource, TResolve>,
  deprecationReason?: string | undefined,
  description?: string | undefined,
}

type GraphQLFieldConfigArgumentMap = {
  [argName: string]: GraphQLArgumentConfig<any>,
}

type GraphQLArgumentConfig<TArg> = {
  type: GraphQLInputType<TArg>,
  defaultValue?: TArg,
  description?: string | undefined,
}

type GraphQLFieldResolveFn<TSource, TResolve> = (
  source: TSource,
  args: { [argName: string]: any },
  context: GraphQLContext,
  info: GraphQLResolveInfo<TSource, TResolve>
) => TResolve

type GraphQLFieldDefinitionMap<TSource> = {
  [fieldName: string]: GraphQLFieldDefinition<TSource, any>,
}

type GraphQLFieldDefinition<TSource, TResolve> = {
  name: string,
  description: string | undefined,
  type: GraphQLOutputType<TResolve>,
  args: GraphQLArgument<any>[],
  resolve?: GraphQLFieldResolveFn<TSource, TResolve>,
  deprecationReason?: string | undefined,
}

type GraphQLArgument<TArg> = {
  name: string,
  type: GraphQLInputType<TArg>,
  defaultValue?: TArg,
  description?: string | undefined,
}

export class GraphQLInterfaceType<TSource> {
  name: string
  description: string | undefined
  resolveType: GraphQLTypeResolveFn<TSource> | undefined
  constructor (config: GraphQLInterfaceTypeConfig<TSource>)
  getFields (): GraphQLFieldDefinitionMap<TSource>
  toString (): string
}

type GraphQLInterfaceTypeConfig<TSource> = {
  name: string,
  fields: MaybeThunk<GraphQLFieldConfigMap<TSource>>,
  resolveType?: GraphQLTypeResolveFn<TSource> | undefined,
  description?: string | undefined,
}

export class GraphQLUnionType<TSource> {
  name: string
  description: string | undefined
  resolveType: GraphQLTypeResolveFn<TSource> | undefined
  constructor (config: GraphQLUnionTypeConfig<TSource>)
}

type GraphQLUnionTypeConfig<TSource> = {
  name: string,
  types: GraphQLObjectType<TSource>[],
  resolveType?: GraphQLTypeResolveFn<TSource>,
  description?: string | undefined,
}

type GraphQLTypeResolveFn<TSource> = (
  value: TSource,
  context: GraphQLContext,
  info: GraphQLResolveInfo<TSource, any>
) => GraphQLObjectType<TSource>

export class GraphQLEnumType<TSource> {
  name: string
  description: string | undefined
  constructor (config: GraphQLEnumTypeConfig<TSource>)
  getValues (): GraphQLEnumValueDefinition<TSource>[]
  serialize (value: TSource): string | undefined
  parseValue (value: any): TSource | undefined
  parseLiteral (valueAST: Value): TSource | undefined
  toString (): string
}

type GraphQLEnumTypeConfig<TSource> = {
  name: string,
  values: GraphQLEnumValueConfigMap<TSource>,
  description?: string | undefined,
}

type GraphQLEnumValueConfigMap<TSource> = {
  [valueName: string]: GraphQLEnumValueConfig<TSource>,
}

type GraphQLEnumValueConfig<TSource> = {
  value?: TSource,
  deprecationReason?: string | undefined,
  description?: string | undefined,
}

type GraphQLEnumValueDefinition<TSource> = {
  name: string,
  description: string | undefined,
  deprecationReason: string | undefined,
  value: TSource,
}

export class GraphQLInputObjectType<TSource> {
  name: string
  description: string | undefined
  constructor (config: GraphQLInputObjectConfig<TSource>)
  getFields (): GraphQLInputObjectFieldMap<TSource>
  toString (): string
}

type GraphQLInputObjectConfig<TSource> = {
  name: string,
  fields: MaybeThunk<GraphQLInputObjectConfigFieldMap<TSource>>,
  description?: string | undefined,
}

type GraphQLInputObjectConfigFieldMap<TSource> = {
  [fieldName: string]: GraphQLInputObjectFieldConfig<TSource>,
}

type GraphQLInputObjectFieldConfig<TSource> = {
  type: GraphQLInputType<TSource>,
  defaultValue?: TSource,
  description?: string | undefined,
}

type GraphQLInputObjectFieldMap<TSource> = {
  [fieldName: string]: GraphQLInputObjectField<TSource>,
}

type GraphQLInputObjectField<TSource> = {
  name: string,
  type: GraphQLInputType<TSource>,
  defaultValue?: TSource,
  description?: string | undefined,
}

export class GraphQLList<TSource, TGraphQLType extends GraphQLType<TSource>> {
  ofType: TGraphQLType
  constructor (type: TGraphQLType)
  toString (): string
}

export class GraphQLNonNull<TSource, TGraphQLType extends GraphQLNullableType<TSource>> {
  ofType: TGraphQLType
  constructor (type: TGraphQLType)
  toString (): string
}

export class GraphQLDirective {
  name: string
  description: string | undefined
  locations: DirectiveLocationEnum[]
  args: GraphQLArgument<any>[]
  constructor (config: GraphQLDirectiveConfig)
}

type DirectiveLocationEnum =
  'QUERY' |
  'MUTATION' |
  'SUBSCRIPTION' |
  'FIELD' |
  'FRAGMENT_DEFINITION' |
  'FRAGMENT_SPREAD' |
  'INLINE_FRAGMENT' |
  'SCHEMA' |
  'SCALAR' |
  'OBJECT' |
  'FIELD_DEFINITION' |
  'ARGUMENT_DEFINITION' |
  'INTERFACE' |
  'UNION' |
  'ENUM' |
  'ENUM_VALUE' |
  'INPUT_OBJECT' |
  'INPUT_FIELD_DEFINITION'

type GraphQLDirectiveConfig = {
  name: string,
  description?: string | undefined,
  locations: DirectiveLocationEnum[],
  args?: GraphQLFieldConfigArgumentMap | undefined,
}

export const TypeKind: {
  SCALAR: 'SCALAR',
  OBJECT: 'OBJECT',
  INTERFACE: 'INTERFACE',
  UNION: 'UNION',
  ENUM: 'ENUM',
  INPUT_OBJECT: 'INPUT_OBJECT',
  LIST: 'LIST',
  NON_NULL: 'NON_NULL',
}

export const DirectiveLocation: {
  QUERY: 'QUERY',
  MUTATION: 'MUTATION',
  SUBSCRIPTION: 'SUBSCRIPTION',
  FIELD: 'FIELD',
  FRAGMENT_DEFINITION: 'FRAGMENT_DEFINITION',
  FRAGMENT_SPREAD: 'FRAGMENT_SPREAD',
  INLINE_FRAGMENT: 'INLINE_FRAGMENT',
  SCHEMA: 'SCHEMA',
  SCALAR: 'SCALAR',
  OBJECT: 'OBJECT',
  FIELD_DEFINITION: 'FIELD_DEFINITION',
  ARGUMENT_DEFINITION: 'ARGUMENT_DEFINITION',
  INTERFACE: 'INTERFACE',
  UNION: 'UNION',
  ENUM: 'ENUM',
  ENUM_VALUE: 'ENUM_VALUE',
  INPUT_OBJECT: 'INPUT_OBJECT',
  INPUT_FIELD_DEFINITION: 'INPUT_FIELD_DEFINITION',
}

export const GraphQLInt: GraphQLScalarType<number>
export const GraphQLFloat: GraphQLScalarType<number>
export const GraphQLString: GraphQLScalarType<string>
export const GraphQLBoolean: GraphQLScalarType<boolean>
export const GraphQLID: GraphQLScalarType<string>

export const GraphQLIncludeDirective: GraphQLDirective
export const GraphQLSkipDirective: GraphQLDirective
export const GraphQLDeprecatedDirective: GraphQLDirective

export const specifiedDirectives: GraphQLDirective[]

export const DEFAULT_DEPRECATION_REASON: string

export const SchemaMetaFieldDef: GraphQLFieldDefinition<any, any>
export const TypeMetaFieldDef: GraphQLFieldDefinition<any, any>
export const TypeNameMetaFieldDef: GraphQLFieldDefinition<any, string>

export const __Schema: GraphQLObjectType<any>
export const __Directive: GraphQLObjectType<any>
export const __DirectiveLocation: GraphQLEnumType<any>
export const __Type: GraphQLObjectType<any>
export const __Field: GraphQLObjectType<any>
export const __InputValue: GraphQLObjectType<any>
export const __EnumValue: GraphQLObjectType<any>
export const __TypeKind: GraphQLEnumType<any>

export class Source {
  body: string
  name: string
  constructor (body: string, name?: string)
}

export function getLocation (source: Source, position: number): SourceLocation

type SourceLocation = {
  line: number,
  column: number,
}

export function parse (source: Source | string, options?: ParseOptions): Document

export function parseValue (source: Source | string, options?: ParseOptions): Value

type ParseOptions = {
  noLocation?: boolean,
  noSource?: boolean,
}

// TODO: These exports don’t have flow types so we’ll need to do some extra work.
export function print (ast: any): string
export function visit (root: any, visitor: any, keyMap: any): any
export function visitInParallel (visitors: any): any
export function visitWithTypeInfo (typeInfo: any, visitor: any): any
export type Kind = string
export const BREAK: {}

export type Location = {
  start: number,
  end: number,
  source?: Source | undefined,
}

export type Node =
  Name |
  Document |
  OperationDefinition |
  VariableDefinition |
  Variable |
  SelectionSet |
  Field |
  Argument |
  FragmentSpread |
  InlineFragment |
  FragmentDefinition |
  IntValue |
  FloatValue |
  StringValue |
  BooleanValue |
  EnumValue |
  ListValue |
  ObjectValue |
  ObjectField |
  Directive |
  NamedType |
  ListType |
  NonNullType |
  SchemaDefinition |
  OperationTypeDefinition |
  ScalarTypeDefinition |
  ObjectTypeDefinition |
  FieldDefinition |
  InputValueDefinition |
  InterfaceTypeDefinition |
  UnionTypeDefinition |
  EnumTypeDefinition |
  EnumValueDefinition |
  InputObjectTypeDefinition |
  TypeExtensionDefinition |
  DirectiveDefinition

export type Name = {
  kind: 'Name',
  loc?: Location | undefined,
  value: string,
}

export type Document = {
  kind: 'Document',
  loc?: Location | undefined,
  definitions: Definition[],
}

export type Definition =
  OperationDefinition |
  FragmentDefinition |
  TypeSystemDefinition 

export type OperationDefinition = {
  kind: 'OperationDefinition',
  loc?: Location | undefined,
  operation: OperationType,
  name?: Name | undefined,
  variableDefinitions?: VariableDefinition[] | undefined,
  directives?: Directive[] | undefined,
  selectionSet: SelectionSet,
}

export type OperationType = 'query' | 'mutation' | 'subscription'

export type VariableDefinition = {
  kind: 'VariableDefinition',
  loc?: Location | undefined,
  variable: Variable,
  type: Type,
  defaultValue?: Value | undefined,
}

export type Variable = {
  kind: 'Variable',
  loc?: Location | undefined,
  name: Name,
}

export type SelectionSet = {
  kind: 'SelectionSet',
  loc?: Location | undefined,
  selections: Selection[],
}

export type Selection =
  Field |
  FragmentSpread |
  InlineFragment

export type Field = {
  kind: 'Field',
  loc?: Location | undefined,
  alias?: Name | undefined,
  name: Name,
  arguments?: Argument[] | undefined,
  directives?: Directive[] | undefined,
  selectionSet?: SelectionSet | undefined,
}

export type Argument = {
  kind: 'Argument',
  loc?: Location | undefined,
  name: Name,
  value: Value,
}

export type FragmentSpread = {
  kind: 'FragmentSpread',
  loc?: Location | undefined,
  name: Name,
  directives?: Directive[] | undefined,
}

export type InlineFragment = {
  kind: 'InlineFragment',
  loc?: Location | undefined,
  typeCondition?: NamedType | undefined,
  directives?: Directive[] | undefined,
  selectionSet: SelectionSet,
}

export type FragmentDefinition = {
  kind: 'FragmentDefinition',
  loc?: Location | undefined,
  name: Name,
  typeCondition: NamedType,
  directives?: Directive[] | undefined,
  selectionSet: SelectionSet,
}

export type Value =
  Variable |
  IntValue |
  FloatValue |
  StringValue |
  BooleanValue |
  EnumValue |
  ListValue |
  ObjectValue

export type IntValue = {
  kind: 'IntValue',
  loc?: Location | undefined,
  value: string,
}

export type FloatValue = {
  kind: 'FloatValue',
  loc?: Location | undefined,
  value: string,
}

export type StringValue = {
  kind: 'StringValue',
  loc?: Location | undefined,
  value: string,
}

export type BooleanValue = {
  kind: 'BooleanValue',
  loc?: Location | undefined,
  value: boolean,
}

export type EnumValue = {
  kind: 'EnumValue',
  loc?: Location | undefined,
  value: string,
}

export type ListValue = {
  kind: 'ListValue',
  loc?: Location | undefined,
  values: Value[],
}

export type ObjectValue = {
  kind: 'ObjectValue',
  loc?: Location | undefined,
  fields: ObjectField[],
}

export type ObjectField = {
  kind: 'ObjectField',
  loc?: Location | undefined,
  name: Name,
  value: Value,
}

export type Directive = {
  kind: 'Directive',
  loc?: Location | undefined,
  name: Name,
  arguments?: Argument[] | undefined,
}

export type Type =
  NamedType |
  ListType |
  NonNullType

export type NamedType = {
  kind: 'NamedType',
  loc?: Location | undefined,
  name: Name,
}

export type ListType = {
  kind: 'ListType',
  loc?: Location | undefined,
  type: Type,
}

export type NonNullType = {
  kind: 'NonNullType',
  loc?: Location | undefined,
  type: NamedType | ListType,
}

export type TypeSystemDefinition =
  SchemaDefinition |
  TypeDefinition |
  TypeExtensionDefinition |
  DirectiveDefinition

export type SchemaDefinition = {
  kind: 'SchemaDefinition',
  loc?: Location | undefined,
  directives: Directive[],
  operationTypes: OperationTypeDefinition[],
}

export type OperationTypeDefinition = {
  kind: 'OperationTypeDefinition',
  loc?: Location | undefined,
  operation: OperationType,
  type: NamedType,
}

export type TypeDefinition =
  ScalarTypeDefinition |
  ObjectTypeDefinition |
  InterfaceTypeDefinition |
  UnionTypeDefinition |
  EnumTypeDefinition |
  InputObjectTypeDefinition

export type ScalarTypeDefinition = {
  kind: 'ScalarTypeDefinition',
  loc?: Location | undefined,
  name: Name,
  directives?: Directive[] | undefined,
}

export type ObjectTypeDefinition = {
  kind: 'ObjectTypeDefinition',
  loc?: Location | undefined,
  name: Name,
  interfaces?: NamedType[] | undefined,
  directives?: Directive[] | undefined,
  fields: FieldDefinition[],
}

export type FieldDefinition = {
  kind: 'FieldDefinition',
  loc?: Location | undefined,
  name: Name,
  arguments: InputValueDefinition[],
  type: Type,
  directives?: Directive[] | undefined,
}

export type InputValueDefinition = {
  kind: 'InputValueDefinition',
  loc?: Location | undefined,
  name: Name,
  type: Type,
  defaultValue?: Value | undefined,
  directives?: Directive[] | undefined,
}

export type InterfaceTypeDefinition = {
  kind: 'InterfaceTypeDefinition',
  loc?: Location | undefined,
  name: Name,
  directives?: Directive[] | undefined,
  fields: FieldDefinition[],
}

export type UnionTypeDefinition = {
  kind: 'UnionTypeDefinition',
  loc?: Location | undefined,
  name: Name,
  directives?: Directive[] | undefined,
  types: NamedType[],
}

export type EnumTypeDefinition = {
  kind: 'EnumTypeDefinition',
  loc?: Location | undefined,
  name: Name,
  directives?: Directive[] | undefined,
  values: EnumValueDefinition[],
}

export type EnumValueDefinition = {
  kind: 'EnumValueDefinition',
  loc?: Location | undefined,
  name: Name,
  directives?: Directive[] | undefined,
}

export type InputObjectTypeDefinition = {
  kind: 'InputObjectTypeDefinition',
  loc?: Location | undefined,
  name: Name,
  directives?: Directive[] | undefined,
  fields: InputValueDefinition[],
}

export type TypeExtensionDefinition = {
  kind: 'TypeExtensionDefinition',
  loc?: Location | undefined,
  definition: ObjectTypeDefinition,
}

export type DirectiveDefinition = {
  kind: 'DirectiveDefinition',
  loc?: Location | undefined,
  name: Name,
  arguments?: InputValueDefinition[] | undefined,
  locations: Name[],
}

export function execute (
  schema: GraphQLSchema,
  documentAST: Document,
  rootValue?: any,
  contextValue?: GraphQLContext,
  variableValues?: { [key: string]: any } | undefined,
  operationName?: string | undefined
): Promise<ExecutionResult>

type ExecutionResult = {
  data: any | undefined,
  errors?: GraphQLError[],
}

export function validate (
  schema: GraphQLSchema,
  ast: Document,
  rules?: any[]
): GraphQLError[]

// TODO: Type validation rules.
export const specifiedRules: any[]

export class GraphQLError extends Error {
  message: string
  stack: string
  nodes: Node[] | undefined
  source: Source
  positions: number[]
  locations: any
  path: (string | number)[]
  originalError: Error | undefined
  constructor (message: string, nodes?: Node[], stack?: string | undefined, source?: Source, positions?: number[])
}

export function formatError (error: GraphQLError): GraphQLFormattedError

type GraphQLFormattedError = {
  message: string,
  locations: GraphQLErrorLocation[] | undefined,
}

type GraphQLErrorLocation = {
  line: number,
  column: number,
}

export const introspectionQuery: string

export function getOperationAST (
  documentAST: Document,
  operationName: string | undefined
): OperationDefinition | undefined

// TODO: Introspection query types.
export function buildClientSchema (
  introspection: any
): GraphQLSchema

export function buildASTSchema (ast: Document): GraphQLSchema

export function extendSchema (
  schema: GraphQLSchema,
  documentAST: Document
): GraphQLSchema

export function pringSchema (schema: GraphQLSchema): string

// TODO: Determine if internal type information can be enhanced.
export function typeFromAST (
  schema: GraphQLSchema,
  inputTypeAST: Type
): GraphQLType<any> | undefined

// TODO: Determine if internal type information can be enhanced.
export function valueFromAST (
  valueAST: Value | undefined,
  type: GraphQLInputType<any>,
  variabels?: { [key: string]: any } | undefined
): any

export function astFromValue <T>(
  value: T,
  type?: GraphQLType<T> | undefined
): Value | undefined

// TODO: TypeInfo

export function isValidJSValue <T>(
  value: T,
  type: GraphQLInputType<T>
): string[]

export function isValidLiteralValue (
  type: GraphQLInputType<any>,
  valueAST: Value
): string[]

export function concatAST (asts: Document[]): Document

export function isEqualType (
  typeA: GraphQLType<any>,
  typeB: GraphQLType<any>
): boolean

export function isTypeSubTypeOf (
  schema: GraphQLSchema,
  maybeSubType: GraphQLType<any>,
  superType: GraphQLType<any>
): boolean

export function doTypesOverlap (
  schema: GraphQLSchema,
  typeA: GraphQLCompositeType<any>,
  typeB: GraphQLCompositeType<any>
): boolean

export function assertValidName (name: string)
