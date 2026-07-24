import type { Maybe } from '../../../jsutils/Maybe.ts';
import { SetMap } from '../../../jsutils/SetMap.ts';

import type {
  FragmentDefinitionNode,
  SelectionSetNode,
} from '../../../language/ast.ts';
import { isNode } from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';
import type { ASTVisitor } from '../../../language/visitor.ts';

import type {
  GraphQLCompositeType,
  GraphQLNamedType,
  GraphQLOutputType,
} from '../../../type/definition.ts';
import { getNamedType, isCompositeType } from '../../../type/definition.ts';
import type { GraphQLSchema } from '../../../type/schema.ts';

import { typeFromAST } from '../../../utilities/typeFromAST.ts';
import type { FragmentSignature } from '../../../utilities/TypeInfo.ts';

import type { VariableScope } from './argumentsKey.ts';
import { EffectiveFieldSet } from './EffectiveFieldSet.ts';
import type { FieldOccurrence } from './FieldOccurrence.ts';
import type { FieldSetContext, FragmentSpreadOccurrence } from './FieldSet.ts';
import { FieldSet } from './FieldSet.ts';

interface FieldSetGraphContext {
  getFragment: (fragmentName: string) => Maybe<FragmentDefinitionNode>;
  getFragmentSignatureByName: () => (
    fragmentName: string,
  ) => Maybe<FragmentSignature>;
  getParentType: () => Maybe<GraphQLCompositeType>;
  getSchema: () => GraphQLSchema;
}

/**
 * Represents the relationships between document selection sets, field child
 * selection sets, and named fragments for one validation.
 *
 * @internal
 */
export class FieldSetGraph {
  private _context: FieldSetGraphContext;
  private _fieldSetContext: FieldSetContext;
  private _currentVariableScope: VariableScope | undefined;
  private _nextVariableScopeId = 0;
  private _fieldSetsBySelectionSet = new WeakMap<SelectionSetNode, FieldSet>();
  private _variableScopesByKey: Map<string, VariableScope> | undefined;
  private _effectiveFieldSetsByStartingFieldSets:
    | SetMap<FieldSet, EffectiveFieldSet>
    | undefined;

  constructor(context: FieldSetGraphContext) {
    this._context = context;
    this._fieldSetContext = {
      validationContext: context,
      usesFragmentArguments: false,
      getFragmentSignature: context.getFragmentSignatureByName(),
    };
  }

  usesFragmentArguments(): boolean {
    return this._fieldSetContext.usesFragmentArguments;
  }

  getVisitor(
    onFieldSet: (fieldSet: FieldSet) => void,
    onComplete?: () => void,
  ): ASTVisitor {
    return {
      // TypeInfo installs this document's fragment signatures on entry.
      Document: {
        enter: () => {
          this._fieldSetContext.getFragmentSignature =
            this._context.getFragmentSignatureByName();
        },
        leave: onComplete,
      },
      FragmentDefinition: {
        enter: (node: FragmentDefinitionNode) => {
          if ((node.variableDefinitions?.length ?? 0) !== 0) {
            this._fieldSetContext.usesFragmentArguments = true;
            this._currentVariableScope = this._getOrCreateVariableScope(
              this._fieldSetContext.getFragmentSignature(node.name.value),
            );
          }
        },
        leave: () => {
          this._currentVariableScope = undefined;
        },
      },
      SelectionSet: (node, _key, parent) => {
        // Inline fragments do not create a new response level. Their
        // selections are collected into the enclosing FieldSet using the
        // fragment's type condition.
        if (isNode(parent) && parent.kind === Kind.INLINE_FRAGMENT) {
          return;
        }
        onFieldSet(this._addSelectionSet(this._context.getParentType(), node));
      },
    };
  }

  getEffectiveFieldSet(
    startingFieldSets: ReadonlySet<FieldSet>,
  ): EffectiveFieldSet {
    return (this._effectiveFieldSetsByStartingFieldSets ??=
      new SetMap()).getOrInsertComputed(
      startingFieldSets,
      (canonicalStartingFieldSets) =>
        new EffectiveFieldSet(canonicalStartingFieldSets, (fragmentSpread) =>
          this._getFragmentFieldSet(fragmentSpread),
        ),
    );
  }

  getSubfieldFieldSets(
    fields: ReadonlyArray<FieldOccurrence>,
  ): ReadonlySet<FieldSet> {
    const startingFieldSets = new Set<FieldSet>();
    for (const field of fields) {
      const selectionSet = field.node.selectionSet;
      if (selectionSet !== undefined) {
        startingFieldSets.add(
          this._getSubfieldSet(
            selectionSet,
            field.getOutputType(),
            field.variableScope,
          ),
        );
      }
    }
    return startingFieldSets;
  }

  // Follows child selection sets and named fragment spreads to determine
  // whether the exact descendant occurrence belongs beneath this field.
  fieldContainsDescendant(
    containingField: FieldOccurrence,
    descendantField: FieldOccurrence,
  ): boolean {
    const selectionSet = containingField.node.selectionSet;
    if (selectionSet === undefined) {
      return false;
    }
    return this._fieldSetContainsField(
      this._getSubfieldSet(
        selectionSet,
        containingField.getOutputType(),
        containingField.variableScope,
      ),
      descendantField,
      new Set(),
    );
  }

