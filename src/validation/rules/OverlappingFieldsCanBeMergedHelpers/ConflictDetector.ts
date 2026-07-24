import { AccumulatorMap } from '../../../jsutils/AccumulatorMap.ts';
import { invariant } from '../../../jsutils/invariant.ts';

import type { FragmentDefinitionNode } from '../../../language/ast.ts';
import type { ASTVisitor } from '../../../language/visitor.ts';

import type { ValidationContext } from '../../ValidationContext.ts';

import { commonParentFieldGroups } from './commonParentFieldGroups.ts';
import type { ContainingFieldPath } from './ConflictReporter.ts';
import { ConflictReporter } from './ConflictReporter.ts';
import { doTypesConflict } from './doTypesConflict.ts';
import type { EffectiveFieldSet } from './EffectiveFieldSet.ts';
import type { FieldGroup } from './FieldGroup.ts';
import type { FieldOccurrence } from './FieldOccurrence.ts';
import type { FieldSet, FragmentSpreadOccurrence } from './FieldSet.ts';
import { FieldSetGraph } from './FieldSetGraph.ts';
import { FieldSetProofCache } from './FieldSetProofCache.ts';
import { FieldSetValidationOrder } from './FieldSetValidationOrder.ts';

interface ResponseLevel {
  effectiveFieldSet: EffectiveFieldSet;
  containingPath: ContainingFieldPath | undefined;
}

interface ValidationWorkContext {
  addValidationWork: (work: number) => void;
}

const FIELD_GROUP_WORK = 2_000;
const FIELD_OCCURRENCE_WORK = 2_000;
const COMPARISON_WORK = 2_000;
const CONFLICT_WORK = 2_000;

/**
 * Checks whether fields that may contribute to the same response object can
 * be merged.
 *
 * **FieldSet** The fields and named fragment spreads contributed by one
 * selection set. Inline fragments belong to the enclosing FieldSet; named
 * fragment bodies have separate FieldSets.
 *
 * **FieldOccurrence** One selected field together with the type and variable
 * scope in which it occurs.
 *
 * **FieldGroup** The occurrences with one response name contributed by one
 * FieldSet.
 *
 * **EffectiveFieldSet** The FieldSets where a response-level check starts,
 * together with every named fragment body reachable from them.
 *
 * **Response-shape proof** Checks fields with the same response name for
 * compatible output shapes and stream directives.
 *
 * **Common-parent proof** Checks fields that may execute for the same concrete
 * object for compatible field names and arguments.
 *
 * **Fragment-argument check** Checks invocations of the same named fragment
 * for compatible arguments. Unlike the two proofs, it compares fragment
 * spreads rather than field occurrences.
 *
 * The document visitor records FieldSets and their fragment relationships.
 * Validation checks operation FieldSets and every fragment definition they
 * reach, then checks the remaining fragment graphs source-first. Each proof
 * also checks the child selection sets of every field group it compares.
 *
 * @internal
 */
export class ConflictDetector {
  private _context: ValidationContext;
  private _fieldSetGraph: FieldSetGraph;
  private _validationOrder: FieldSetValidationOrder;
  private _proofCache: FieldSetProofCache | undefined;
  private _reporter: ConflictReporter | undefined;

  constructor(context: ValidationContext) {
    this._context = context;
    this._fieldSetGraph = new FieldSetGraph(context);
    this._validationOrder = new FieldSetValidationOrder();
  }

  getVisitor(): ASTVisitor {
    return this._fieldSetGraph.getVisitor(
      (fieldSet, definition) => this._validationOrder.add(fieldSet, definition),
      () => {
        const operationReachableFragments = new Set<FragmentDefinitionNode>();
        this._checkOperationReachableFieldSets(
          this._validationOrder.getOperationFieldSets(),
          operationReachableFragments,
        );
        for (const fieldSet of this._validationOrder.fragmentFieldSetsToCheck(
          operationReachableFragments,
        )) {
          this._checkFieldSet(fieldSet);
        }
      },
    );
  }

  private _checkOperationReachableFieldSets(
    fieldSets: ReadonlyArray<FieldSet>,
    operationReachableFragments: Set<FragmentDefinitionNode>,
  ): void {
    for (const fieldSet of fieldSets) {
      this._checkFieldSet(fieldSet);
      for (const spreads of fieldSet.getFragmentSpreadsByName().values()) {
        const fragmentDefinition = spreads[0].fragmentDefinition;
        if (operationReachableFragments.has(fragmentDefinition)) {
          continue;
        }
        const fragmentFieldSets =
          this._validationOrder.getFragmentFieldSets(fragmentDefinition);
        invariant(fragmentFieldSets !== undefined);
        operationReachableFragments.add(fragmentDefinition);
        this._checkOperationReachableFieldSets(
          fragmentFieldSets,
          operationReachableFragments,
        );
      }
    }
  }

