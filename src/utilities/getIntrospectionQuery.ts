/** @category Introspection */

import type { Maybe } from '../jsutils/Maybe';

import type { DirectiveLocation } from '../language/directiveLocation';

/** Options controlling which fields are included in the introspection query. */
export interface IntrospectionOptions {
  /**
   * Whether to include descriptions in the introspection result.
   * Default: true
   */
  descriptions?: boolean;

  /**
   * Whether to include `specifiedByURL` in the introspection result.
   * Default: false
   */
  specifiedByUrl?: boolean;

  /**
   * Whether to include `isRepeatable` flag on directives.
   * Default: false
   */
  directiveIsRepeatable?: boolean;

  /**
   * Whether to include `description` field on schema.
   * Default: false
   */
  schemaDescription?: boolean;

  /**
   * Whether target GraphQL server support deprecation of input values.
   * Default: false
   */
  inputValueDeprecation?: boolean;

  /**
   * Whether target GraphQL server supports deprecation of directives.
   * Default: false
   */
  experimentalDirectiveDeprecation?: boolean;

  /**
   * Whether target GraphQL server supports `@oneOf` input objects.
   * Default: false
   */
  oneOf?: boolean;

  /**
   * How deep to recurse into nested types, larger values will result in more
   * accurate results, but have a higher load on the server.
   * Some servers might restrict the maximum query depth or complexity.
   * If that's the case, try decreasing this value.
   *
   * Default: 9
   */
  typeDepth?: number;
}

/**
 * Produce the GraphQL query recommended for a full schema introspection.
 * Accepts optional IntrospectionOptions.
 * @param options - Optional configuration for this operation.
 * @returns The resolved introspection query.
 * @example
 * ```ts
 * // Generate the default introspection query.
 * import { getIntrospectionQuery } from 'graphql/utilities';
 *
 * const query = getIntrospectionQuery();
 *
 * query; // matches /__schema/
 * query; // matches /description/
 * query; // does not match /specifiedByURL/
 * ```
 * @example
 * ```ts
 * // This variant customizes optional introspection fields and nesting depth.
 * import { getIntrospectionQuery } from 'graphql/utilities';
 *
 * const query = getIntrospectionQuery({
 *   descriptions: false,
 *   specifiedByUrl: true,
 *   directiveIsRepeatable: true,
 *   schemaDescription: true,
 *   inputValueDeprecation: true,
 *   experimentalDirectiveDeprecation: true,
 *   oneOf: true,
 *   typeDepth: 3,
 * });
 *
 * query; // does not match /description/
 * query; // matches /specifiedByURL/
 * query; // matches /isRepeatable/
 * query; // matches /includeDeprecated: true/
 * query; // matches /isOneOf/
 * (query.match(/ofType/g)?.length ?? 0) > 0; // => true
 * ```
 */
