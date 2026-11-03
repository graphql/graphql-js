import { GraphQLError } from "./GraphQLError.mjs";
export function syntaxError(source, position, description) {
    return new GraphQLError(`Syntax Error: ${description}`, {
        source,
        positions: [position],
    });
}
//# sourceMappingURL=syntaxError.mjs.map