  private _checkFieldSet(startingFieldSet: FieldSet): void {
    const fragmentSpreads = startingFieldSet.getFragmentSpreadsByName();
    // Named fragment spreads are the only non-local members of an effective
    // field set; inline fragments are already folded into this FieldSet. With
    // neither a local overlap nor a spread, no other fields can join the check.
    if (
      !startingFieldSet.hasOverlappingFields() &&
      fragmentSpreads.size === 0
    ) {
      return;
    }
    const effectiveFieldSet = this._fieldSetGraph.getEffectiveFieldSet(
      new Set([startingFieldSet]),
    );
    const responseLevel: ResponseLevel = {
      effectiveFieldSet,
      containingPath: undefined,
    };
    this._checkFragmentArgumentsAtResponseLevel(responseLevel);
    this._checkResponseShapeAtLevel(responseLevel);
    this._checkFieldsForCommonParentsAtLevel(responseLevel);
  }

  private _checkFragmentArguments(fieldSets: ReadonlySet<FieldSet>): void {
    const spreadsByName = new AccumulatorMap<
      string,
      FragmentSpreadOccurrence
    >();
    for (const fieldSet of fieldSets) {
      for (const [
        fragmentName,
        spreads,
      ] of fieldSet.getFragmentSpreadsByName()) {
        for (const spread of spreads) {
          spreadsByName.add(fragmentName, spread);
        }
      }
    }

    for (const spreads of spreadsByName.values()) {
      for (const conflictingSpreads of conflictingPairs(
        spreads,
        (first, second) => first.argumentsKey !== second.argumentsKey,
        this._context,
      )) {
        this._getReporter().reportFragmentArgumentConflict([
          conflictingSpreads[0].node,
          conflictingSpreads[1].node,
        ]);
      }
    }
  }

  private _checkResponseShapeAtLevel(responseLevel: ResponseLevel): void {
    const overlappingFieldGroupsByResponseName =
      responseLevel.effectiveFieldSet.getOverlappingFieldGroupsByResponseName();
    if (
      overlappingFieldGroupsByResponseName.size === 0 ||
      !this._getProofCache().shouldCheckResponseShape(
        responseLevel.effectiveFieldSet,
      )
    ) {
      return;
    }
    for (const [
      responseName,
      fieldGroups,
    ] of overlappingFieldGroupsByResponseName) {
      const fields = this._checkResponseConflicts(
        responseName,
        fieldGroups,
        responseLevel.containingPath,
      );
      const subfieldResponseLevel = this._getSubfieldResponseLevel(
        responseName,
        fields,
        responseLevel.containingPath,
      );
      if (subfieldResponseLevel !== undefined) {
        this._checkFragmentArgumentsAtResponseLevel(subfieldResponseLevel);
        this._checkResponseShapeAtLevel(subfieldResponseLevel);
        const { containingPath } = subfieldResponseLevel;
        if (
          containingPath !== undefined &&
          containingPath.parent === undefined
        ) {
          this._getReporter().emitPendingConflict(containingPath);
        }
      }
    }
  }

  private _checkFragmentArgumentsAtResponseLevel(
    responseLevel: ResponseLevel,
  ): void {
    if (!this._fieldSetGraph.usesFragmentArguments()) {
      return;
    }
    this._checkFragmentArguments(
      responseLevel.effectiveFieldSet.getFieldSets(),
    );
  }

  private _checkResponseConflicts(
    responseName: string,
    fieldGroups: ReadonlyArray<FieldGroup>,
    containingPath: ContainingFieldPath | undefined,
  ): ReadonlyArray<FieldOccurrence> {
    this._context.addValidationWork(FIELD_GROUP_WORK * fieldGroups.length);
    const fields: Array<FieldOccurrence> = [];
    for (const fieldGroup of fieldGroups) {
      for (const field of fieldGroup.getFields()) {
        fields.push(field);
      }
    }
    this._context.addValidationWork(FIELD_OCCURRENCE_WORK * fields.length);

    for (const conflictingFields of streamConflicts(fields, this._context)) {
      this._getReporter().reportStreamConflict(
        responseName,
        conflictingFields,
        containingPath,
      );
    }

    // An unknown output type is compatible with every known shape, so it
    // cannot serve as the canonical member of a compatibility class.
    for (const conflictingFields of conflictingPairs(
      fields,
      (field1, field2) => {
        const outputType1 = field1.getOutputType();
        const outputType2 = field2.getOutputType();
        return (
          outputType1 !== undefined &&
          outputType2 !== undefined &&
          doTypesConflict(outputType1, outputType2)
        );
      },
      this._context,
      (field) => field.getOutputType() !== undefined,
    )) {
      this._getReporter().reportResponseShapeConflict(
        responseName,
        conflictingFields,
        containingPath,
      );
    }
    return fields;
  }