export function getIntrospectionQuery(options?: IntrospectionOptions): string {
  const optionsWithDefault = {
    descriptions: true,
    specifiedByUrl: false,
    directiveIsRepeatable: false,
    schemaDescription: false,
    inputValueDeprecation: false,
    experimentalDirectiveDeprecation: false,
    oneOf: false,
    typeDepth: 9,
    ...options,
  };

  const descriptions = optionsWithDefault.descriptions ? 'description' : '';
  const specifiedByUrl = optionsWithDefault.specifiedByUrl
    ? 'specifiedByURL'
    : '';
  const directiveIsRepeatable = optionsWithDefault.directiveIsRepeatable
    ? 'isRepeatable'
    : '';
  const schemaDescription = optionsWithDefault.schemaDescription
    ? descriptions
    : '';

  function inputDeprecation(str: string) {
    return optionsWithDefault.inputValueDeprecation ? str : '';
  }
  function experimentalDirectiveDeprecation(str: string) {
    return optionsWithDefault.experimentalDirectiveDeprecation ? str : '';
  }
  const oneOf = optionsWithDefault.oneOf ? 'isOneOf' : '';
  function ofType(level: number, indent: string): string {
    if (level <= 0) {
      return '';
    }
    if (level > 100) {
      throw new Error(
        'Please set typeDepth to a reasonable value between 0 and 100; the default is 9.',
      );
    }
    return `
${indent}ofType {
${indent}  name
${indent}  kind${ofType(level - 1, indent + '  ')}
${indent}}`;
  }

  return `
    query IntrospectionQuery {
      __schema {
        ${schemaDescription}
        queryType { name kind }
        mutationType { name kind }
        subscriptionType { name kind }
        types {
          ...FullType
        }
        directives${experimentalDirectiveDeprecation(
          '(includeDeprecated: true)',
        )} {
          name
          ${descriptions}
          ${directiveIsRepeatable}
          ${experimentalDirectiveDeprecation('isDeprecated')}
          ${experimentalDirectiveDeprecation('deprecationReason')}
          locations
          args${inputDeprecation('(includeDeprecated: true)')} {
            ...InputValue
          }
        }
      }
    }

    fragment FullType on __Type {
      kind
      name
      ${descriptions}
      ${specifiedByUrl}
      ${oneOf}
      fields(includeDeprecated: true) {
        name
        ${descriptions}
        args${inputDeprecation('(includeDeprecated: true)')} {
          ...InputValue
        }
        type {
          ...TypeRef
        }
        isDeprecated
        deprecationReason
      }
      inputFields${inputDeprecation('(includeDeprecated: true)')} {
        ...InputValue
      }
      interfaces {
        ...TypeRef
      }
      enumValues(includeDeprecated: true) {
        name
        ${descriptions}
        isDeprecated
        deprecationReason
      }
      possibleTypes {
        ...TypeRef
      }
    }

    fragment InputValue on __InputValue {
      name
      ${descriptions}
      type { ...TypeRef }
      defaultValue
      ${inputDeprecation('isDeprecated')}
      ${inputDeprecation('deprecationReason')}
    }

    fragment TypeRef on __Type {
      kind
      name${ofType(optionsWithDefault.typeDepth, '      ')}
    }
  `;
}

/** The result shape returned by a full introspection query. */
export interface IntrospectionQuery {
  /** The  schema. */
  readonly __schema: IntrospectionSchema;
}

/** The introspection representation of a GraphQL schema. */
export interface IntrospectionSchema {
  /** Human-readable description for this schema element, if provided. */
  readonly description?: Maybe<string>;
  /** The root object type used for query operations. */
  readonly queryType: IntrospectionNamedTypeRef<IntrospectionObjectType>;
  /** The root object type used for mutation operations, if supported. */
  readonly mutationType: Maybe<
    IntrospectionNamedTypeRef<IntrospectionObjectType>
  >;
  /** The root object type used for subscription operations, if supported. */
  readonly subscriptionType: Maybe<
    IntrospectionNamedTypeRef<IntrospectionObjectType>
  >;
  /** Object types that belong to this union type. */
  readonly types: ReadonlyArray<IntrospectionType>;
  /** Directives available in this schema or applied to this AST node. */
  readonly directives: ReadonlyArray<IntrospectionDirective>;
}

/** Any introspection representation of a GraphQL type. */
export type IntrospectionType =
  | IntrospectionScalarType
  | IntrospectionObjectType
  | IntrospectionInterfaceType
  | IntrospectionUnionType
  | IntrospectionEnumType
  | IntrospectionInputObjectType;

/** An introspection type that can appear in output position. */
export type IntrospectionOutputType =
  | IntrospectionScalarType
  | IntrospectionObjectType
  | IntrospectionInterfaceType
  | IntrospectionUnionType
  | IntrospectionEnumType;

/** An introspection type that can appear in input position. */
export type IntrospectionInputType =
  | IntrospectionScalarType
  | IntrospectionEnumType
  | IntrospectionInputObjectType;

/** The introspection representation of a scalar type. */
export interface IntrospectionScalarType {
  /** The introspection kind discriminator for this type reference or type. */
  readonly kind: 'SCALAR';
  /** The GraphQL name for this schema element. */
  readonly name: string;
  /** Human-readable description for this schema element, if provided. */
  readonly description?: Maybe<string>;
  /** URL identifying the behavior specified for this custom scalar. */
  readonly specifiedByURL?: Maybe<string>;
}

