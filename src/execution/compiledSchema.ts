import { isObjectLike } from '../jsutils/isObjectLike';
import { isPromise } from '../jsutils/isPromise';
import type { Maybe } from '../jsutils/Maybe';

import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../type/definition';
import type { GraphQLSchema } from '../type/schema';

/* eslint-disable max-params */
// This file contains a lot of such errors but we plan to refactor it anyway
// so just disable it for entire file.

export interface GraphQLCompiledSchemaConfig {
  schema: GraphQLSchema;
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
}

/**
 * @internal
 */
export class GraphQLCompiledSchema {
  schema: GraphQLSchema;
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;

  constructor(config: GraphQLCompiledSchemaConfig) {
    this.schema = config.schema;
    this.fieldResolver = config.fieldResolver ?? defaultFieldResolver;
    this.typeResolver = config.typeResolver ?? defaultTypeResolver;
    this.subscribeFieldResolver =
      config.subscribeFieldResolver ?? defaultFieldResolver;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLCompiledSchema';
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
