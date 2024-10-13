import type { ObjMap } from '../jsutils/ObjMap.js';

import type {
  DefinitionNode,
  DocumentNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';
import { visit } from '../language/visitor.js';

interface ReferencedFragmentDefinitionNode {
  totalReferences: number;
  fragment: FragmentDefinitionNode;
}

interface InlineFragmentToFragmentSpreadResult {
  fragmentSpread: FragmentSpreadNode;
  referencedFragmentDefinition: ReferencedFragmentDefinitionNode;
  isNewFragmentDefinition: boolean;
}
/**
 * Traverse a DocumentNode searching for inline fragments, created fragment definitions for those
 * and replace the inline fragment with fragment spreads.
 * The algorithm consists on:
 * 1. Traverse the AST.
 * 2. Search for InlineFragment nodes in SelectionSet nodes.
 * 3. Create a FragmentDefinition of the SelectionSet of that InlineFragments.
 * 4. Append that FragmentDefinition to the document AST.
 * 5. replace the InlineFragment in the SelectionSet with a FragmentSpread.
 */
export function fragmentifyDocument(
  document: DocumentNode,
  minSelectionsForFragment: number = 2,
  pruneSingleFragmentSpreads: boolean = false
): DocumentNode {
  const fragmentDefinitionsByType: ObjMap<ObjMap<ReferencedFragmentDefinitionNode>> = {};
  const fragmentDefinitionsByName: ObjMap<ReferencedFragmentDefinitionNode> = {};

  const getInlineFragmentSelections = (
    inlineFragment: InlineFragmentNode
  ): Array<string> => {
    const selectionSetsToVisit: Array<SelectionSetNode> = [inlineFragment.selectionSet];
    const names: Array<string> = [];
    let selectionSet: SelectionSetNode | undefined;
    while ((selectionSet = selectionSetsToVisit.pop())) {
      for (const selection of selectionSet.selections) {
        if ((selection.kind === Kind.FIELD || selection.kind === Kind.INLINE_FRAGMENT) && selection.selectionSet) {
          selectionSetsToVisit.push(selection.selectionSet);
        } else if (selection.kind === Kind.FIELD) {
          names.push(selection.alias?.value ?? selection.name.value);
        } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
          names.push(selection.name.value);
        }
      }
    }
    return names;
  }

  const inlineFragmentToFragmentSpread = (
    inlineFragment: InlineFragmentNode
  ): InlineFragmentToFragmentSpreadResult | undefined => {
    // We are only interested in inline fragments with TypeCondition
    // example: ...on User { }
    // Constrain #1
    // inline fragments without TypeCondition: ...friendFields 
    // are going to be skipped as we would need the schema to know which type this fragment is applied to.
    if (!inlineFragment.typeCondition) {
      return undefined;
    }
    // Constrain #2
    // we are not going to attempt to create fragment definitions for inline fragments with directives
    // ... @include(if: $shouldInclude)
    if (inlineFragment.directives && inlineFragment.directives.length > 0) {
      return undefined;
    }
    // Constrain #3
    // we are not going to attempt to create as fragment definition fo for inline fragments with less than [minSelectionsForFragment]
    const inlineFragmentSelections = getInlineFragmentSelections(inlineFragment);
    if (inlineFragmentSelections.length < minSelectionsForFragment) {
      return undefined;
    }

    const inlineFragmentTypeName = inlineFragment.typeCondition.name.value;
    const fragmentIdentifier = inlineFragmentSelections.join(',');

    if (fragmentDefinitionsByType[inlineFragmentTypeName] === undefined) {
      fragmentDefinitionsByType[inlineFragmentTypeName] = {};
    }

    let isNewFragmentDefinition = false;
    if (fragmentDefinitionsByType[inlineFragmentTypeName][fragmentIdentifier] === undefined) {
      const totalFragmentsForType = Object.keys(fragmentDefinitionsByType[inlineFragmentTypeName]).length + 1;
      const fragmentNameWithVersion = `${inlineFragmentTypeName}Fv${totalFragmentsForType}`;
      const fragmentDefinitionNode: FragmentDefinitionNode = {
        kind: Kind.FRAGMENT_DEFINITION,
        name: { kind: Kind.NAME, value: fragmentNameWithVersion },
        typeCondition: {
          kind: Kind.NAMED_TYPE,
          name: { kind: Kind.NAME, value: inlineFragmentTypeName }
        },
        selectionSet: inlineFragment.selectionSet,
      };
      fragmentDefinitionsByType[inlineFragmentTypeName][fragmentIdentifier] = {
        totalReferences: 0,
        fragment: fragmentDefinitionNode
      };
      isNewFragmentDefinition = true;
    }

    fragmentDefinitionsByType[inlineFragmentTypeName][fragmentIdentifier].totalReferences++;
    return {
      fragmentSpread: {
        kind: Kind.FRAGMENT_SPREAD,
        name: {
          kind: Kind.NAME,
          value: fragmentDefinitionsByType[inlineFragmentTypeName][fragmentIdentifier].fragment.name.value
        }
      },
      referencedFragmentDefinition: fragmentDefinitionsByType[inlineFragmentTypeName][fragmentIdentifier],
      isNewFragmentDefinition
    }
  }

  const newDocument = visit(document, {
    InlineFragment(inlineFragment: InlineFragmentNode): InlineFragmentNode | FragmentSpreadNode {
      const result = inlineFragmentToFragmentSpread(inlineFragment);
      if (result) {
        if (result.isNewFragmentDefinition) {
          fragmentDefinitionsByName[result.referencedFragmentDefinition.fragment.name.value] = result.referencedFragmentDefinition;
          (document.definitions as any).push(result.referencedFragmentDefinition.fragment);
        }
        return result.fragmentSpread;
      }
      return inlineFragment
    }
  });

  if (!pruneSingleFragmentSpreads) {
    return newDocument;
  }

  /**
   * visiting AST for the first time could create fragments that are referenced only once
   * to take fully advantage of fragment spreads we would need a fragment referenced more than once
   * we need a second visit looking for fragments referenced only once and replace them with inlineFragments
   */
  const prunedNewDocument = visit(newDocument, {
    FragmentSpread(fragmentSpread: FragmentSpreadNode): InlineFragmentNode | undefined {
      if (fragmentDefinitionsByName[fragmentSpread.name.value] === undefined) {
        return undefined;
      }

      if (fragmentDefinitionsByName[fragmentSpread.name.value].totalReferences < 2) {
        const fragmentIndexToRemove = newDocument.definitions.findIndex((definitionNode: DefinitionNode) =>
          definitionNode.kind === Kind.FRAGMENT_DEFINITION && definitionNode.name.value === fragmentSpread.name.value
        );
        if (fragmentIndexToRemove > -1) {
          (newDocument.definitions as any).splice(fragmentIndexToRemove, 1);
        }
        return {
          kind: Kind.INLINE_FRAGMENT,
          typeCondition: fragmentDefinitionsByName[fragmentSpread.name.value].fragment.typeCondition,
          selectionSet: fragmentDefinitionsByName[fragmentSpread.name.value].fragment.selectionSet
        }
      }
      return undefined;
    }
  });
  return prunedNewDocument;
}
