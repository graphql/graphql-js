import type { GraphQLSchema } from '../type/schema.js';
export declare const BreakingChangeType: {
    readonly TYPE_REMOVED: "TYPE_REMOVED";
    readonly TYPE_CHANGED_KIND: "TYPE_CHANGED_KIND";
    readonly TYPE_REMOVED_FROM_UNION: "TYPE_REMOVED_FROM_UNION";
    readonly VALUE_REMOVED_FROM_ENUM: "VALUE_REMOVED_FROM_ENUM";
    readonly REQUIRED_INPUT_FIELD_ADDED: "REQUIRED_INPUT_FIELD_ADDED";
    readonly IMPLEMENTED_INTERFACE_REMOVED: "IMPLEMENTED_INTERFACE_REMOVED";
    readonly FIELD_REMOVED: "FIELD_REMOVED";
    readonly FIELD_CHANGED_KIND: "FIELD_CHANGED_KIND";
    readonly REQUIRED_ARG_ADDED: "REQUIRED_ARG_ADDED";
    readonly ARG_REMOVED: "ARG_REMOVED";
    readonly ARG_CHANGED_KIND: "ARG_CHANGED_KIND";
    readonly DIRECTIVE_REMOVED: "DIRECTIVE_REMOVED";
    readonly DIRECTIVE_ARG_REMOVED: "DIRECTIVE_ARG_REMOVED";
    readonly REQUIRED_DIRECTIVE_ARG_ADDED: "REQUIRED_DIRECTIVE_ARG_ADDED";
    readonly DIRECTIVE_REPEATABLE_REMOVED: "DIRECTIVE_REPEATABLE_REMOVED";
    readonly DIRECTIVE_LOCATION_REMOVED: "DIRECTIVE_LOCATION_REMOVED";
};
export type BreakingChangeType = (typeof BreakingChangeType)[keyof typeof BreakingChangeType];
export declare const DangerousChangeType: {
    VALUE_ADDED_TO_ENUM: "VALUE_ADDED_TO_ENUM";
    TYPE_ADDED_TO_UNION: "TYPE_ADDED_TO_UNION";
    OPTIONAL_INPUT_FIELD_ADDED: "OPTIONAL_INPUT_FIELD_ADDED";
    OPTIONAL_ARG_ADDED: "OPTIONAL_ARG_ADDED";
    IMPLEMENTED_INTERFACE_ADDED: "IMPLEMENTED_INTERFACE_ADDED";
    ARG_DEFAULT_VALUE_CHANGE: "ARG_DEFAULT_VALUE_CHANGE";
};
export type DangerousChangeType = (typeof DangerousChangeType)[keyof typeof DangerousChangeType];
export declare const SafeChangeType: {
    TYPE_ADDED: "TYPE_ADDED";
    OPTIONAL_INPUT_FIELD_ADDED: "OPTIONAL_INPUT_FIELD_ADDED";
    OPTIONAL_ARG_ADDED: "OPTIONAL_ARG_ADDED";
    DIRECTIVE_ADDED: "DIRECTIVE_ADDED";
    FIELD_ADDED: "FIELD_ADDED";
    DIRECTIVE_REPEATABLE_ADDED: "DIRECTIVE_REPEATABLE_ADDED";
    DIRECTIVE_LOCATION_ADDED: "DIRECTIVE_LOCATION_ADDED";
    OPTIONAL_DIRECTIVE_ARG_ADDED: "OPTIONAL_DIRECTIVE_ARG_ADDED";
    FIELD_CHANGED_KIND_SAFE: "FIELD_CHANGED_KIND_SAFE";
    ARG_CHANGED_KIND_SAFE: "ARG_CHANGED_KIND_SAFE";
    ARG_DEFAULT_VALUE_ADDED: "ARG_DEFAULT_VALUE_ADDED";
};
export type SafeChangeType = (typeof SafeChangeType)[keyof typeof SafeChangeType];
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
