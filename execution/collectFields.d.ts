import { AccumulatorMap } from "../jsutils/AccumulatorMap.js";
import type { ObjMap, ReadOnlyObjMap } from "../jsutils/ObjMap.js";
import type { DirectiveNode, FieldNode, FragmentDefinitionNode, SelectionSetNode, ValueNode } from "../language/ast.js";
import type { GraphQLObjectType } from "../type/definition.js";
import type { GraphQLSchema } from "../type/schema.js";
import type { GraphQLVariableSignature } from "./getVariableSignature.js";
import type { VariableValues } from "./values.js";
/** @internal */
export interface DeferUsage {
    directiveNode: DirectiveNode;
    label: string | undefined;
    parentDeferUsage: DeferUsage | undefined;
}
/** @internal */
export interface FragmentVariableValues {
    readonly sources: ReadOnlyObjMap<FragmentVariableValueSource>;
    readonly coerced: ReadOnlyObjMap<unknown>;
}
/** @internal */
export interface FragmentVariableValueSource {
    readonly signature: GraphQLVariableSignature;
    readonly value?: ValueNode;
    readonly fragmentVariableValues?: FragmentVariableValues;
}
/** @internal */
export interface FieldDetails {
    node: FieldNode;
    deferUsage?: DeferUsage | undefined;
    fragmentVariableValues?: FragmentVariableValues | undefined;
}
/** @internal */
export type FieldDetailsList = ReadonlyArray<FieldDetails>;
/** @internal */
export type GroupedFieldSet = ReadonlyMap<string, FieldDetailsList>;
/** @internal */
export interface FragmentDetails {
    definition: FragmentDefinitionNode;
    variableSignatures?: ObjMap<GraphQLVariableSignature> | undefined;
}
type VisitedFragmentNames = Map<string, Set<DirectiveNode | null>>;
interface CollectFieldsContext {
    schema: GraphQLSchema;
    fragments: ObjMap<FragmentDetails>;
    variableValues: VariableValues;
    runtimeType: GraphQLObjectType;
    visitedFragmentNames: VisitedFragmentNames;
    hideSuggestions: boolean;
    forbiddenDirectiveInstances: Array<DirectiveNode>;
    forbidSkipAndInclude: boolean;
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
export declare function collectFields(schema: GraphQLSchema, fragments: ObjMap<FragmentDetails>, variableValues: VariableValues, runtimeType: GraphQLObjectType, selectionSet: SelectionSetNode, hideSuggestions: boolean, forbidSkipAndInclude?: boolean, visit?: typeof visitSelectionSets): {
    groupedFieldSet: GroupedFieldSet;
    newDeferUsages: ReadonlyArray<DeferUsage>;
    forbiddenDirectiveInstances: ReadonlyArray<DirectiveNode>;
};
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
export declare function collectSubfields(schema: GraphQLSchema, fragments: ObjMap<FragmentDetails>, variableValues: VariableValues, returnType: GraphQLObjectType, fieldDetailsList: FieldDetailsList, hideSuggestions: boolean): {
    groupedFieldSet: GroupedFieldSet;
    newDeferUsages: ReadonlyArray<DeferUsage>;
};
/** @internal */
export declare function visitSelectionSets(context: CollectFieldsContext, selectionSet: SelectionSetNode, groupedFieldSet: AccumulatorMap<string, FieldDetails>, newDeferUsages: Array<DeferUsage>, deferUsage?: DeferUsage, fragmentVariableValues?: FragmentVariableValues, recurse?: typeof visitSelectionSets): void;
export {};
