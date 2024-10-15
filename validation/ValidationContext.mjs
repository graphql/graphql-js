import { Kind } from "../language/kinds.mjs";
import { visit } from "../language/visitor.mjs";
import { TypeInfo, visitWithTypeInfo } from "../utilities/TypeInfo.mjs";
/**
 * An instance of this class is passed as the "this" context to all validators,
 * allowing access to commonly useful contextual information from within a
 * validation rule.
 */
export class ASTValidationContext {
    constructor(ast, onError) {
        this._ast = ast;
        this._fragments = undefined;
        this._fragmentSpreads = new Map();
        this._recursivelyReferencedFragments = new Map();
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
                if (defNode.kind === Kind.FRAGMENT_DEFINITION) {
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
                    if (selection.kind === Kind.FRAGMENT_SPREAD) {
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
        let fragments = this._recursivelyReferencedFragments.get(operation);
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
            this._recursivelyReferencedFragments.set(operation, fragments);
        }
        return fragments;
    }
}
export class SDLValidationContext extends ASTValidationContext {
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
export class ValidationContext extends ASTValidationContext {
    constructor(schema, ast, typeInfo, onError, hideSuggestions) {
        super(ast, onError);
        this._schema = schema;
        this._typeInfo = typeInfo;
        this._variableUsages = new Map();
        this._recursiveVariableUsages = new Map();
        this._hideSuggestions = hideSuggestions ?? false;
    }
    get [Symbol.toStringTag]() {
        return 'ValidationContext';
    }
    get hideSuggestions() {
        return this._hideSuggestions;
    }
    getSchema() {
        return this._schema;
    }
    getVariableUsages(node) {
        let usages = this._variableUsages.get(node);
        if (!usages) {
            const newUsages = [];
            const typeInfo = new TypeInfo(this._schema, undefined, this._typeInfo.getFragmentSignatureByName());
            const fragmentDefinition = node.kind === Kind.FRAGMENT_DEFINITION ? node : undefined;
            visit(node, visitWithTypeInfo(typeInfo, {
                VariableDefinition: () => false,
                Variable(variable) {
                    let fragmentVariableDefinition;
                    if (fragmentDefinition) {
                        const fragmentSignature = typeInfo.getFragmentSignatureByName()(fragmentDefinition.name.value);
                        fragmentVariableDefinition =
                            fragmentSignature?.variableDefinitions.get(variable.name.value);
                        newUsages.push({
                            node: variable,
                            type: typeInfo.getInputType(),
                            parentType: typeInfo.getParentInputType(),
                            defaultValue: undefined, // fragment variables have a variable default but no location default, which is what this default value represents
                            fragmentVariableDefinition,
                        });
                    }
                    else {
                        newUsages.push({
                            node: variable,
                            type: typeInfo.getInputType(),
                            parentType: typeInfo.getParentInputType(),
                            defaultValue: typeInfo.getDefaultValue(),
                            fragmentVariableDefinition: undefined,
                        });
                    }
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
//# sourceMappingURL=ValidationContext.js.map