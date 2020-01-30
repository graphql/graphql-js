import { GraphQLSchema } from '../type/schema';

export const BreakingChangeType: _BreakingChangeType;

/**
 * @internal
 */
type _BreakingChangeType = {
  TYPE_REMOVED: 'TYPE_REMOVED';
  TYPE_CHANGED_KIND: 'TYPE_CHANGED_KIND';
  TYPE_REMOVED_FROM_UNION: 'TYPE_REMOVED_FROM_UNION';
  VALUE_REMOVED_FROM_ENUM: 'VALUE_REMOVED_FROM_ENUM';
  REQUIRED_INPUT_FIELD_ADDED: 'REQUIRED_INPUT_FIELD_ADDED';
  INTERFACE_REMOVED_FROM_OBJECT: 'INTERFACE_REMOVED_FROM_OBJECT';
  FIELD_REMOVED: 'FIELD_REMOVED';
  FIELD_CHANGED_KIND: 'FIELD_CHANGED_KIND';
  REQUIRED_ARG_ADDED: 'REQUIRED_ARG_ADDED';
  ARG_REMOVED: 'ARG_REMOVED';
  ARG_CHANGED_KIND: 'ARG_CHANGED_KIND';
  DIRECTIVE_REMOVED: 'DIRECTIVE_REMOVED';
  DIRECTIVE_ARG_REMOVED: 'DIRECTIVE_ARG_REMOVED';
  REQUIRED_DIRECTIVE_ARG_ADDED: 'REQUIRED_DIRECTIVE_ARG_ADDED';
  DIRECTIVE_REPEATABLE_REMOVED: 'DIRECTIVE_REPEATABLE_REMOVED';
  DIRECTIVE_LOCATION_REMOVED: 'DIRECTIVE_LOCATION_REMOVED';
};

export const DangerousChangeType: _DangerousChangeType;

/**
 * @internal
 */
type _DangerousChangeType = {
  VALUE_ADDED_TO_ENUM: 'VALUE_ADDED_TO_ENUM';
  TYPE_ADDED_TO_UNION: 'TYPE_ADDED_TO_UNION';
  OPTIONAL_INPUT_FIELD_ADDED: 'OPTIONAL_INPUT_FIELD_ADDED';
  OPTIONAL_ARG_ADDED: 'OPTIONAL_ARG_ADDED';
  INTERFACE_ADDED_TO_OBJECT: 'INTERFACE_ADDED_TO_OBJECT';
  ARG_DEFAULT_VALUE_CHANGE: 'ARG_DEFAULT_VALUE_CHANGE';
};

export interface BreakingChange {
  type: keyof _BreakingChangeType;
  description: string;
}

export interface DangerousChange {
  type: keyof _DangerousChangeType;
  description: string;
}

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of breaking changes covered by the other functions down below.
 */
export function findBreakingChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange>;

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of potentially dangerous changes covered by the other functions down below.
 */
export function findDangerousChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange>;
