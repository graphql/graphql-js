import type { ObjMap } from '../jsutils/ObjMap';
import type {
  SelectionSetNode,
  FieldNode,
  FragmentDefinitionNode,
} from '../language/ast';
import type { GraphQLSchema } from '../type/schema';
import type { GraphQLObjectType } from '../type/definition';
/**
 * Given a selectionSet, adds all of the fields in that selection to
 * the passed in map of fields, and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns an Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
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
  selectionSet: SelectionSetNode,
  fields: Map<string, Array<FieldNode>>,
  visitedFragmentNames: Set<string>,
): Map<string, ReadonlyArray<FieldNode>>;
