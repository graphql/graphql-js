import { parse } from "../language/parser.mjs";
import { specifiedDirectives } from "../type/directives.mjs";
import { GraphQLSchema } from "../type/schema.mjs";
import { assertValidSDL } from "../validation/validate.mjs";
import { extendSchemaImpl } from "./extendSchema.mjs";
export function buildASTSchema(documentAST, options) {
    if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
        assertValidSDL(documentAST);
    }
    const emptySchemaConfig = {
        description: undefined,
        types: [],
        directives: [],
        extensions: Object.create(null),
        extensionASTNodes: [],
        assumeValid: false,
    };
    const config = extendSchemaImpl(emptySchemaConfig, documentAST, options);
    if (config.astNode == null) {
        for (const type of config.types) {
            switch (type.name) {
                case 'Query':
                    config.query = type;
                    break;
                case 'Mutation':
                    config.mutation = type;
                    break;
                case 'Subscription':
                    config.subscription = type;
                    break;
            }
        }
    }
    const directives = [
        ...config.directives,
        ...specifiedDirectives.filter((stdDirective) => config.directives.every((directive) => directive.name !== stdDirective.name)),
    ];
    return new GraphQLSchema({ ...config, directives });
}
export function buildSchema(source, options) {
    const document = parse(source, options);
    return buildASTSchema(document, {
        assumeValidSDL: options?.assumeValidSDL,
        assumeValid: options?.assumeValid,
    });
}
//# sourceMappingURL=buildASTSchema.js.map