Split Execution into two phases
===============================
This is an attempt to address optmization concerns during query evaluation.

https://github.com/graphql/graphql-js/issues/26
https://github.com/graphql/graphql-js/issues/161
https://github.com/graphql-dotnet/graphql-dotnet/issues/21
https://github.com/graphql/graphql-js/issues/149
https://github.com/graphql/graphql-js/issues/111
https://github.com/graphql/graphql-js/pull/39
https://github.com/graphql/graphql-js/issues/19
https://github.com/rmosolgo/graphql-ruby/issues/6

This approach splits execution into two phases, a planning phase and an evaluation phase.

In the planning phase the AST in analyzed and a heirarchical plan structure is created indicating
how the executor will evaluate the query.  Precalculating this information serves two purposes:

1. Provides a reliable and simple indication to resolving functions what evaulations will occur next.
2. Avoids re-calculating some data when evaluating list results

There is no attempt to optimize the plan.  This is out of scope, although it would be possible to write
optimizing functions that accepted a plan and output a different plan before evaluation.

Evaluation order is not changed.

The current interface for resolver authors
------------------------------------------


GraphQLObjectType allows defining an isTypeOf function
` isTypeOf: ?(value: mixed, info?: GraphQLResolveInfo) => boolean;`

A Default resolveType function is available in getTypeOf which may call isTypeOf
`function getTypeOf(value: mixed, info: GraphQLResolveInfo, abstractType: GraphQLAbstractType): ?GraphQLObjectType`

GraphQLInterfaceType and GraphQLUnionType allow defining a resolveType function
`resolveType: ?(value: mixed, info?: GraphQLResolveInfo) => ?GraphQLObjectType;`

GraphQLInterfaceType and GraphQLUnionType defines a getObjectType function which calls the resolveType or getTypeOf function
``getObjectType(value: mixed, info: GraphQLResolveInfo): ?GraphQLObjectType`

A field definition defines a resolve function
`resolve?: GraphQLFieldResolveFn;`

(Why do GraphQLObjectType, GraphQLInterfaceType and GraphQLInterfaceType take their functions as config parameters, which field definition declares it directly?

A GraphQLScalarType allows defining a serialize function
`serialize: (value: mixed) => ?InternalType;`
