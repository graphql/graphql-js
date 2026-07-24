import { AccumulatorMap } from '../../../jsutils/AccumulatorMap.ts';
import type { Maybe } from '../../../jsutils/Maybe.ts';

import type {
  FragmentDefinitionNode,
  FragmentSpreadNode,
  SelectionSetNode,
} from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';

import type { GraphQLNamedType } from '../../../type/definition.ts';
import { isCompositeType } from '../../../type/definition.ts';
import type { GraphQLSchema } from '../../../type/schema.ts';

import { typeFromAST } from '../../../utilities/typeFromAST.ts';

import { FieldGroup } from './FieldGroup.ts';
import { FieldOccurrence } from './FieldOccurrence.ts';

/**
 * A defined fragment spread retained while expanding effective field sets.
 *
 * @internal
 */
export interface FragmentSpreadOccurrence {
  node: FragmentSpreadNode;
  fragmentDefinition: FragmentDefinitionNode;
}

/** @internal */
export interface FieldSetContext {
  validationContext: {
    getFragment: (fragmentName: string) => Maybe<FragmentDefinitionNode>;
    getSchema: () => GraphQLSchema;
  };
}

interface FieldSetContents {
  fieldGroupsByResponseName?: Map<string, FieldGroup>;
  fragmentSpreadsByName?: AccumulatorMap<string, FragmentSpreadOccurrence>;
  hasOverlappingFields?: true;
}

const EMPTY_FIELD_GROUPS_BY_RESPONSE_NAME: ReadonlyMap<string, FieldGroup> =
  new Map();
const EMPTY_FRAGMENT_SPREADS_BY_NAME: ReadonlyMap<
  string,
  ReadonlyArray<FragmentSpreadOccurrence>
> = new Map();

/**
 * The fields and defined fragment spreads contributed by one selection set at
 * one response level. Inline fragment selections belong to the enclosing
 * FieldSet, while named fragment bodies have their own FieldSets.
 *
 * @internal
 */
export class FieldSet {
  selectionSet: SelectionSetNode;
  parentType: Maybe<GraphQLNamedType>;
  private _context: FieldSetContext;
  private _contents: FieldSetContents | undefined;

  constructor(
    context: FieldSetContext,
    selectionSet: SelectionSetNode,
    parentType: Maybe<GraphQLNamedType>,
  ) {
    this._context = context;
    this.selectionSet = selectionSet;
    this.parentType = parentType;
  }

  getFieldGroupsByResponseName(): ReadonlyMap<string, FieldGroup> {
    const contents = this._getContents();
    return (
      contents.fieldGroupsByResponseName ?? EMPTY_FIELD_GROUPS_BY_RESPONSE_NAME
    );
  }

  getFragmentSpreadsByName(): ReadonlyMap<
    string,
    ReadonlyArray<FragmentSpreadOccurrence>
  > {
    return (
      this._getContents().fragmentSpreadsByName ??
      EMPTY_FRAGMENT_SPREADS_BY_NAME
    );
  }

  hasOverlappingFields(): boolean {
    return this._getContents().hasOverlappingFields ?? false;
  }

  private _getContents(): FieldSetContents {
    if (this._contents !== undefined) {
      return this._contents;
    }
    const contents: FieldSetContents = {};
    this._contents = contents;
    this._collectFields(this.selectionSet, this.parentType, contents);
    return contents;
  }

  private _collectFields(
    selectionSet: SelectionSetNode,
    parentType: Maybe<GraphQLNamedType>,
    contents: FieldSetContents,
  ): void {
    const validationContext = this._context.validationContext;
    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        this._addFragmentSpread(selection, contents);
        continue;
      }
      if (selection.kind === Kind.INLINE_FRAGMENT) {
        const type = selection.typeCondition
          ? typeFromAST(validationContext.getSchema(), selection.typeCondition)
          : parentType;
        this._collectFields(
          selection.selectionSet,
          isCompositeType(type) ? type : undefined,
          contents,
        );
        continue;
      }
      const field = new FieldOccurrence(
        validationContext,
        parentType,
        selection,
      );
      const responseName = field.node.alias?.value ?? field.node.name.value;
      const fieldGroups = (contents.fieldGroupsByResponseName ??= new Map());
      const fieldGroup = fieldGroups.get(responseName);
      if (fieldGroup === undefined) {
        fieldGroups.set(responseName, new FieldGroup([field]));
      } else {
        fieldGroup.addField(field);
        contents.hasOverlappingFields = true;
      }
    }
  }

  private _addFragmentSpread(
    node: FragmentSpreadNode,
    contents: FieldSetContents,
  ): void {
    const fragmentName = node.name.value;
    const fragmentDefinition =
      this._context.validationContext.getFragment(fragmentName);
    if (fragmentDefinition == null) {
      return;
    }
    (contents.fragmentSpreadsByName ??= new AccumulatorMap()).add(
      fragmentName,
      { node, fragmentDefinition },
    );
  }
}
