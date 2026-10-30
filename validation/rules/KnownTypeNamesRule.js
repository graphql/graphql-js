"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnownTypeNamesRule = KnownTypeNamesRule;
const didYouMean_ts_1 = require("../../jsutils/didYouMean.js");
const suggestionList_ts_1 = require("../../jsutils/suggestionList.js");
const GraphQLError_ts_1 = require("../../error/GraphQLError.js");
const predicates_ts_1 = require("../../language/predicates.js");
const introspection_ts_1 = require("../../type/introspection.js");
const scalars_ts_1 = require("../../type/scalars.js");
function KnownTypeNamesRule(context) {
    const { definitions } = context.getDocument();
    const existingTypesMap = context.getSchema()?.getTypeMap() ?? {};
    let definedTypeNames;
    let typeNames;
    return {
        NamedType(node, _1, parent, _2, ancestors) {
            const typeName = node.name.value;
            if (!Object.hasOwn(existingTypesMap, typeName) &&
                !(definedTypeNames ??= new Set(definitions.filter(predicates_ts_1.isTypeDefinitionNode).map((def) => def.name.value))).has(typeName)) {
                const definitionNode = ancestors[2] ?? parent;
                const isSDL = definitionNode != null && isSDLNode(definitionNode);
                if (isSDL && standardTypeNames.has(typeName)) {
                    return;
                }
                let suggestedTypes = [];
                if (!context.hideSuggestions) {
                    typeNames ??= [
                        ...new Set([...Object.keys(existingTypesMap), ...definedTypeNames]),
                    ];
                    suggestedTypes = (0, suggestionList_ts_1.suggestionList)(typeName, isSDL ? [...standardTypeNames, ...typeNames] : typeNames);
                }
                context.reportError(new GraphQLError_ts_1.GraphQLError(`Unknown type "${typeName}".` + (0, didYouMean_ts_1.didYouMean)(suggestedTypes), { nodes: node }));
            }
        },
    };
}
const standardTypeNames = new Set([...scalars_ts_1.specifiedScalarTypes, ...introspection_ts_1.introspectionTypes].map((type) => type.name));
function isSDLNode(value) {
    return ('kind' in value &&
        ((0, predicates_ts_1.isTypeSystemDefinitionNode)(value) || (0, predicates_ts_1.isTypeSystemExtensionNode)(value)));
}
//# sourceMappingURL=KnownTypeNamesRule.js.map