import { toError } from "../jsutils/toError.mjs";
import { GraphQLError } from "./GraphQLError.mjs";
export function ensureGraphQLError(rawError) {
    if (rawError instanceof GraphQLError) {
        return rawError;
    }
    const originalError = toError(rawError);
    return new GraphQLError(originalError.message, { originalError });
}
//# sourceMappingURL=ensureGraphQLError.mjs.map