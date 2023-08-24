import type { ObjMap } from '../jsutils/ObjMap.js';
import type {
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast.js';
import type { GraphQLObjectType } from '../type/definition.js';
import type { GraphQLSchema } from '../type/schema.js';
export interface DeferUsage {
  label: string | undefined;
  ancestors: ReadonlyArray<Target>;
}
export declare const NON_DEFERRED_TARGET_SET: TargetSet;
export type Target = DeferUsage | undefined;
export type TargetSet = ReadonlySet<Target>;
export type DeferUsageSet = ReadonlySet<DeferUsage>;
export interface FieldDetails {
  node: FieldNode;
  target: Target;
}
export interface FieldGroup {
  fields: ReadonlyArray<FieldDetails>;
  targets: TargetSet;
}
export type GroupedFieldSet = Map<string, FieldGroup>;
export interface GroupedFieldSetDetails {
  groupedFieldSet: GroupedFieldSet;
  shouldInitiateDefer: boolean;
}
export interface CollectFieldsResult {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSetDetails: Map<DeferUsageSet, GroupedFieldSetDetails>;
  newDeferUsages: ReadonlyArray<DeferUsage>;
}
/**
 * Given a selectionSet, collects all of the fields and returns them.
 *
 * CollectFields requires the "runtime type" of an object. For a field that
 * returns an Interface or Union type, the "runtime type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
export declare function collectFields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: {
    [variable: string]: unknown;
  },
  runtimeType: GraphQLObjectType,
  operation: OperationDefinitionNode,
): CollectFieldsResult;
/**
 * Given an array of field nodes, collects all of the subfields of the passed
 * in fields, and returns them at the end.
 *
 * CollectSubFields requires the "return type" of an object. For a field that
 * returns an Interface or Union type, the "return type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
export declare function collectSubfields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: {
    [variable: string]: unknown;
  },
  operation: OperationDefinitionNode,
  returnType: GraphQLObjectType,
  fieldGroup: FieldGroup,
): CollectFieldsResult;