/** The introspection representation of an object type. */
export interface IntrospectionObjectType {
  /** The introspection kind discriminator for this type reference or type. */
  readonly kind: 'OBJECT';
  /** The GraphQL name for this schema element. */
  readonly name: string;
  /** Human-readable description for this schema element, if provided. */
  readonly description?: Maybe<string>;
  /** Fields declared by this object, interface, input object, or literal. */
  readonly fields: ReadonlyArray<IntrospectionField>;
  /** Interfaces implemented by this object or interface type. */
  readonly interfaces: ReadonlyArray<
    IntrospectionNamedTypeRef<IntrospectionInterfaceType>
  >;
}

/** The introspection representation of an interface type. */
export interface IntrospectionInterfaceType {
  /** The introspection kind discriminator for this type reference or type. */
  readonly kind: 'INTERFACE';
  /** The GraphQL name for this schema element. */
  readonly name: string;
  /** Human-readable description for this schema element, if provided. */
  readonly description?: Maybe<string>;
  /** Fields declared by this object, interface, input object, or literal. */
  readonly fields: ReadonlyArray<IntrospectionField>;
  /** Interfaces implemented by this object or interface type. */
  readonly interfaces: ReadonlyArray<
    IntrospectionNamedTypeRef<IntrospectionInterfaceType>
  >;
  /** Object types that may be returned for this abstract type. */
  readonly possibleTypes: ReadonlyArray<
    IntrospectionNamedTypeRef<IntrospectionObjectType>
  >;
}

/** The introspection representation of a union type. */
export interface IntrospectionUnionType {
  /** The introspection kind discriminator for this type reference or type. */
  readonly kind: 'UNION';
  /** The GraphQL name for this schema element. */
  readonly name: string;
  /** Human-readable description for this schema element, if provided. */
  readonly description?: Maybe<string>;
  /** Object types that may be returned for this abstract type. */
  readonly possibleTypes: ReadonlyArray<
    IntrospectionNamedTypeRef<IntrospectionObjectType>
  >;
}

/** The introspection representation of an enum type. */
export interface IntrospectionEnumType {
  /** The introspection kind discriminator for this type reference or type. */
  readonly kind: 'ENUM';
  /** The GraphQL name for this schema element. */
  readonly name: string;
  /** Human-readable description for this schema element, if provided. */
  readonly description?: Maybe<string>;
  /** Values declared by this enum type. */
  readonly enumValues: ReadonlyArray<IntrospectionEnumValue>;
}

/** The introspection representation of an input object type. */
export interface IntrospectionInputObjectType {
  /** The introspection kind discriminator for this type reference or type. */
  readonly kind: 'INPUT_OBJECT';
  /** The GraphQL name for this schema element. */
  readonly name: string;
  /** Human-readable description for this schema element, if provided. */
  readonly description?: Maybe<string>;
  /** Input fields declared by this input object type. */
  readonly inputFields: ReadonlyArray<IntrospectionInputValue>;
  /** Whether this input object uses the experimental OneOf input object semantics. */
  readonly isOneOf: boolean;
}

/**
 * The introspection representation of a list type reference.
 * @typeParam T - The introspection type reference wrapped by this list type reference.
 */
export interface IntrospectionListTypeRef<
  T extends IntrospectionTypeRef = IntrospectionTypeRef,
> {
  /** The introspection kind discriminator for this type reference or type. */
  readonly kind: 'LIST';
  /** The type wrapped by this list or non-null type. */
  readonly ofType: T;
}

/**
 * The introspection representation of a non-null type reference.
 * @typeParam T - The introspection type reference wrapped by this non-null type reference.
 */
export interface IntrospectionNonNullTypeRef<
  T extends IntrospectionTypeRef = IntrospectionTypeRef,
> {
  /** The introspection kind discriminator for this type reference or type. */
  readonly kind: 'NON_NULL';
  /** The type wrapped by this list or non-null type. */
  readonly ofType: T;
}

