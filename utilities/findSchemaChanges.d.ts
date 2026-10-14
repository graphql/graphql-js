/** @category Schema Changes */
import type { GraphQLSchema } from "../type/schema.js";
/** Categories of schema changes that may break existing operations. */
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
/** Categories of schema changes that may break existing operations. */
export type BreakingChangeType = (typeof BreakingChangeType)[keyof typeof BreakingChangeType];
/** Categories of schema changes that may be dangerous for existing operations. */
export declare const DangerousChangeType: {
    readonly VALUE_ADDED_TO_ENUM: "VALUE_ADDED_TO_ENUM";
    readonly TYPE_ADDED_TO_UNION: "TYPE_ADDED_TO_UNION";
    readonly OPTIONAL_INPUT_FIELD_ADDED: "OPTIONAL_INPUT_FIELD_ADDED";
    readonly OPTIONAL_ARG_ADDED: "OPTIONAL_ARG_ADDED";
    readonly IMPLEMENTED_INTERFACE_ADDED: "IMPLEMENTED_INTERFACE_ADDED";
    readonly ARG_DEFAULT_VALUE_CHANGE: "ARG_DEFAULT_VALUE_CHANGE";
    readonly INPUT_FIELD_DEFAULT_VALUE_CHANGE: "INPUT_FIELD_DEFAULT_VALUE_CHANGE";
};
/** Categories of schema changes that may be dangerous for existing operations. */
export type DangerousChangeType = (typeof DangerousChangeType)[keyof typeof DangerousChangeType];
/** Categories of schema changes that are considered safe for existing operations. */
export declare const SafeChangeType: {
    readonly DESCRIPTION_CHANGED: "DESCRIPTION_CHANGED";
    readonly TYPE_ADDED: "TYPE_ADDED";
    readonly OPTIONAL_INPUT_FIELD_ADDED: "OPTIONAL_INPUT_FIELD_ADDED";
    readonly OPTIONAL_ARG_ADDED: "OPTIONAL_ARG_ADDED";
    readonly DIRECTIVE_ADDED: "DIRECTIVE_ADDED";
    readonly FIELD_ADDED: "FIELD_ADDED";
    readonly DIRECTIVE_REPEATABLE_ADDED: "DIRECTIVE_REPEATABLE_ADDED";
    readonly DIRECTIVE_LOCATION_ADDED: "DIRECTIVE_LOCATION_ADDED";
    readonly OPTIONAL_DIRECTIVE_ARG_ADDED: "OPTIONAL_DIRECTIVE_ARG_ADDED";
    readonly FIELD_CHANGED_KIND_SAFE: "FIELD_CHANGED_KIND_SAFE";
    readonly ARG_CHANGED_KIND_SAFE: "ARG_CHANGED_KIND_SAFE";
    readonly ARG_DEFAULT_VALUE_ADDED: "ARG_DEFAULT_VALUE_ADDED";
    readonly INPUT_FIELD_DEFAULT_VALUE_ADDED: "INPUT_FIELD_DEFAULT_VALUE_ADDED";
};
/** Categories of schema changes that are considered safe for existing operations. */
export type SafeChangeType = (typeof SafeChangeType)[keyof typeof SafeChangeType];
/** Description of a schema change that may break existing operations. */
export interface BreakingChange {
    /** Specific kind of breaking schema change. */
    type: BreakingChangeType;
    /** Human-readable description of the breaking schema change. */
    description: string;
}
/** Description of a schema change that may be dangerous for existing operations. */
export interface DangerousChange {
    /** Specific kind of dangerous schema change. */
    type: DangerousChangeType;
    /** Human-readable description of the dangerous schema change. */
    description: string;
}
/** Description of a schema change that is considered safe for existing operations. */
export interface SafeChange {
    /** Specific kind of safe schema change. */
    type: SafeChangeType;
    /** Human-readable description of the safe schema change. */
    description: string;
}
/** Any schema change detected between two schemas. */
export type SchemaChange = SafeChange | DangerousChange | BreakingChange;
/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of breaking changes covered by the other functions down below. This
 * deprecated wrapper will be removed in v18; use `findSchemaChanges()` instead
 * and filter for breaking changes.
 * @param oldSchema - Schema before the change.
 * @param newSchema - Schema after the change.
 * @returns Breaking changes between the two schemas.
 * @example
 * ```ts
 * import { buildSchema, findBreakingChanges } from 'graphql/utilities';
 *
 * const oldSchema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const newSchema = buildSchema(`
 *   type Query {
 *     hello: String
 *   }
 * `);
 *
 * const changes = findBreakingChanges(oldSchema, newSchema);
 *
 * changes.map((change) => change.type); // => ['FIELD_REMOVED']
 * ```
 * @deprecated Please use `findSchemaChanges` instead. Will be removed in v18.
 */
export declare function findBreakingChanges(oldSchema: GraphQLSchema, newSchema: GraphQLSchema): Array<BreakingChange>;
/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of potentially dangerous changes covered by the other functions down below.
 * This deprecated wrapper will be removed in v18; use `findSchemaChanges()`
 * instead and filter for dangerous changes.
 * @param oldSchema - Schema before the change.
 * @param newSchema - Schema after the change.
 * @returns Dangerous changes between the two schemas.
 * @example
 * ```ts
 * import { buildSchema, findDangerousChanges } from 'graphql/utilities';
 *
 * const oldSchema = buildSchema(`
 *   enum Episode {
 *     NEW_HOPE
 *   }
 *
 *   type Query {
 *     episode: Episode
 *   }
 * `);
 * const newSchema = buildSchema(`
 *   enum Episode {
 *     NEW_HOPE
 *     EMPIRE
 *   }
 *
 *   type Query {
 *     episode: Episode
 *   }
 * `);
 *
 * const changes = findDangerousChanges(oldSchema, newSchema);
 *
 * changes.map((change) => change.type); // => ['VALUE_ADDED_TO_ENUM']
 * ```
 * @deprecated Please use `findSchemaChanges` instead. Will be removed in v18.
 */
export declare function findDangerousChanges(oldSchema: GraphQLSchema, newSchema: GraphQLSchema): Array<DangerousChange>;
/**
 * Finds all schema changes between two schemas.
 * @param oldSchema - Schema before the change.
 * @param newSchema - Schema after the change.
 * @returns Safe, dangerous, and breaking changes between the two schemas.
 * @example
 * ```ts
 * import { buildSchema, findSchemaChanges } from 'graphql/utilities';
 *
 * const oldSchema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const newSchema = buildSchema(`
 *   type Query {
 *     greeting(name: String): String
 *     farewell: String
 *   }
 * `);
 *
 * const changes = findSchemaChanges(oldSchema, newSchema);
 *
 * changes.map((change) => change.type); // => ['FIELD_ADDED', 'OPTIONAL_ARG_ADDED']
 * ```
 */
export declare function findSchemaChanges(oldSchema: GraphQLSchema, newSchema: GraphQLSchema): Array<SchemaChange>;
