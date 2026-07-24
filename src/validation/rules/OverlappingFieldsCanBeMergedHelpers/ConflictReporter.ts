import { inspect } from '../../../jsutils/inspect.ts';
import { SetMap } from '../../../jsutils/SetMap.ts';

import { GraphQLError } from '../../../error/GraphQLError.ts';

import type { FieldNode } from '../../../language/ast.ts';

import type { FieldOccurrence } from './FieldOccurrence.ts';

/**
 * A response-field path containing a child response-level check.
 * Each level retains every occurrence so an eventual conflict can select the
 * exact ancestors that contribute its fields.
 *
 * @internal
 */
export interface ContainingFieldPath {
  parent: ContainingFieldPath | undefined;
  responseName: string;
  fieldOccurrences: ReadonlyArray<FieldOccurrence>;
}

interface ResolvedContainingField {
  path: ContainingFieldPath;
  fields: readonly [FieldOccurrence, FieldOccurrence];
}

interface FieldConflict {
  responseName: string;
  reasons: Array<string>;
  nodesByBranch: readonly [Set<FieldNode>, Set<FieldNode>];
}

type ConflictKind = 'field call' | 'response shape' | 'stream';

interface ConflictReporterContext {
  reportError: (error: GraphQLError) => void;
}

interface FieldAncestry {
  fieldContainsDescendant: (
    containingField: FieldOccurrence,
    descendantField: FieldOccurrence,
  ) => boolean;
}

/**
 * Reports merge conflicts using their containing response fields to preserve
 * the rule's nested diagnostic format.
 *
 * @internal
 */
export class ConflictReporter {
  private _context: ConflictReporterContext;
  private _fieldAncestry: FieldAncestry;
  private _reportedConflicts:
    | SetMap<FieldNode | ConflictKind, true>
    | undefined;
  private _pendingConflicts:
    | WeakMap<ContainingFieldPath, FieldConflict>
    | undefined;

  constructor(context: ConflictReporterContext, fieldAncestry: FieldAncestry) {
    this._context = context;
    this._fieldAncestry = fieldAncestry;
  }

  reportResponseShapeConflict(
    responseName: string,
    fields: readonly [FieldOccurrence, FieldOccurrence],
    containingPath?: ContainingFieldPath,
  ): void {
    const [field1, field2] = fields;
    this._reportFieldConflict(
      'response shape',
      responseName,
      responseShapeConflictReason(field1, field2),
      fields,
      containingPath,
    );
  }

  reportStreamConflict(
    responseName: string,
    fields: readonly [FieldOccurrence, FieldOccurrence],
    containingPath?: ContainingFieldPath,
  ): void {
    const [streamedField, otherField] = fields;
    this._reportFieldConflict(
      'stream',
      responseName,
      streamConflictReason(streamedField, otherField),
      fields,
      containingPath,
    );
  }

  reportFieldCallConflict(
    responseName: string,
    fields: readonly [FieldOccurrence, FieldOccurrence],
    containingPath?: ContainingFieldPath,
  ): void {
    const [field1, field2] = fields;
    const reason =
      field1.node.name.value === field2.node.name.value
        ? 'they have differing arguments.'
        : `"${field1.node.name.value}" and ` +
          `"${field2.node.name.value}" are different fields.`;
    this._reportFieldConflict(
      'field call',
      responseName,
      reason,
      fields,
      containingPath,
    );
  }

  // A response level contributes to the path only when it has two distinct
  // field occurrences.
  extendContainingFieldPath(
    parent: ContainingFieldPath | undefined,
    responseName: string,
    fields: ReadonlyArray<FieldOccurrence>,
  ): ContainingFieldPath | undefined {
    if (!hasDistinctFieldNodes(fields)) {
      return parent;
    }
    return { parent, responseName, fieldOccurrences: fields };
  }

