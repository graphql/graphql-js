"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildASTSchema = buildASTSchema;
exports.buildSchema = buildSchema;
const parser_ts_1 = require("../language/parser.js");
const directives_ts_1 = require("../type/directives.js");
const schema_ts_1 = require("../type/schema.js");
const validate_ts_1 = require("../validation/validate.js");
const extendSchema_ts_1 = require("./extendSchema.js");
function buildASTSchema(documentAST, options) {
    if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
        (0, validate_ts_1.assertValidSDL)(documentAST);
    }
    const emptySchemaConfig = {
        description: undefined,
        types: [],
        directives: [],
        extensions: Object.create(null),
        extensionASTNodes: [],
        assumeValid: false,
    };
    const config = (0, extendSchema_ts_1.extendSchemaImpl)(emptySchemaConfig, documentAST, options);
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
        ...directives_ts_1.specifiedDirectives.filter((stdDirective) => config.directives.every((directive) => directive.name !== stdDirective.name)),
    ];
    return new schema_ts_1.GraphQLSchema({ ...config, directives });
}
function buildSchema(source, options) {
    const document = (0, parser_ts_1.parse)(source, options);
    return buildASTSchema(document, {
        assumeValidSDL: options?.assumeValidSDL,
        assumeValid: options?.assumeValid,
    });
}
//# sourceMappingURL=buildASTSchema.js.map