  private _checkFieldsForCommonParentsAtLevel(
    responseLevel: ResponseLevel,
  ): void {
    const overlappingFieldGroupsByResponseName =
      responseLevel.effectiveFieldSet.getOverlappingFieldGroupsByResponseName();
    if (
      overlappingFieldGroupsByResponseName.size === 0 ||
      !this._getProofCache().shouldCheckCommonParents(
        responseLevel.effectiveFieldSet,
      )
    ) {
      return;
    }
    for (const [
      responseName,
      fieldGroups,
    ] of overlappingFieldGroupsByResponseName) {
      let fieldCount = 0;
      for (const fieldGroup of fieldGroups) {
        fieldCount += fieldGroup.getFields().length;
      }
      this._context.addValidationWork(
        FIELD_GROUP_WORK * fieldGroups.length +
          FIELD_OCCURRENCE_WORK * fieldCount,
      );
      for (const fields of commonParentFieldGroups(fieldGroups)) {
        this._checkFieldsForCommonParent(
          responseName,
          fields,
          responseLevel.containingPath,
        );
      }
    }
  }

  private _checkFieldsForCommonParent(
    responseName: string,
    fields: ReadonlyArray<FieldOccurrence>,
    containingPath: ContainingFieldPath | undefined,
  ): void {
    for (const conflictingFields of conflictingPairs(
      fields,
      (first, second) => !fieldsHaveSameCall(first, second),
      this._context,
    )) {
      this._getReporter().reportFieldCallConflict(
        responseName,
        conflictingFields,
        containingPath,
      );
    }
    const subfieldResponseLevel = this._getSubfieldResponseLevel(
      responseName,
      fields,
      containingPath,
    );
    if (subfieldResponseLevel !== undefined) {
      const { containingPath: childPath } = subfieldResponseLevel;
      this._checkFieldsForCommonParentsAtLevel(subfieldResponseLevel);
      if (childPath !== undefined && childPath.parent === undefined) {
        this._getReporter().emitPendingConflict(childPath);
      }
    }
  }

  private _getSubfieldResponseLevel(
    responseName: string,
    fields: ReadonlyArray<FieldOccurrence>,
    parentPath: ContainingFieldPath | undefined,
  ): ResponseLevel | undefined {
    const startingFieldSets = this._fieldSetGraph.getSubfieldFieldSets(fields);
    if (startingFieldSets.size === 0) {
      return;
    }
    const effectiveFieldSet =
      this._fieldSetGraph.getEffectiveFieldSet(startingFieldSets);
    const containingPath = this._getReporter().extendContainingFieldPath(
      parentPath,
      responseName,
      fields,
    );
    return { effectiveFieldSet, containingPath };
  }

  private _getReporter(): ConflictReporter {
    return (this._reporter ??= new ConflictReporter(
      this._context,
      this._fieldSetGraph,
    ));
  }

  private _getProofCache(): FieldSetProofCache {
    return (this._proofCache ??= new FieldSetProofCache());
  }
}

// Groups occurrences into non-conflicting equivalence classes and yields every
// cross-class pair.
function* conflictingPairs<T>(
  occurrences: ReadonlyArray<T>,
  conflicts: (occurrence1: T, occurrence2: T) => boolean,
  context: ValidationWorkContext,
  shouldCompare?: (occurrence: T) => boolean,
): IterableIterator<readonly [T, T]> {
  const groups: Array<{ canonical: T; occurrences: Array<T> }> = [];
  for (const occurrence of occurrences) {
    if (shouldCompare?.(occurrence) === false) {
      continue;
    }
    let matchingGroup: { canonical: T; occurrences: Array<T> } | undefined;
    context.addValidationWork(COMPARISON_WORK * groups.length);
    for (const group of groups) {
      if (conflicts(group.canonical, occurrence)) {
        context.addValidationWork(CONFLICT_WORK * group.occurrences.length);
        for (const conflictingOccurrence of group.occurrences) {
          yield [conflictingOccurrence, occurrence];
        }
      } else {
        matchingGroup = group;
      }
    }
    if (matchingGroup === undefined) {
      groups.push({ canonical: occurrence, occurrences: [occurrence] });
    } else {
      matchingGroup.occurrences.push(occurrence);
    }
  }
}

// Yields each field pair with at least one streamed field exactly once.
function* streamConflicts(
  fields: ReadonlyArray<FieldOccurrence>,
  context: ValidationWorkContext,
): IterableIterator<readonly [FieldOccurrence, FieldOccurrence]> {
  const previousFields: Array<FieldOccurrence> = [];
  const streamedFields: Array<FieldOccurrence> = [];
  for (const field of fields) {
    const streamArgumentsKey = field.getStreamArgumentsKey();
    const conflictingFields =
      streamArgumentsKey === undefined ? streamedFields : previousFields;
    context.addValidationWork(CONFLICT_WORK * conflictingFields.length);
    for (const conflictingField of conflictingFields) {
      yield [conflictingField, field];
    }
    previousFields.push(field);
    if (streamArgumentsKey !== undefined) {
      streamedFields.push(field);
    }
  }
}

function fieldsHaveSameCall(
  field1: FieldOccurrence,
  field2: FieldOccurrence,
): boolean {
  return (
    field1.node.name.value === field2.node.name.value &&
    field1.getArgumentsKey() === field2.getArgumentsKey()
  );
}
