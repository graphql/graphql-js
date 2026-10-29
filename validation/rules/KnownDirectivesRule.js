"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnownDirectivesRule = KnownDirectivesRule;
const inspect_ts_1 = require("../../jsutils/inspect.js");
const invariant_ts_1 = require("../../jsutils/invariant.js");
const GraphQLError_ts_1 = require("../../error/GraphQLError.js");
const ast_ts_1 = require("../../language/ast.js");
const directiveLocation_ts_1 = require("../../language/directiveLocation.js");
const kinds_ts_1 = require("../../language/kinds.js");
const directives_ts_1 = require("../../type/directives.js");
function KnownDirectivesRule(context) {
    const locationsMap = new Map();
    const schema = context.getSchema();
    const definedDirectives = schema
        ? schema.getDirectives()
        : directives_ts_1.specifiedDirectives;
    for (const directive of definedDirectives) {
        locationsMap.set(directive.name, new Set(directive.locations));
    }
    const astDefinitions = context.getDocument().definitions;
    for (const def of astDefinitions) {
        if (def.kind === kinds_ts_1.Kind.DIRECTIVE_DEFINITION) {
            locationsMap.set(def.name.value, new Set(def.locations.map((name) => name.value)));
        }
    }
    return {
        Directive(node, _key, _parent, _path, ancestors) {
            const name = node.name.value;
            const locations = locationsMap.get(name);
            if (locations == null) {
                context.reportError(new GraphQLError_ts_1.GraphQLError(`Unknown directive "@${name}".`, { nodes: node }));
                return;
            }
            const candidateLocation = getDirectiveLocationForASTPath(ancestors);
            if (candidateLocation != null && !locations.has(candidateLocation)) {
                context.reportError(new GraphQLError_ts_1.GraphQLError(`Directive "@${name}" may not be used on ${candidateLocation}.`, { nodes: node }));
            }
        },
    };
}
function getDirectiveLocationForASTPath(ancestors) {
    const appliedTo = ancestors.at(-1);
    if (!(appliedTo != null && 'kind' in appliedTo))
        (0, invariant_ts_1.invariant)(false);
    switch (appliedTo.kind) {
        case kinds_ts_1.Kind.OPERATION_DEFINITION:
            return getDirectiveLocationForOperation(appliedTo.operation);
        case kinds_ts_1.Kind.FIELD:
            return directiveLocation_ts_1.DirectiveLocation.FIELD;
        case kinds_ts_1.Kind.FRAGMENT_SPREAD:
            return directiveLocation_ts_1.DirectiveLocation.FRAGMENT_SPREAD;
        case kinds_ts_1.Kind.INLINE_FRAGMENT:
            return directiveLocation_ts_1.DirectiveLocation.INLINE_FRAGMENT;
        case kinds_ts_1.Kind.FRAGMENT_DEFINITION:
            return directiveLocation_ts_1.DirectiveLocation.FRAGMENT_DEFINITION;
        case kinds_ts_1.Kind.VARIABLE_DEFINITION: {
            const parentNode = ancestors[ancestors.length - 3];
            if (!('kind' in parentNode))
                (0, invariant_ts_1.invariant)(false);
            return parentNode.kind === kinds_ts_1.Kind.OPERATION_DEFINITION
                ? directiveLocation_ts_1.DirectiveLocation.VARIABLE_DEFINITION
                : directiveLocation_ts_1.DirectiveLocation.FRAGMENT_VARIABLE_DEFINITION;
        }
        case kinds_ts_1.Kind.SCHEMA_DEFINITION:
        case kinds_ts_1.Kind.SCHEMA_EXTENSION:
            return directiveLocation_ts_1.DirectiveLocation.SCHEMA;
        case kinds_ts_1.Kind.SCALAR_TYPE_DEFINITION:
        case kinds_ts_1.Kind.SCALAR_TYPE_EXTENSION:
            return directiveLocation_ts_1.DirectiveLocation.SCALAR;
        case kinds_ts_1.Kind.OBJECT_TYPE_DEFINITION:
        case kinds_ts_1.Kind.OBJECT_TYPE_EXTENSION:
            return directiveLocation_ts_1.DirectiveLocation.OBJECT;
        case kinds_ts_1.Kind.FIELD_DEFINITION:
            return directiveLocation_ts_1.DirectiveLocation.FIELD_DEFINITION;
        case kinds_ts_1.Kind.INTERFACE_TYPE_DEFINITION:
        case kinds_ts_1.Kind.INTERFACE_TYPE_EXTENSION:
            return directiveLocation_ts_1.DirectiveLocation.INTERFACE;
        case kinds_ts_1.Kind.UNION_TYPE_DEFINITION:
        case kinds_ts_1.Kind.UNION_TYPE_EXTENSION:
            return directiveLocation_ts_1.DirectiveLocation.UNION;
        case kinds_ts_1.Kind.ENUM_TYPE_DEFINITION:
        case kinds_ts_1.Kind.ENUM_TYPE_EXTENSION:
            return directiveLocation_ts_1.DirectiveLocation.ENUM;
        case kinds_ts_1.Kind.ENUM_VALUE_DEFINITION:
            return directiveLocation_ts_1.DirectiveLocation.ENUM_VALUE;
        case kinds_ts_1.Kind.INPUT_OBJECT_TYPE_DEFINITION:
        case kinds_ts_1.Kind.INPUT_OBJECT_TYPE_EXTENSION:
            return directiveLocation_ts_1.DirectiveLocation.INPUT_OBJECT;
        case kinds_ts_1.Kind.INPUT_VALUE_DEFINITION: {
            const parentNode = ancestors.at(-3);
            if (!(parentNode != null && 'kind' in parentNode))
                (0, invariant_ts_1.invariant)(false);
            return parentNode.kind === kinds_ts_1.Kind.INPUT_OBJECT_TYPE_DEFINITION ||
                parentNode.kind === kinds_ts_1.Kind.INPUT_OBJECT_TYPE_EXTENSION
                ? directiveLocation_ts_1.DirectiveLocation.INPUT_FIELD_DEFINITION
                : directiveLocation_ts_1.DirectiveLocation.ARGUMENT_DEFINITION;
        }
        case kinds_ts_1.Kind.DIRECTIVE_DEFINITION:
        case kinds_ts_1.Kind.DIRECTIVE_EXTENSION:
            return directiveLocation_ts_1.DirectiveLocation.DIRECTIVE_DEFINITION;
        default:
            (0, invariant_ts_1.invariant)(false, 'Unexpected kind: ' + (0, inspect_ts_1.inspect)(appliedTo.kind));
    }
}
function getDirectiveLocationForOperation(operation) {
    switch (operation) {
        case ast_ts_1.OperationTypeNode.QUERY:
            return directiveLocation_ts_1.DirectiveLocation.QUERY;
        case ast_ts_1.OperationTypeNode.MUTATION:
            return directiveLocation_ts_1.DirectiveLocation.MUTATION;
        case ast_ts_1.OperationTypeNode.SUBSCRIPTION:
            return directiveLocation_ts_1.DirectiveLocation.SUBSCRIPTION;
    }
}
//# sourceMappingURL=KnownDirectivesRule.js.map