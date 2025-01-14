"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDefinitionNode = isDefinitionNode;
exports.isExecutableDefinitionNode = isExecutableDefinitionNode;
exports.isSelectionNode = isSelectionNode;
exports.isValueNode = isValueNode;
exports.isConstValueNode = isConstValueNode;
exports.isTypeNode = isTypeNode;
exports.isTypeSystemDefinitionNode = isTypeSystemDefinitionNode;
exports.isTypeDefinitionNode = isTypeDefinitionNode;
exports.isTypeSystemExtensionNode = isTypeSystemExtensionNode;
exports.isTypeExtensionNode = isTypeExtensionNode;
const kinds_js_1 = require("./kinds.js");
function isDefinitionNode(node) {
    return (isExecutableDefinitionNode(node) ||
        isTypeSystemDefinitionNode(node) ||
        isTypeSystemExtensionNode(node));
}
function isExecutableDefinitionNode(node) {
    return (node.kind === kinds_js_1.Kind.OPERATION_DEFINITION ||
        node.kind === kinds_js_1.Kind.FRAGMENT_DEFINITION);
}
function isSelectionNode(node) {
    return (node.kind === kinds_js_1.Kind.FIELD ||
        node.kind === kinds_js_1.Kind.FRAGMENT_SPREAD ||
        node.kind === kinds_js_1.Kind.INLINE_FRAGMENT);
}
function isValueNode(node) {
    return (node.kind === kinds_js_1.Kind.VARIABLE ||
        node.kind === kinds_js_1.Kind.INT ||
        node.kind === kinds_js_1.Kind.FLOAT ||
        node.kind === kinds_js_1.Kind.STRING ||
        node.kind === kinds_js_1.Kind.BOOLEAN ||
        node.kind === kinds_js_1.Kind.NULL ||
        node.kind === kinds_js_1.Kind.ENUM ||
        node.kind === kinds_js_1.Kind.LIST ||
        node.kind === kinds_js_1.Kind.OBJECT);
}
function isConstValueNode(node) {
    return (isValueNode(node) &&
        (node.kind === kinds_js_1.Kind.LIST
            ? node.values.some(isConstValueNode)
            : node.kind === kinds_js_1.Kind.OBJECT
                ? node.fields.some((field) => isConstValueNode(field.value))
                : node.kind !== kinds_js_1.Kind.VARIABLE));
}
function isTypeNode(node) {
    return (node.kind === kinds_js_1.Kind.NAMED_TYPE ||
        node.kind === kinds_js_1.Kind.LIST_TYPE ||
        node.kind === kinds_js_1.Kind.NON_NULL_TYPE);
}
function isTypeSystemDefinitionNode(node) {
    return (node.kind === kinds_js_1.Kind.SCHEMA_DEFINITION ||
        isTypeDefinitionNode(node) ||
        node.kind === kinds_js_1.Kind.DIRECTIVE_DEFINITION);
}
function isTypeDefinitionNode(node) {
    return (node.kind === kinds_js_1.Kind.SCALAR_TYPE_DEFINITION ||
        node.kind === kinds_js_1.Kind.OBJECT_TYPE_DEFINITION ||
        node.kind === kinds_js_1.Kind.INTERFACE_TYPE_DEFINITION ||
        node.kind === kinds_js_1.Kind.UNION_TYPE_DEFINITION ||
        node.kind === kinds_js_1.Kind.ENUM_TYPE_DEFINITION ||
        node.kind === kinds_js_1.Kind.INPUT_OBJECT_TYPE_DEFINITION);
}
function isTypeSystemExtensionNode(node) {
    return node.kind === kinds_js_1.Kind.SCHEMA_EXTENSION || isTypeExtensionNode(node);
}
function isTypeExtensionNode(node) {
    return (node.kind === kinds_js_1.Kind.SCALAR_TYPE_EXTENSION ||
        node.kind === kinds_js_1.Kind.OBJECT_TYPE_EXTENSION ||
        node.kind === kinds_js_1.Kind.INTERFACE_TYPE_EXTENSION ||
        node.kind === kinds_js_1.Kind.UNION_TYPE_EXTENSION ||
        node.kind === kinds_js_1.Kind.ENUM_TYPE_EXTENSION ||
        node.kind === kinds_js_1.Kind.INPUT_OBJECT_TYPE_EXTENSION);
}
//# sourceMappingURL=predicates.js.map