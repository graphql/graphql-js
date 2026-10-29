import { SetMap } from "../jsutils/SetMap.mjs";
import { Kind } from "../language/kinds.mjs";
import { visit } from "../language/visitor.mjs";
import { TypeInfo, visitWithTypeInfo } from "../utilities/TypeInfo.mjs";
import { validationAbortedError } from "./validationAbortedError.mjs";
export class ASTValidationContext {
    constructor(ast, onError) {
        this._remainingFragmentWork = 50_000;
        this._ast = ast;
        this._fragments = undefined;
        this._fragmentSpreads = new Map();
        this._recursivelyReferencedFragments = new SetMap();
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
        return this.getRecursivelyReferencedFragmentsForOperations([operation]);
    }
    getRecursivelyReferencedFragmentsForOperations(operations) {
        const fragmentNames = new Set(operations.flatMap(({ selectionSet }) => this.getFragmentSpreads(selectionSet).map(({ name }) => name.value)));
        let fragments = this._recursivelyReferencedFragments.get(fragmentNames);
        if (!fragments) {
            fragments = [];
            this.spendFragmentWork(fragmentNames.size);
            const collectedNames = new Set(fragmentNames);
            for (const fragName of collectedNames) {
                const fragment = this.getFragment(fragName);
                if (fragment) {
                    fragments.push(fragment);
                    const spreads = this.getFragmentSpreads(fragment.selectionSet);
                    this.spendFragmentWork(spreads.length);
                    for (const spread of spreads) {
                        collectedNames.add(spread.name.value);
                    }
                }
            }
            this._recursivelyReferencedFragments.set(fragmentNames, fragments);
        }
        return fragments;
    }
    spendFragmentWork(cost) {
        this._remainingFragmentWork -= cost;
        if (this._remainingFragmentWork < 0) {
            throw validationAbortedError;
        }
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
            const fragments = this.getRecursivelyReferencedFragments(operation);
            let fragmentUsages = this._recursiveVariableUsages.get(fragments);
            if (!fragmentUsages) {
                this.spendFragmentWork(fragments.length);
                fragmentUsages = fragments.flatMap((frag) => {
                    const localUsages = this.getVariableUsages(frag);
                    this.spendFragmentWork(localUsages.length);
                    return localUsages;
                });
                this._recursiveVariableUsages.set(fragments, fragmentUsages);
            }
            this.spendFragmentWork(fragmentUsages.length);
            usages = this.getVariableUsages(operation).concat(fragmentUsages);
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