import type { Maybe } from '../jsutils/Maybe';
import type { DirectiveLocationEnum } from '../language/directiveLocation';

export type IntrospectionOptions = {
  // Whether to include descriptions in the introspection result.
  // Default: true
  descriptions?: boolean;

  // Whether to include `specifiedByUrl` in the introspection result.
  // Default: false
  specifiedByUrl?: boolean;

  // Whether to include `isRepeatable` field on directives.
  // Default: false
  directiveIsRepeatable?: boolean;

  // Whether to include `description` field on schema.
  // Default: false
  schemaDescription?: boolean;

  // Whether target GraphQL server support deprecation of input values.
  // Default: false
  inputValueDeprecation?: boolean;
};

export function getIntrospectionQuery(options?: IntrospectionOptions): string {
  const optionsWithDefault = {
    descriptions: true,
    specifiedByUrl: false,
    directiveIsRepeatable: false,
    schemaDescription: false,
    inputValueDeprecation: false,
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

  function inputDeprecation(str) {
    return optionsWithDefault.inputValueDeprecation ? str : '';
  }

  return `
    query IntrospectionQuery {
      __schema {
        ${schemaDescription}
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          ...FullType
        }
        directives {
          name
          ${descriptions}
          ${directiveIsRepeatable}
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
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
}

export type IntrospectionQuery = {
  readonly __schema: IntrospectionSchema;
};

export type IntrospectionSchema = {
  readonly description?: Maybe<string>;
  readonly queryType: IntrospectionNamedTypeRef<IntrospectionObjectType>;
  readonly mutationType: Maybe<
    IntrospectionNamedTypeRef<IntrospectionObjectType>
  >;
  readonly subscriptionType: Maybe<
    IntrospectionNamedTypeRef<IntrospectionObjectType>
  >;
  readonly types: ReadonlyArray<IntrospectionType>;
  readonly directives: ReadonlyArray<IntrospectionDirective>;
};

export type IntrospectionType =
  | IntrospectionScalarType
  | IntrospectionObjectType
  | IntrospectionInterfaceType
  | IntrospectionUnionType
  | IntrospectionEnumType
  | IntrospectionInputObjectType;

export type IntrospectionOutputType =
  | IntrospectionScalarType
  | IntrospectionObjectType
  | IntrospectionInterfaceType
  | IntrospectionUnionType
  | IntrospectionEnumType;

export type IntrospectionInputType =
  | IntrospectionScalarType
  | IntrospectionEnumType
  | IntrospectionInputObjectType;

export type IntrospectionScalarType = {
  readonly kind: 'SCALAR';
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly specifiedByURL?: Maybe<string>;
};

export type IntrospectionObjectType = {
  readonly kind: 'OBJECT';
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly fields: ReadonlyArray<IntrospectionField>;
  readonly interfaces: ReadonlyArray<
    IntrospectionNamedTypeRef<IntrospectionInterfaceType>
  >;
};

export type IntrospectionInterfaceType = {
  readonly kind: 'INTERFACE';
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly fields: ReadonlyArray<IntrospectionField>;
  readonly interfaces: ReadonlyArray<
    IntrospectionNamedTypeRef<IntrospectionInterfaceType>
  >;
  readonly possibleTypes: ReadonlyArray<
    IntrospectionNamedTypeRef<IntrospectionObjectType>
  >;
};

export type IntrospectionUnionType = {
  readonly kind: 'UNION';
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly possibleTypes: ReadonlyArray<
    IntrospectionNamedTypeRef<IntrospectionObjectType>
  >;
};

export type IntrospectionEnumType = {
  readonly kind: 'ENUM';
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly enumValues: ReadonlyArray<IntrospectionEnumValue>;
};

export type IntrospectionInputObjectType = {
  readonly kind: 'INPUT_OBJECT';
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly inputFields: ReadonlyArray<IntrospectionInputValue>;
};

export type IntrospectionListTypeRef<
  T extends IntrospectionTypeRef = IntrospectionTypeRef,
> = {
  readonly kind: 'LIST';
  readonly ofType: T;
};

export type IntrospectionNonNullTypeRef<
  T extends IntrospectionTypeRef = IntrospectionTypeRef,
> = {
  readonly kind: 'NON_NULL';
  readonly ofType: T;
};

export type IntrospectionTypeRef =
  | IntrospectionNamedTypeRef
  | IntrospectionListTypeRef
  | IntrospectionNonNullTypeRef<
      IntrospectionNamedTypeRef | IntrospectionListTypeRef
    >;

export type IntrospectionOutputTypeRef =
  | IntrospectionNamedTypeRef<IntrospectionOutputType>
  | IntrospectionListTypeRef<IntrospectionOutputTypeRef>
  | IntrospectionNonNullTypeRef<
      | IntrospectionNamedTypeRef<IntrospectionOutputType>
      | IntrospectionListTypeRef<IntrospectionOutputTypeRef>
    >;

export type IntrospectionInputTypeRef =
  | IntrospectionNamedTypeRef<IntrospectionInputType>
  | IntrospectionListTypeRef<IntrospectionInputTypeRef>
  | IntrospectionNonNullTypeRef<
      | IntrospectionNamedTypeRef<IntrospectionInputType>
      | IntrospectionListTypeRef<IntrospectionInputTypeRef>
    >;

export type IntrospectionNamedTypeRef<
  T extends IntrospectionType = IntrospectionType,
> = {
  readonly kind: T['kind'];
  readonly name: string;
};

export type IntrospectionField = {
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly args: ReadonlyArray<IntrospectionInputValue>;
  readonly type: IntrospectionOutputTypeRef;
  readonly isDeprecated: boolean;
  readonly deprecationReason: Maybe<string>;
};

export type IntrospectionInputValue = {
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly type: IntrospectionInputTypeRef;
  readonly defaultValue: Maybe<string>;
  readonly isDeprecated?: boolean;
  readonly deprecationReason?: Maybe<string>;
};

export type IntrospectionEnumValue = {
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly isDeprecated: boolean;
  readonly deprecationReason: Maybe<string>;
};

export type IntrospectionDirective = {
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly isRepeatable?: boolean;
  readonly locations: ReadonlyArray<DirectiveLocationEnum>;
  readonly args: ReadonlyArray<IntrospectionInputValue>;
};
