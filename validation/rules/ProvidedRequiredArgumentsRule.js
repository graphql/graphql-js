"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvidedRequiredArgumentsRule = ProvidedRequiredArgumentsRule;
exports.ProvidedRequiredArgumentsOnDirectivesRule = ProvidedRequiredArgumentsOnDirectivesRule;
const inspect_js_1 = require("../../jsutils/inspect.js");
const GraphQLError_js_1 = require("../../error/GraphQLError.js");
const kinds_js_1 = require("../../language/kinds.js");
const printer_js_1 = require("../../language/printer.js");
const definition_js_1 = require("../../type/definition.js");
const directives_js_1 = require("../../type/directives.js");
const typeFromAST_js_1 = require("../../utilities/typeFromAST.js");
/**
 * Provided required arguments
 *
 * A field or directive is only valid if all required (non-null without a
 * default value) field arguments have been provided.
 */
function ProvidedRequiredArgumentsRule(context) {
    return {
        // eslint-disable-next-line new-cap
        ...ProvidedRequiredArgumentsOnDirectivesRule(context),
        Field: {
            // Validate on leave to allow for deeper errors to appear first.
            leave(fieldNode) {
                const fieldDef = context.getFieldDef();
                if (!fieldDef) {
                    return false;
                }
                const providedArgs = new Set(fieldNode.arguments?.map((arg) => arg.name.value));
                for (const argDef of fieldDef.args) {
                    if (!providedArgs.has(argDef.name) && (0, definition_js_1.isRequiredArgument)(argDef)) {
                        context.reportError(new GraphQLError_js_1.GraphQLError(`Argument "${argDef}" of type "${argDef.type}" is required, but it was not provided.`, { nodes: fieldNode }));
                    }
                }
            },
        },
        FragmentSpread: {
            // Validate on leave to allow for deeper errors to appear first.
            leave(spreadNode) {
                const fragmentSignature = context.getFragmentSignature();
                if (!fragmentSignature) {
                    return false;
                }
                const providedArgs = new Set(spreadNode.arguments?.map((arg) => arg.name.value));
                for (const [varName, variableDefinition,] of fragmentSignature.variableDefinitions) {
                    if (!providedArgs.has(varName) &&
                        isRequiredArgumentNode(variableDefinition)) {
                        const type = (0, typeFromAST_js_1.typeFromAST)(context.getSchema(), variableDefinition.type);
                        const argTypeStr = (0, inspect_js_1.inspect)(type);
                        context.reportError(new GraphQLError_js_1.GraphQLError(`Fragment "${spreadNode.name.value}" argument "${varName}" of type "${argTypeStr}" is required, but it was not provided.`, { nodes: spreadNode }));
                    }
                }
            },
        },
    };
}
/**
 * @internal
 */
function ProvidedRequiredArgumentsOnDirectivesRule(context) {
    const requiredArgsMap = new Map();
    const schema = context.getSchema();
    const definedDirectives = schema?.getDirectives() ?? directives_js_1.specifiedDirectives;
    for (const directive of definedDirectives) {
        requiredArgsMap.set(directive.name, new Map(directive.args.filter(definition_js_1.isRequiredArgument).map((arg) => [arg.name, arg])));
    }
    const astDefinitions = context.getDocument().definitions;
    for (const def of astDefinitions) {
        if (def.kind === kinds_js_1.Kind.DIRECTIVE_DEFINITION) {
            const argNodes = def.arguments ?? [];
            requiredArgsMap.set(def.name.value, new Map(argNodes
                .filter(isRequiredArgumentNode)
                .map((arg) => [arg.name.value, arg])));
        }
    }
    return {
        Directive: {
            // Validate on leave to allow for deeper errors to appear first.
            leave(directiveNode) {
                const directiveName = directiveNode.name.value;
                const requiredArgs = requiredArgsMap.get(directiveName);
                if (requiredArgs != null) {
                    const argNodes = directiveNode.arguments ?? [];
                    const argNodeMap = new Set(argNodes.map((arg) => arg.name.value));
                    for (const [argName, argDef] of requiredArgs.entries()) {
                        if (!argNodeMap.has(argName)) {
                            const argType = (0, definition_js_1.isType)(argDef.type)
                                ? (0, inspect_js_1.inspect)(argDef.type)
                                : (0, printer_js_1.print)(argDef.type);
                            context.reportError(new GraphQLError_js_1.GraphQLError(`Argument "@${directiveName}(${argName}:)" of type "${argType}" is required, but it was not provided.`, { nodes: directiveNode }));
                        }
                    }
                }
            },
        },
    };
}
function isRequiredArgumentNode(arg) {
    return arg.type.kind === kinds_js_1.Kind.NON_NULL_TYPE && arg.defaultValue == null;
}
//# sourceMappingURL=ProvidedRequiredArgumentsRule.js.map