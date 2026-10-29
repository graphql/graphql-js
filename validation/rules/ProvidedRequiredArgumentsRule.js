"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvidedRequiredArgumentsRule = ProvidedRequiredArgumentsRule;
exports.ProvidedRequiredArgumentsOnDirectivesRule = ProvidedRequiredArgumentsOnDirectivesRule;
const inspect_ts_1 = require("../../jsutils/inspect.js");
const GraphQLError_ts_1 = require("../../error/GraphQLError.js");
const kinds_ts_1 = require("../../language/kinds.js");
const printer_ts_1 = require("../../language/printer.js");
const definition_ts_1 = require("../../type/definition.js");
const directives_ts_1 = require("../../type/directives.js");
const typeFromAST_ts_1 = require("../../utilities/typeFromAST.js");
function ProvidedRequiredArgumentsRule(context) {
    const requiredArgsByFragment = new Map();
    return {
        ...ProvidedRequiredArgumentsOnDirectivesRule(context),
        Field: {
            leave(fieldNode) {
                const fieldDef = context.getFieldDef();
                if (!fieldDef) {
                    return false;
                }
                const providedArgs = new Set(fieldNode.arguments?.map((arg) => arg.name.value));
                for (const argDef of fieldDef.args) {
                    if (!providedArgs.has(argDef.name) && (0, definition_ts_1.isRequiredArgument)(argDef)) {
                        context.reportError(new GraphQLError_ts_1.GraphQLError(`Argument "${argDef}" of type "${argDef.type}" is required, but it was not provided.`, { nodes: fieldNode }));
                    }
                }
            },
        },
        FragmentSpread: {
            leave(spreadNode) {
                const fragmentSignature = context.getFragmentSignature();
                if (!fragmentSignature) {
                    return false;
                }
                let requiredArgs = requiredArgsByFragment.get(fragmentSignature);
                if (!requiredArgs) {
                    requiredArgs = [...fragmentSignature.variableDefinitions].filter(([, definition]) => isRequiredArgumentNode(definition));
                    requiredArgsByFragment.set(fragmentSignature, requiredArgs);
                }
                const providedArgs = new Set(spreadNode.arguments?.map((arg) => arg.name.value));
                for (const [varName, variableDefinition] of requiredArgs) {
                    if (!providedArgs.has(varName)) {
                        const type = (0, typeFromAST_ts_1.typeFromAST)(context.getSchema(), variableDefinition.type);
                        const argTypeStr = (0, inspect_ts_1.inspect)(type);
                        context.reportError(new GraphQLError_ts_1.GraphQLError(`Fragment "${spreadNode.name.value}" argument "${varName}" of type "${argTypeStr}" is required, but it was not provided.`, { nodes: spreadNode }));
                    }
                }
            },
        },
    };
}
function ProvidedRequiredArgumentsOnDirectivesRule(context) {
    const requiredArgsMap = new Map();
    const schema = context.getSchema();
    const definedDirectives = schema?.getDirectives() ?? directives_ts_1.specifiedDirectives;
    for (const directive of definedDirectives) {
        requiredArgsMap.set(directive.name, new Map(directive.args.filter(definition_ts_1.isRequiredArgument).map((arg) => [arg.name, arg])));
    }
    const astDefinitions = context.getDocument().definitions;
    for (const def of astDefinitions) {
        if (def.kind === kinds_ts_1.Kind.DIRECTIVE_DEFINITION) {
            const argNodes = def.arguments ?? [];
            requiredArgsMap.set(def.name.value, new Map(argNodes
                .filter(isRequiredArgumentNode)
                .map((arg) => [arg.name.value, arg])));
        }
    }
    return {
        Directive: {
            leave(directiveNode) {
                const directiveName = directiveNode.name.value;
                const requiredArgs = requiredArgsMap.get(directiveName);
                if (requiredArgs != null) {
                    const argNodes = directiveNode.arguments ?? [];
                    const argNodeMap = new Set(argNodes.map((arg) => arg.name.value));
                    for (const [argName, argDef] of requiredArgs.entries()) {
                        if (!argNodeMap.has(argName)) {
                            const argType = (0, definition_ts_1.isType)(argDef.type)
                                ? (0, inspect_ts_1.inspect)(argDef.type)
                                : (0, printer_ts_1.print)(argDef.type);
                            context.reportError(new GraphQLError_ts_1.GraphQLError(`Argument "@${directiveName}(${argName}:)" of type "${argType}" is required, but it was not provided.`, { nodes: directiveNode }));
                        }
                    }
                }
            },
        },
    };
}
function isRequiredArgumentNode(arg) {
    return arg.type.kind === kinds_ts_1.Kind.NON_NULL_TYPE && arg.defaultValue == null;
}
//# sourceMappingURL=ProvidedRequiredArgumentsRule.js.map