  private _fieldSetContainsField(
    fieldSet: FieldSet,
    targetField: FieldOccurrence,
    visited: Set<FieldSet>,
  ): boolean {
    if (visited.has(fieldSet)) {
      return false;
    }
    visited.add(fieldSet);
    for (const fieldGroup of fieldSet.getFieldGroupsByResponseName().values()) {
      for (const field of fieldGroup.getFields()) {
        if (
          field.node === targetField.node &&
          field.variableScope === targetField.variableScope
        ) {
          return true;
        }
        const selectionSet = field.node.selectionSet;
        if (
          selectionSet !== undefined &&
          this._fieldSetContainsField(
            this._getSubfieldSet(
              selectionSet,
              field.getOutputType(),
              field.variableScope,
            ),
            targetField,
            visited,
          )
        ) {
          return true;
        }
      }
    }
    for (const spreads of fieldSet.getFragmentSpreadsByName().values()) {
      for (const spread of spreads) {
        if (
          this._fieldSetContainsField(
            this._getFragmentFieldSet(spread),
            targetField,
            visited,
          )
        ) {
          return true;
        }
      }
    }
    return false;
  }

  private _getFragmentFieldSet(
    fragmentSpread: FragmentSpreadOccurrence,
  ): FieldSet {
    const fragmentDefinition = fragmentSpread.fragmentDefinition;
    let templateFieldSet = this._fieldSetsBySelectionSet.get(
      fragmentDefinition.selectionSet,
    );
    if (templateFieldSet === undefined) {
      const type = typeFromAST(
        this._context.getSchema(),
        fragmentDefinition.typeCondition,
      );
      templateFieldSet = this._getOrCreateFieldSet(
        fragmentDefinition.selectionSet,
        isCompositeType(type) ? type : undefined,
      );
    }
    return this._bindFieldSet(
      templateFieldSet,
      this.usesFragmentArguments()
        ? this._getOrCreateVariableScope(
            this._fieldSetContext.getFragmentSignature(
              fragmentDefinition.name.value,
            ),
            fragmentSpread.argumentsKey,
          )
        : undefined,
    );
  }

  private _getSubfieldSet(
    selectionSet: SelectionSetNode,
    outputType: GraphQLOutputType | undefined,
    variableScope: VariableScope | undefined,
  ): FieldSet {
    return this._bindFieldSet(
      this._getOrCreateFieldSet(
        selectionSet,
        outputType === undefined ? undefined : getNamedType(outputType),
      ),
      variableScope,
    );
  }

  private _addSelectionSet(
    parentType: Maybe<GraphQLNamedType>,
    node: SelectionSetNode,
  ): FieldSet {
    return this._bindFieldSet(
      this._getOrCreateFieldSet(node, parentType),
      this._currentVariableScope,
    );
  }

  private _getOrCreateVariableScope(
    fragmentSignature: FragmentSignature | null | undefined,
    spreadArgumentsKey?: string,
  ): VariableScope | undefined {
    // Another validation error can leave a fragment without a signature. Keep
    // collecting it as an unbound field set so this rule remains best-effort.
    if (
      fragmentSignature == null ||
      fragmentSignature.variableDefinitions.size === 0
    ) {
      return undefined;
    }
    const fragmentName = fragmentSignature.definition.name.value;
    const scopeKey = JSON.stringify([
      fragmentName,
      spreadArgumentsKey ?? 'definition',
    ]);
    const variableScopesByKey = (this._variableScopesByKey ??= new Map());
    let variableScope = variableScopesByKey.get(scopeKey);
    if (variableScope === undefined) {
      // Compact lexical IDs avoid embedding the full chain of forwarded
      // argument keys.
      const scopeId = this._nextVariableScopeId++;
      const createdVariableScope = new Map<string, string>();
      for (const name of fragmentSignature.variableDefinitions.keys()) {
        createdVariableScope.set(name, `fragment:${scopeId}:${name}`);
      }
      variableScope = createdVariableScope;
      variableScopesByKey.set(scopeKey, variableScope);
    }
    return variableScope;
  }

  private _getOrCreateFieldSet(
    selectionSet: SelectionSetNode,
    parentType: Maybe<GraphQLNamedType>,
  ): FieldSet {
    const cached = this._fieldSetsBySelectionSet.get(selectionSet);
    if (cached !== undefined) {
      return cached;
    }
    const fieldSet = new FieldSet(
      this._fieldSetContext,
      selectionSet,
      parentType,
    );
    this._fieldSetsBySelectionSet.set(selectionSet, fieldSet);
    return fieldSet;
  }

  private _bindFieldSet(
    templateFieldSet: FieldSet,
    variableScope: VariableScope | undefined,
  ): FieldSet {
    if (variableScope === undefined) {
      return templateFieldSet;
    }
    const boundFieldSets = (templateFieldSet.boundFieldSets ??= new Map());
    let boundFieldSet = boundFieldSets.get(variableScope);
    if (boundFieldSet === undefined) {
      boundFieldSet = new FieldSet(
        this._fieldSetContext,
        templateFieldSet.selectionSet,
        templateFieldSet.parentType,
        { template: templateFieldSet, variableScope },
      );
      boundFieldSets.set(variableScope, boundFieldSet);
    }
    return boundFieldSet;
  }
}
