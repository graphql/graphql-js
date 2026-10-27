"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationContext = exports.SDLValidationContext = exports.ASTValidationContext = void 0;
const SetMap_ts_1 = require("../jsutils/SetMap.js");
const kinds_ts_1 = require("../language/kinds.js");
const visitor_ts_1 = require("../language/visitor.js");
const TypeInfo_ts_1 = require("../utilities/TypeInfo.js");
class ASTValidationContext {
    constructor(ast, onError) {
        this._ast = ast;
        this._fragments = undefined;
        this._fragmentSpreads = new Map();
        this._recursivelyReferencedFragments = new SetMap_ts_1.SetMap();
        this._onError = onError;
    }
    get [Symbol.toStringTag]() {
        return 'ASTValidationContext';
    }
    reportError(error) {
        this._onError(error);
    }
    getDocument() {
        return this._ast;
    }
    getFragment(name) {
        let fragments;
        if (this._fragments) {
            fragments = this._fragments;
        }
        else {
            fragments = Object.create(null);
            for (const defNode of this.getDocument().definitions) {
                if (defNode.kind === kinds_ts_1.Kind.FRAGMENT_DEFINITION) {
                    fragments[defNode.name.value] = defNode;
                }
            }
            this._fragments = fragments;
        }
        return fragments[name];
    }
    getFragmentSpreads(node) {
        let spreads = this._fragmentSpreads.get(node);
        if (!spreads) {
            spreads = [];
            const setsToVisit = [node];
            let set;
            while ((set = setsToVisit.pop())) {
                for (const selection of set.selections) {
                    if (selection.kind === kinds_ts_1.Kind.FRAGMENT_SPREAD) {
                        spreads.push(selection);
                    }
                    else if (selection.selectionSet) {
                        setsToVisit.push(selection.selectionSet);
                    }
                }
            }
            this._fragmentSpreads.set(node, spreads);
        }
        return spreads;
    }
    getRecursivelyReferencedFragments(operation) {
        const fragmentNames = new Set(this.getFragmentSpreads(operation.selectionSet).map((spread) => spread.name.value));
        let fragments = this._recursivelyReferencedFragments.get(fragmentNames);
        if (!fragments) {
            fragments = [];
            const collectedNames = new Set();
            const nodesToVisit = [operation.selectionSet];
            let node;
            while ((node = nodesToVisit.pop())) {
                for (const spread of this.getFragmentSpreads(node)) {
                    const fragName = spread.name.value;
                    if (!collectedNames.has(fragName)) {
                        collectedNames.add(fragName);
                        const fragment = this.getFragment(fragName);
                        if (fragment) {
                            fragments.push(fragment);
                            nodesToVisit.push(fragment.selectionSet);
                        }
                    }
                }
            }
            this._recursivelyReferencedFragments.set(fragmentNames, fragments);
        }
        return fragments;
    }
}
exports.ASTValidationContext = ASTValidationContext;
class SDLValidationContext extends ASTValidationContext {
    constructor(ast, schema, onError) {
        super(ast, onError);
        this._schema = schema;
    }
    get hideSuggestions() {
        return false;
    }
    get [Symbol.toStringTag]() {
        return 'SDLValidationContext';
    }
    getSchema() {
        return this._schema;
    }
}
exports.SDLValidationContext = SDLValidationContext;
class ValidationContext extends ASTValidationContext {
    constructor(schema, ast, typeInfo, onError, hideSuggestionsOrOptions) {
        const options = typeof hideSuggestionsOrOptions === 'boolean'
            ? { hideSuggestions: hideSuggestionsOrOptions }
            : (hideSuggestionsOrOptions ?? {});
        const { hideSuggestions, allowEmptySelectionSets } = options;
        super(ast, onError);
        this._schema = schema;
        this._typeInfo = typeInfo;
        this._variableUsages = new Map();
        this._recursiveVariableUsages = new Map();
        this._hideSuggestions = hideSuggestions ?? false;
        this._allowEmptySelectionSets = allowEmptySelectionSets ?? true;
    }
    get [Symbol.toStringTag]() {
        return 'ValidationContext';
    }
    get hideSuggestions() {
        return this._hideSuggestions;
    }
    get allowEmptySelectionSets() {
        return this._allowEmptySelectionSets;
    }
    getSchema() {
        return this._schema;
    }
    getVariableUsages(node) {
        let usages = this._variableUsages.get(node);
        if (!usages) {
            const newUsages = [];
            const typeInfo = new TypeInfo_ts_1.TypeInfo(this._schema, undefined, this._typeInfo.getFragmentSignatureByName());
            const fragmentDefinition = node.kind === kinds_ts_1.Kind.FRAGMENT_DEFINITION ? node : undefined;
            (0, visitor_ts_1.visit)(node, (0, TypeInfo_ts_1.visitWithTypeInfo)(typeInfo, {
                VariableDefinition: () => false,
                Variable(variable) {
                    let fragmentVariableDefinition;
                    if (fragmentDefinition) {
                        const fragmentSignature = typeInfo.getFragmentSignatureByName()(fragmentDefinition.name.value);
                        fragmentVariableDefinition =
                            fragmentSignature?.variableDefinitions.get(variable.name.value);
                    }
                    newUsages.push({
                        node: variable,
                        type: typeInfo.getInputType(),
                        parentType: typeInfo.getParentInputType(),
                        defaultValue: typeInfo.getDefaultValue(),
                        fragmentVariableDefinition,
                    });
                },
            }));
            usages = newUsages;
            this._variableUsages.set(node, usages);
        }
        return usages;
    }
    getRecursiveVariableUsages(operation) {
        let usages = this._recursiveVariableUsages.get(operation);
        if (!usages) {
            usages = this.getVariableUsages(operation);
            for (const frag of this.getRecursivelyReferencedFragments(operation)) {
                usages = usages.concat(this.getVariableUsages(frag));
            }
            this._recursiveVariableUsages.set(operation, usages);
        }
        return usages;
    }
    getType() {
        return this._typeInfo.getType();
    }
    getParentType() {
        return this._typeInfo.getParentType();
    }
    getInputType() {
        return this._typeInfo.getInputType();
    }
    getParentInputType() {
        return this._typeInfo.getParentInputType();
    }
    getFieldDef() {
        return this._typeInfo.getFieldDef();
    }
    getDirective() {
        return this._typeInfo.getDirective();
    }
    getArgument() {
        return this._typeInfo.getArgument();
    }
    getFragmentSignature() {
        return this._typeInfo.getFragmentSignature();
    }
    getFragmentSignatureByName() {
        return this._typeInfo.getFragmentSignatureByName();
    }
    getEnumValue() {
        return this._typeInfo.getEnumValue();
    }
}
exports.ValidationContext = ValidationContext;
//# sourceMappingURL=ValidationContext.js.map