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

import { EffectiveFieldSet } from './EffectiveFieldSet.ts';
import type { FieldOccurrence } from './FieldOccurrence.ts';
import type { FieldSetContext, FragmentSpreadOccurrence } from './FieldSet.ts';
import { FieldSet } from './FieldSet.ts';

interface FieldSetGraphContext {
  getFragment: (fragmentName: string) => Maybe<FragmentDefinitionNode>;
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
  private _fieldSetsBySelectionSet = new WeakMap<SelectionSetNode, FieldSet>();
  private _effectiveFieldSetsByStartingFieldSets:
    | SetMap<FieldSet, EffectiveFieldSet>
    | undefined;

  constructor(context: FieldSetGraphContext) {
    this._context = context;
    this._fieldSetContext = {
      validationContext: context,
    };
  }

  getVisitor(
    onFieldSet: (fieldSet: FieldSet) => void,
    onComplete?: () => void,
  ): ASTVisitor {
    return {
      Document: { leave: onComplete },
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
          this._getSubfieldSet(selectionSet, field.getOutputType()),
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
      this._getSubfieldSet(selectionSet, containingField.getOutputType()),
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
        if (field.node === targetField.node) {
          return true;
        }
        const selectionSet = field.node.selectionSet;
        if (
          selectionSet !== undefined &&
          this._fieldSetContainsField(
            this._getSubfieldSet(selectionSet, field.getOutputType()),
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
    let fragmentFieldSet = this._fieldSetsBySelectionSet.get(
      fragmentDefinition.selectionSet,
    );
    if (fragmentFieldSet === undefined) {
      const type = typeFromAST(
        this._context.getSchema(),
        fragmentDefinition.typeCondition,
      );
      fragmentFieldSet = this._getOrCreateFieldSet(
        fragmentDefinition.selectionSet,
        isCompositeType(type) ? type : undefined,
      );
    }
    return fragmentFieldSet;
  }

  private _getSubfieldSet(
    selectionSet: SelectionSetNode,
    outputType: GraphQLOutputType | undefined,
  ): FieldSet {
    return this._getOrCreateFieldSet(
      selectionSet,
      outputType === undefined ? undefined : getNamedType(outputType),
    );
  }

  private _addSelectionSet(
    parentType: Maybe<GraphQLNamedType>,
    node: SelectionSetNode,
  ): FieldSet {
    return this._getOrCreateFieldSet(node, parentType);
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
}