  // Reports conflicts collected beneath an outermost containing field.
  emitPendingConflict(outermostPath: ContainingFieldPath): void {
    const conflict = this._pendingConflicts?.get(outermostPath);
    this._pendingConflicts?.delete(outermostPath);
    if (conflict !== undefined && conflict.reasons.length !== 0) {
      this._emitFieldConflict(conflict);
    }
  }

  private _reportFieldConflict(
    conflictKind: ConflictKind,
    responseName: string,
    reason: string,
    fields: readonly [FieldOccurrence, FieldOccurrence],
    containingPath?: ContainingFieldPath,
  ): void {
    const [field1, field2] = fields;
    if (!this._shouldReport(field1.node, field2.node, conflictKind)) {
      return;
    }
    const containingFields = containingFieldPathToArray(containingPath);
    const fieldPath = resolveContainingFieldPath(
      containingFields,
      field1,
      field2,
      this._fieldAncestry,
    );
    const outermostPath = containingFields[0];
    const pendingConflict =
      outermostPath === undefined
        ? undefined
        : this._getOrCreatePendingConflict(outermostPath);
    let containingResponseName = responseName;
    let containingReason = reason;
    for (let i = fieldPath.length - 1; i >= 0; i--) {
      const containingField = fieldPath[i];
      containingReason =
        `subfields "${containingResponseName}" conflict because ` +
        containingReason;
      containingResponseName = containingField.path.responseName;
    }

    if (pendingConflict !== undefined) {
      const conflict: FieldConflict =
        fieldPath.length === containingFields.length
          ? pendingConflict
          : {
              responseName: containingResponseName,
              reasons: [],
              nodesByBranch: [new Set(), new Set()],
            };
      conflict.reasons.push(containingReason);
      for (const containingField of fieldPath) {
        conflict.nodesByBranch[0].add(containingField.fields[0].node);
        conflict.nodesByBranch[1].add(containingField.fields[1].node);
      }
      conflict.nodesByBranch[0].add(field1.node);
      conflict.nodesByBranch[1].add(field2.node);
      if (conflict !== pendingConflict) {
        this._emitFieldConflict(conflict);
      }
      return;
    }

    this._context.reportError(
      new GraphQLError(
        fieldConflictMessage(containingResponseName, containingReason),
        { nodes: [field1.node, field2.node] },
      ),
    );
  }

  private _shouldReport(
    node1: FieldNode,
    node2: FieldNode,
    conflictKind: ConflictKind,
  ): boolean {
    const identity = new Set<FieldNode | ConflictKind>([
      node1,
      node2,
      conflictKind,
    ]);
    const reportedConflicts = (this._reportedConflicts ??= new SetMap<
      FieldNode | ConflictKind,
      true
    >());
    const shouldReport = !reportedConflicts.has(identity);
    reportedConflicts.set(identity, true);
    return shouldReport;
  }

  private _getOrCreatePendingConflict(
    outermostPath: ContainingFieldPath,
  ): FieldConflict {
    const conflicts = (this._pendingConflicts ??= new WeakMap());
    let conflict = conflicts.get(outermostPath);
    if (conflict === undefined) {
      conflict = {
        responseName: outermostPath.responseName,
        reasons: [],
        nodesByBranch: [new Set(), new Set()],
      };
      conflicts.set(outermostPath, conflict);
    }
    return conflict;
  }

  private _emitFieldConflict(conflict: FieldConflict): void {
    const reasons: Array<string> = [];
    for (const [index, reason] of conflict.reasons.entries()) {
      reasons.push(
        index === conflict.reasons.length - 1 || !reason.endsWith('.')
          ? reason
          : reason.slice(0, -1),
      );
    }
    const message = fieldConflictMessage(
      conflict.responseName,
      reasons.join(' and '),
    );
    this._context.reportError(
      new GraphQLError(message, {
        nodes: [
          ...new Set([
            ...conflict.nodesByBranch[0],
            ...conflict.nodesByBranch[1],
          ]),
        ],
      }),
    );
  }
}

