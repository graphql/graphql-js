import { pathToArray } from '../../../jsutils/Path.ts';

import type {
  GraphQLBatchedResolveInfo,
  GraphQLFieldBatchResolver,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLOutputType,
} from '../../../type/definition.ts';
import { GraphQLList, GraphQLObjectType } from '../../../type/definition.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

export function schemaWithQueryFields(
  fields: GraphQLFieldConfigMap<unknown, unknown>,
  types?: ReadonlyArray<GraphQLObjectType>,
): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({ name: 'Query', fields }),
    types,
  });
}

export function schemaWithUserFields(
  fields: GraphQLFieldConfigMap<unknown, unknown>,
  typeName = 'User',
  usersType: (userType: GraphQLObjectType) => GraphQLOutputType = (userType) =>
    new GraphQLList(userType),
): GraphQLSchema {
  const UserType = new GraphQLObjectType({
    name: typeName,
    fields,
  });

  return schemaWithQueryFields({
    users: { type: usersType(UserType) },
  });
}

export function schemaWithBatchedUserName(
  typeName: string,
  type: GraphQLOutputType,
  experimentalBatchResolve: GraphQLFieldBatchResolver<unknown, unknown>,
  usersType?: (userType: GraphQLObjectType) => GraphQLOutputType,
): GraphQLSchema {
  return schemaWithUserFields(
    { name: batchedField(type, experimentalBatchResolve) },
    typeName,
    usersType,
  );
}

export function batchedField(
  type: GraphQLOutputType,
  experimentalBatchResolve: GraphQLFieldBatchResolver<unknown, unknown>,
  config: Omit<
    GraphQLFieldConfig<unknown, unknown>,
    'type' | 'experimentalBatchResolve'
  > = {},
): GraphQLFieldConfig<unknown, unknown> {
  return {
    type,
    ...config,
    experimentalBatchResolve,
  };
}

export function schemaWithBatchedProfileFields(
  typeNamePrefix: string,
  detailsFields: GraphQLFieldConfigMap<unknown, unknown>,
  profileFields: GraphQLFieldConfigMap<unknown, unknown>,
): GraphQLSchema {
  const DetailsType = new GraphQLObjectType({
    name: `${typeNamePrefix}Details`,
    fields: detailsFields,
  });
  const ProfileType = new GraphQLObjectType({
    name: `${typeNamePrefix}Profile`,
    fields: {
      details: batchedField(DetailsType, (sources) =>
        sources.map((source: any) => source.details),
      ),
      ...profileFields,
    },
  });

  return schemaWithUserFields(
    {
      profile: batchedField(ProfileType, (sources) =>
        sources.map((source: any) => source.profile),
      ),
    },
    `${typeNamePrefix}User`,
  );
}

export interface BatchCall {
  ids: ReadonlyArray<string>;
  paths: ReadonlyArray<ReadonlyArray<string | number>>;
}

export function batchCall(
  sources: ReadonlyArray<unknown>,
  info: GraphQLBatchedResolveInfo,
): BatchCall {
  const users = sources as ReadonlyArray<{ id: string }>;
  return {
    ids: users.map((source) => source.id),
    paths: info.paths.map(pathToArray),
  };
}