/** Any introspection representation of a type reference. */
export type IntrospectionTypeRef =
  | IntrospectionNamedTypeRef
  | IntrospectionListTypeRef
  | IntrospectionNonNullTypeRef<
      IntrospectionNamedTypeRef | IntrospectionListTypeRef
    >;

/** An introspection type reference that can appear in output position. */
export type IntrospectionOutputTypeRef =
  | IntrospectionNamedTypeRef<IntrospectionOutputType>
  | IntrospectionListTypeRef<IntrospectionOutputTypeRef>
  | IntrospectionNonNullTypeRef<
      | IntrospectionNamedTypeRef<IntrospectionOutputType>
      | IntrospectionListTypeRef<IntrospectionOutputTypeRef>
    >;

/** An introspection type reference that can appear in input position. */
export type IntrospectionInputTypeRef =
  | IntrospectionNamedTypeRef<IntrospectionInputType>
  | IntrospectionListTypeRef<IntrospectionInputTypeRef>
  | IntrospectionNonNullTypeRef<
      | IntrospectionNamedTypeRef<IntrospectionInputType>
      | IntrospectionListTypeRef<IntrospectionInputTypeRef>
    >;

/**
 * The introspection representation of a named type reference.
 * @typeParam T - The introspection type represented by this named type reference.
 */
export interface IntrospectionNamedTypeRef<
  T extends IntrospectionType = IntrospectionType,
> {
  /** The introspection kind discriminator for this type reference or type. */
  readonly kind: T['kind'];
  /** The GraphQL name for this schema element. */
  readonly name: string;
}

/** The introspection representation of a field. */
export interface IntrospectionField {
  /** The GraphQL name for this schema element. */
  readonly name: string;
  /** Human-readable description for this schema element, if provided. */
  readonly description?: Maybe<string>;
  /** Arguments accepted by this field or directive. */
  readonly args: ReadonlyArray<IntrospectionInputValue>;
  /** The GraphQL type reference or runtime type for this element. */
  readonly type: IntrospectionOutputTypeRef;
  /** Whether this field, argument, enum value, or input value is deprecated. */
  readonly isDeprecated: boolean;
  /** Reason this element is deprecated, if one was provided. */
  readonly deprecationReason: Maybe<string>;
}

/** The introspection representation of an argument or input field. */
export interface IntrospectionInputValue {
  /** The GraphQL name for this schema element. */
  readonly name: string;
  /** Human-readable description for this schema element, if provided. */
  readonly description?: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  readonly type: IntrospectionInputTypeRef;
  /** Default value used when no explicit value is supplied. */
  readonly defaultValue: Maybe<string>;
  /** Whether this field, argument, enum value, or input value is deprecated. */
  readonly isDeprecated?: boolean;
  /** Reason this element is deprecated, if one was provided. */
  readonly deprecationReason?: Maybe<string>;
}

/** The introspection representation of an enum value. */
export interface IntrospectionEnumValue {
  /** The GraphQL name for this schema element. */
  readonly name: string;
  /** Human-readable description for this schema element, if provided. */
  readonly description?: Maybe<string>;
  /** Whether this field, argument, enum value, or input value is deprecated. */
  readonly isDeprecated: boolean;
  /** Reason this element is deprecated, if one was provided. */
  readonly deprecationReason: Maybe<string>;
}

/** The introspection representation of a directive. */
export interface IntrospectionDirective {
  /** The GraphQL name for this schema element. */
  readonly name: string;
  /** Human-readable description for this schema element, if provided. */
  readonly description?: Maybe<string>;
  /** Whether this directive may appear more than once at the same location. */
  readonly isRepeatable?: boolean;
  /** Whether this field, argument, enum value, or input value is deprecated. */
  readonly isDeprecated?: boolean;
  /** Reason this element is deprecated, if one was provided. */
  readonly deprecationReason?: Maybe<string>;
  /** Locations where this directive may be applied. */
  readonly locations: ReadonlyArray<DirectiveLocation>;
  /** Arguments accepted by this field or directive. */
  readonly args: ReadonlyArray<IntrospectionInputValue>;
}
