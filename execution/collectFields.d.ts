import type { ObjMap, ReadOnlyObjMap } from '../jsutils/ObjMap.js';
import type { ConstValueNode, DirectiveNode, FieldNode, FragmentDefinitionNode, SelectionSetNode } from '../language/ast.js';
import type { GraphQLObjectType } from '../type/definition.js';
import type { GraphQLSchema } from '../type/schema.js';
import type { GraphQLVariableSignature } from './getVariableSignature.js';
import type { VariableValues } from './values.js';
export interface DeferUsage {
    label: string | undefined;
    parentDeferUsage: DeferUsage | undefined;
}
export interface FragmentVariableValues {
    readonly sources: ReadOnlyObjMap<FragmentVariableValueSource>;
    readonly coerced: ReadOnlyObjMap<unknown>;
}
interface FragmentVariableValueSource {
    readonly signature: GraphQLVariableSignature;
    readonly value?: ConstValueNode;
    readonly fragmentVariableValues?: FragmentVariableValues;
}
export interface FieldDetails {
    node: FieldNode;
    deferUsage?: DeferUsage | undefined;
    fragmentVariableValues?: FragmentVariableValues | undefined;
}
export type FieldDetailsList = ReadonlyArray<FieldDetails>;
export type GroupedFieldSet = ReadonlyMap<string, FieldDetailsList>;
export interface FragmentDetails {
    definition: FragmentDefinitionNode;
    variableSignatures?: ObjMap<GraphQLVariableSignature> | undefined;
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
export declare function collectFields(schema: GraphQLSchema, fragments: ObjMap<FragmentDetails>, variableValues: VariableValues, runtimeType: GraphQLObjectType, selectionSet: SelectionSetNode, hideSuggestions: boolean, forbidSkipAndInclude?: boolean): {
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
export {};
