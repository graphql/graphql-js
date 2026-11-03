export function buildResolveInfo(validatedExecutionArgs, fieldDef, fieldNodes, parentType, path, getAbortSignal, getAsyncHelpers) {
    const { schema, fragmentDefinitions, rootValue, operation, variableValues } = validatedExecutionArgs;
    return {
        fieldName: fieldDef.name,
        fieldNodes,
        returnType: fieldDef.type,
        parentType,
        path,
        schema,
        fragments: fragmentDefinitions,
        rootValue,
        operation,
        variableValues,
        getAbortSignal,
        getAsyncHelpers,
    };
}
//# sourceMappingURL=buildResolveInfo.mjs.map