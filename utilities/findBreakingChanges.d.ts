import type { GraphQLSchema } from '../type/schema';
export declare const BreakingChangeType: Readonly<{
  readonly TYPE_REMOVED: 'TYPE_REMOVED';
  readonly TYPE_CHANGED_KIND: 'TYPE_CHANGED_KIND';
  readonly TYPE_REMOVED_FROM_UNION: 'TYPE_REMOVED_FROM_UNION';
  readonly VALUE_REMOVED_FROM_ENUM: 'VALUE_REMOVED_FROM_ENUM';
  readonly REQUIRED_INPUT_FIELD_ADDED: 'REQUIRED_INPUT_FIELD_ADDED';
  readonly IMPLEMENTED_INTERFACE_REMOVED: 'IMPLEMENTED_INTERFACE_REMOVED';
  readonly FIELD_REMOVED: 'FIELD_REMOVED';
  readonly FIELD_CHANGED_KIND: 'FIELD_CHANGED_KIND';
  readonly REQUIRED_ARG_ADDED: 'REQUIRED_ARG_ADDED';
  readonly ARG_REMOVED: 'ARG_REMOVED';
  readonly ARG_CHANGED_KIND: 'ARG_CHANGED_KIND';
  readonly DIRECTIVE_REMOVED: 'DIRECTIVE_REMOVED';
  readonly DIRECTIVE_ARG_REMOVED: 'DIRECTIVE_ARG_REMOVED';
  readonly REQUIRED_DIRECTIVE_ARG_ADDED: 'REQUIRED_DIRECTIVE_ARG_ADDED';
  readonly DIRECTIVE_REPEATABLE_REMOVED: 'DIRECTIVE_REPEATABLE_REMOVED';
  readonly DIRECTIVE_LOCATION_REMOVED: 'DIRECTIVE_LOCATION_REMOVED';
}>;
export declare const DangerousChangeType: Readonly<{
  readonly VALUE_ADDED_TO_ENUM: 'VALUE_ADDED_TO_ENUM';
  readonly TYPE_ADDED_TO_UNION: 'TYPE_ADDED_TO_UNION';
  readonly OPTIONAL_INPUT_FIELD_ADDED: 'OPTIONAL_INPUT_FIELD_ADDED';
  readonly OPTIONAL_ARG_ADDED: 'OPTIONAL_ARG_ADDED';
  readonly IMPLEMENTED_INTERFACE_ADDED: 'IMPLEMENTED_INTERFACE_ADDED';
  readonly ARG_DEFAULT_VALUE_CHANGE: 'ARG_DEFAULT_VALUE_CHANGE';
}>;
export interface BreakingChange {
  type: keyof typeof BreakingChangeType;
  description: string;
}
export interface DangerousChange {
  type: keyof typeof DangerousChangeType;
  description: string;
}
/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of breaking changes covered by the other functions down below.
 */
export declare function findBreakingChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange>;
/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of potentially dangerous changes covered by the other functions down below.
 */
export declare function findDangerousChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange>;
