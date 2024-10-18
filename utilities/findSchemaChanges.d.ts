import type { GraphQLSchema } from '../type/schema.js';
declare enum BreakingChangeType {
    TYPE_REMOVED = "TYPE_REMOVED",
    TYPE_CHANGED_KIND = "TYPE_CHANGED_KIND",
    TYPE_REMOVED_FROM_UNION = "TYPE_REMOVED_FROM_UNION",
    VALUE_REMOVED_FROM_ENUM = "VALUE_REMOVED_FROM_ENUM",
    REQUIRED_INPUT_FIELD_ADDED = "REQUIRED_INPUT_FIELD_ADDED",
    IMPLEMENTED_INTERFACE_REMOVED = "IMPLEMENTED_INTERFACE_REMOVED",
    FIELD_REMOVED = "FIELD_REMOVED",
    FIELD_CHANGED_KIND = "FIELD_CHANGED_KIND",
    REQUIRED_ARG_ADDED = "REQUIRED_ARG_ADDED",
    ARG_REMOVED = "ARG_REMOVED",
    ARG_CHANGED_KIND = "ARG_CHANGED_KIND",
    DIRECTIVE_REMOVED = "DIRECTIVE_REMOVED",
    DIRECTIVE_ARG_REMOVED = "DIRECTIVE_ARG_REMOVED",
    REQUIRED_DIRECTIVE_ARG_ADDED = "REQUIRED_DIRECTIVE_ARG_ADDED",
    DIRECTIVE_REPEATABLE_REMOVED = "DIRECTIVE_REPEATABLE_REMOVED",
    DIRECTIVE_LOCATION_REMOVED = "DIRECTIVE_LOCATION_REMOVED"
}
export { BreakingChangeType };
declare enum DangerousChangeType {
    VALUE_ADDED_TO_ENUM = "VALUE_ADDED_TO_ENUM",
    TYPE_ADDED_TO_UNION = "TYPE_ADDED_TO_UNION",
    OPTIONAL_INPUT_FIELD_ADDED = "OPTIONAL_INPUT_FIELD_ADDED",
    OPTIONAL_ARG_ADDED = "OPTIONAL_ARG_ADDED",
    IMPLEMENTED_INTERFACE_ADDED = "IMPLEMENTED_INTERFACE_ADDED",
    ARG_DEFAULT_VALUE_CHANGE = "ARG_DEFAULT_VALUE_CHANGE"
}
export { DangerousChangeType };
declare enum SafeChangeType {
    TYPE_ADDED = "TYPE_ADDED",
    OPTIONAL_INPUT_FIELD_ADDED = "OPTIONAL_INPUT_FIELD_ADDED",
    OPTIONAL_ARG_ADDED = "OPTIONAL_ARG_ADDED",
    DIRECTIVE_ADDED = "DIRECTIVE_ADDED",
    FIELD_ADDED = "FIELD_ADDED",
    DIRECTIVE_REPEATABLE_ADDED = "DIRECTIVE_REPEATABLE_ADDED",
    DIRECTIVE_LOCATION_ADDED = "DIRECTIVE_LOCATION_ADDED",
    OPTIONAL_DIRECTIVE_ARG_ADDED = "OPTIONAL_DIRECTIVE_ARG_ADDED",
    FIELD_CHANGED_KIND_SAFE = "FIELD_CHANGED_KIND_SAFE",
    ARG_CHANGED_KIND_SAFE = "ARG_CHANGED_KIND_SAFE",
    ARG_DEFAULT_VALUE_ADDED = "ARG_DEFAULT_VALUE_ADDED"
}
export { SafeChangeType };
export interface BreakingChange {
    type: BreakingChangeType;
    description: string;
}
export interface DangerousChange {
    type: DangerousChangeType;
    description: string;
}
export interface SafeChange {
    type: SafeChangeType;
    description: string;
}
export type SchemaChange = SafeChange | DangerousChange | BreakingChange;
/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of breaking changes covered by the other functions down below.
 *
 * @deprecated Please use `findSchemaChanges` instead. Will be removed in v18.
 */
export declare function findBreakingChanges(oldSchema: GraphQLSchema, newSchema: GraphQLSchema): Array<BreakingChange>;
/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of potentially dangerous changes covered by the other functions down below.
 *
 * @deprecated Please use `findSchemaChanges` instead. Will be removed in v18.
 */
export declare function findDangerousChanges(oldSchema: GraphQLSchema, newSchema: GraphQLSchema): Array<DangerousChange>;
export declare function findSchemaChanges(oldSchema: GraphQLSchema, newSchema: GraphQLSchema): Array<SchemaChange>;
