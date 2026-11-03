import { toError } from "../jsutils/toError.mjs";
import { GraphQLError } from "./GraphQLError.mjs";
export function locatedError(rawOriginalError, nodes, path) {
    const originalError = toError(rawOriginalError);
    if (isLocatedGraphQLError(originalError)) {
        return originalError;
    }
    return new GraphQLError(originalError.message, {
        nodes: originalError.nodes ?? nodes,
        source: originalError.source,
        positions: originalError.positions,
        path,
        originalError,
    });
}
function isLocatedGraphQLError(error) {
    return Array.isArray(error.path);
}
//# sourceMappingURL=locatedError.mjs.map