function responseShapeConflictReason(
  field1: FieldOccurrence,
  field2: FieldOccurrence,
): string {
  return (
    `they return conflicting types ` +
    `"${inspect(field1.getOutputType())}" and ` +
    `"${inspect(field2.getOutputType())}".`
  );
}

function streamConflictReason(
  field1: FieldOccurrence,
  field2: FieldOccurrence,
): string {
  const streamArgumentsKey = field1.getStreamArgumentsKey();
  return streamArgumentsKey !== undefined &&
    streamArgumentsKey === field2.getStreamArgumentsKey()
    ? 'they have overlapping stream directives. See https://github.com/graphql/defer-stream-wg/discussions/100.'
    : 'they have overlapping stream directives.';
}

function hasDistinctFieldNodes(
  fields: ReadonlyArray<FieldOccurrence>,
): boolean {
  const firstNode = fields[0]?.node;
  if (firstNode !== undefined) {
    for (const field of fields) {
      if (field.node !== firstNode) {
        return true;
      }
    }
  }
  return false;
}

function containingFieldPathToArray(
  containingPath: ContainingFieldPath | undefined,
): Array<ContainingFieldPath> {
  const containingFields: Array<ContainingFieldPath> = [];
  for (let path = containingPath; path !== undefined; path = path.parent) {
    containingFields.push(path);
  }
  containingFields.reverse();
  return containingFields;
}

function resolveContainingFieldPath(
  fieldPath: Array<ContainingFieldPath>,
  field1: FieldOccurrence,
  field2: FieldOccurrence,
  fieldAncestry: FieldAncestry,
): Array<ResolvedContainingField> {
  const resolvedPath: Array<ResolvedContainingField> = [];
  let descendantFields: readonly [FieldOccurrence, FieldOccurrence] = [
    field1,
    field2,
  ];
  for (let index = fieldPath.length - 1; index >= 0; --index) {
    const path = fieldPath[index];
    const fields = matchingContainingFieldPair(
      path.fieldOccurrences,
      descendantFields[0],
      descendantFields[1],
      fieldAncestry,
    );
    if (fields !== undefined) {
      resolvedPath.push({ path, fields });
      descendantFields = fields;
    }
  }
  resolvedPath.reverse();
  return resolvedPath;
}

function matchingContainingFieldPair(
  fields: ReadonlyArray<FieldOccurrence>,
  field1: FieldOccurrence,
  field2: FieldOccurrence,
  fieldAncestry: FieldAncestry,
): readonly [FieldOccurrence, FieldOccurrence] | undefined {
  // A containing level belongs to the reported path only when distinct fields
  // separate the two branches. A field that contains both descendants through
  // a shared fragment does not extend the conflict's ancestry.
  const containingFields1: Array<FieldOccurrence> = [];
  const containingFields2: Array<FieldOccurrence> = [];
  for (const field of fields) {
    const containsField1 = fieldContains(field, field1, fieldAncestry);
    const containsField2 = fieldContains(field, field2, fieldAncestry);
    if (containsField1 && !containsField2) {
      containingFields1.push(field);
    } else if (containsField2 && !containsField1) {
      containingFields2.push(field);
    }
  }
  for (const containingField1 of containingFields1) {
    for (const containingField2 of containingFields2) {
      if (containingField2.node !== containingField1.node) {
        return [containingField1, containingField2];
      }
    }
  }
}

function fieldContains(
  containingField: FieldOccurrence,
  field: FieldOccurrence,
  fieldAncestry: FieldAncestry,
): boolean {
  return (
    containsNode(containingField.node, field.node) ||
    fieldAncestry.fieldContainsDescendant(containingField, field)
  );
}

function fieldConflictMessage(responseName: string, reason: string): string {
  return (
    `Fields "${responseName}" conflict because ${reason}` +
    ' Use different aliases on the fields to fetch both if this was intentional.'
  );
}

function containsNode(container: FieldNode, node: FieldNode): boolean {
  return (
    container.loc !== undefined &&
    node.loc !== undefined &&
    container.loc.start <= node.loc.start &&
    node.loc.end <= container.loc.end
  );
}
