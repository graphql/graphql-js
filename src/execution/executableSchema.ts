import { isObjectLike } from '../jsutils/isObjectLike';
import { isPromise } from '../jsutils/isPromise';
import type { Maybe } from '../jsutils/Maybe';

import type {
  GraphQLAbstractType,
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../type/definition';
import { isAbstractType, isObjectType } from '../type/definition';
import type { GraphQLSchema } from '../type/schema';

export interface GraphQLExecutableSchemaConfig {
  schema: GraphQLSchema;
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
}

/**
 * @internal
 */
export interface GraphQLExecutableSchemaNormalizedConfig
  extends GraphQLExecutableSchemaConfig {
  schema: GraphQLSchema;
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;
}

export class GraphQLExecutableSchema {
  schema: GraphQLSchema;
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;

  private _fieldResolverMap: Map<
    GraphQLField<any, any>,
    GraphQLFieldResolver<any, any>
  >;

  private _typeResolverMap: Map<
    GraphQLAbstractType,
    GraphQLTypeResolver<any, any>
  >;

  private _subscribeResolverMap: Map<
    GraphQLField<any, any>,
    GraphQLFieldResolver<any, any>
  >;

  constructor(config: Readonly<GraphQLExecutableSchemaConfig>) {
    this.schema = config.schema;
    this.fieldResolver = config.fieldResolver ?? defaultFieldResolver;
    this.typeResolver = config.typeResolver ?? defaultTypeResolver;
    this.subscribeFieldResolver =
      config.subscribeFieldResolver ?? defaultFieldResolver;

    this._fieldResolverMap = new Map();
    this._typeResolverMap = new Map();
    this._subscribeResolverMap = new Map();

    for (const type of Object.values(this.schema.getTypeMap())) {
      if (isObjectType(type)) {
        for (const field of Object.values(type.getFields())) {
          this._fieldResolverMap.set(
            field,
            field.resolve ? field.resolve : defaultFieldResolver,
          );
        }
      } else if (isAbstractType(type)) {
        this._typeResolverMap.set(
          type,
          type.resolveType ? type.resolveType : defaultTypeResolver,
        );
      }
    }

    const subscriptionType = this.schema.getSubscriptionType();

    if (subscriptionType) {
      for (const field of Object.values(subscriptionType.getFields())) {
        this._subscribeResolverMap.set(
          field,
          field.subscribe ? field.subscribe : defaultFieldResolver,
        );
      }
    }
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLExecutableSchema';
  }

  getFieldResolver(
    field: GraphQLField<any, any>,
  ): GraphQLFieldResolver<any, any> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._fieldResolverMap.get(field)!;
  }

  getTypeResolver(type: GraphQLAbstractType): GraphQLTypeResolver<any, any> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._typeResolverMap.get(type)!;
  }

  getSubscribeResolver(
    field: GraphQLField<any, any>,
  ): GraphQLFieldResolver<any, any> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._subscribeResolverMap.get(field)!;
  }

  toConfig(): GraphQLExecutableSchemaNormalizedConfig {
    return {
      schema: this.schema,
      fieldResolver: this.fieldResolver,
      typeResolver: this.typeResolver,
      subscribeFieldResolver: this.subscribeFieldResolver,
    };
  }
}

/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which attempts two strategies:
 *
 * First, See if the provided value has a `__typename` field defined, if so, use
 * that value as name of the resolved type.
 *
 * Otherwise, test each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */
export const defaultTypeResolver: GraphQLTypeResolver<unknown, unknown> =
  function (value, contextValue, info, abstractType) {
    // First, look for `__typename`.
    if (isObjectLike(value) && typeof value.__typename === 'string') {
      return value.__typename;
    }

    // Otherwise, test each possible type.
    const possibleTypes = info.schema.getPossibleTypes(abstractType);
    const promisedIsTypeOfResults = [];

    for (let i = 0; i < possibleTypes.length; i++) {
      const type = possibleTypes[i];

      if (type.isTypeOf) {
        const isTypeOfResult = type.isTypeOf(value, contextValue, info);

        if (isPromise(isTypeOfResult)) {
          promisedIsTypeOfResults[i] = isTypeOfResult;
        } else if (isTypeOfResult) {
          return type.name;
        }
      }
    }

    if (promisedIsTypeOfResults.length) {
      return Promise.all(promisedIsTypeOfResults).then((isTypeOfResults) => {
        for (let i = 0; i < isTypeOfResults.length; i++) {
          if (isTypeOfResults[i]) {
            return possibleTypes[i].name;
          }
        }
      });
    }
  };

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */
export const defaultFieldResolver: GraphQLFieldResolver<unknown, unknown> =
  function (source: any, args, contextValue, info) {
    // ensure source is a value for which property access is acceptable.
    if (isObjectLike(source) || typeof source === 'function') {
      const property = source[info.fieldName];
      if (typeof property === 'function') {
        return source[info.fieldName](args, contextValue, info);
      }
      return property;
    }
  };
